/**
 * 管理画面（SPA）のパスワード保護。
 *
 * `ADMIN_PASSWORD`（Railway等の環境変数で上書き可能・既定 'ebiyon2026'）を知っている人だけが
 * 管理SPA（フォルダ一覧・エディタ等、サイドバーのある画面）を開ける。
 * 配信ページ（`/lp/:uid`）・API（`/api/*` 等）・`/__mock/*` は対象外
 * （配信ページはエンドユーザーが見るページなので認証を要求しない。API/`__mock`は
 * 配信ページ自身がクライアントから叩く必要があるため素通しする）。
 *
 * セッションは「パスワードのSHA-256ハッシュをそのままCookie値にする」薄い方式。
 * パスワードを知らない限り正しい値を作れない（一方向ハッシュ）ので、サーバー側に
 * セッションストアを持つ必要が無い。新規npmパッケージは入れず node:crypto だけで完結させる。
 */
import { createHash, timingSafeEqual } from 'node:crypto'
import { Router } from 'express'
import type { Request } from 'express'
import { ADMIN_PASSWORD } from '../config.ts'

export const ADMIN_SESSION_COOKIE = 'admin_session'

/** 30日 */
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

function sessionToken(password: string): string {
  return createHash('sha256').update(`ebiyon-admin-session:${password}`).digest('hex')
}

/** 起動時のADMIN_PASSWORDから1回だけ計算する（毎リクエストでハッシュを取り直さない） */
const EXPECTED_TOKEN = sessionToken(ADMIN_PASSWORD)

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (header === undefined || header === '') return out
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    const key = part.slice(0, eq).trim()
    const value = part.slice(eq + 1).trim()
    if (key !== '') out[key] = decodeURIComponent(value)
  }
  return out
}

/** 長さが違っても例外にせず false を返す、定数時間の文字列比較 */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}

/** リクエストが有効な管理セッションCookieを持っているか */
export function isAdminAuthenticated(req: Request): boolean {
  const value = parseCookies(req.headers['cookie'])[ADMIN_SESSION_COOKIE]
  return value !== undefined && safeEqual(value, EXPECTED_TOKEN)
}

/** リクエストが https 経由か（Railway等のプロキシ配下＝x-forwarded-proto も見る） */
function isSecureRequest(req: Request): boolean {
  return req.secure || req.headers['x-forwarded-proto'] === 'https'
}

function cookieAttributes(req: Request, maxAgeSeconds: number): string {
  const attrs = ['Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSeconds}`]
  if (isSecureRequest(req)) attrs.push('Secure')
  return attrs.join('; ')
}

export const adminAuthRouter: Router = Router()

adminAuthRouter.post('/__auth/login', (req, res) => {
  const body = req.body as { password?: unknown } | null
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!safeEqual(password, ADMIN_PASSWORD)) {
    res.status(401).json({ ok: false, message: 'パスワードが違います。' })
    return
  }
  res.setHeader(
    'Set-Cookie',
    `${ADMIN_SESSION_COOKIE}=${EXPECTED_TOKEN}; ${cookieAttributes(req, SESSION_MAX_AGE_SECONDS)}`,
  )
  res.json({ ok: true })
})

adminAuthRouter.get('/__auth/check', (req, res) => {
  res.json({ authenticated: isAdminAuthenticated(req) })
})

adminAuthRouter.post('/__auth/logout', (req, res) => {
  res.setHeader('Set-Cookie', `${ADMIN_SESSION_COOKIE}=; ${cookieAttributes(req, 0)}`)
  res.json({ ok: true })
})

/** 未ログイン時に index.html の代わりに返すログイン画面。 */
export function renderLoginPage(): string {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>EBIyon ログイン</title>
<link rel="icon" type="image/png" href="/assets/ebiyon-favicon-32.png">
<style>
  :root{color-scheme:light}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
    font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN",sans-serif;background:#F5F6F8}
  .card{background:#fff;border-radius:12px;padding:40px 36px;width:100%;max-width:360px;
    box-shadow:0 4px 24px rgba(0,0,0,.08);text-align:center}
  .logo{width:64px;height:64px;border-radius:16px;margin:0 auto 16px;display:block}
  .brand{font-size:20px;font-weight:700;color:#222;margin-bottom:4px}
  .sub{font-size:12px;color:#888;margin-bottom:28px}
  input[type=password]{width:100%;padding:12px 14px;border:1px solid #DDD;border-radius:8px;
    font-size:14px;margin-bottom:12px}
  input[type=password]:focus{outline:none;border-color:#E4432B}
  button{width:100%;padding:12px 14px;border:none;border-radius:8px;background:#E4432B;
    color:#fff;font-size:14px;font-weight:600;cursor:pointer}
  button:disabled{opacity:.6;cursor:default}
  .error{color:#E4432B;font-size:12px;margin-top:10px;min-height:16px}
</style></head>
<body>
  <form class="card" id="login-form">
    <img class="logo" src="/assets/ebiyon-favicon-180.png" alt="EBIyon">
    <div class="brand">EBIyon</div>
    <div class="sub">管理画面にはパスワードが必要です</div>
    <input type="password" id="password" name="password" placeholder="パスワード" autofocus required>
    <button type="submit" id="submit-btn">ログイン</button>
    <div class="error" id="error"></div>
  </form>
  <script>
    var form = document.getElementById('login-form')
    var errorEl = document.getElementById('error')
    var btn = document.getElementById('submit-btn')
    form.addEventListener('submit', function (e) {
      e.preventDefault()
      errorEl.textContent = ''
      btn.disabled = true
      var password = document.getElementById('password').value
      fetch('/__auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password }),
      })
        .then(function (res) {
          return res.json().then(function (data) { return { ok: res.ok, data: data } })
        })
        .then(function (result) {
          if (result.ok && result.data.ok) {
            location.reload()
          } else {
            errorEl.textContent = (result.data && result.data.message) || 'ログインに失敗しました。'
            btn.disabled = false
          }
        })
        .catch(function () {
          errorEl.textContent = '通信に失敗しました。'
          btn.disabled = false
        })
    })
  </script>
</body></html>`
}
