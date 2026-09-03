/**
 * 管理画面（SPA）のパスワード保護。
 *
 * `ADMIN_PASSWORD`（Railway等の環境変数で上書き可能・既定 'ebiyon2026'）を知っている人だけが
 * 管理SPA（フォルダ一覧・エディタ等、サイドバーのある画面）を開ける。
 * 配信ページ（`/lp/:uid`）は対象外（エンドユーザーが見るページなので認証を要求しない）。
 * API（`/api/*` 等）も認証必須（管理画面からしか叩かない）。
 *
 * ログイン画面は `ADMIN_PATH`（既定 `/__admin`）でのみ表示する。
 * ルート（`/`）を開いても404を返す＝配信URLを渡したクライアントに管理画面の存在を悟らせない。
 *
 * セッションは「パスワードのSHA-256ハッシュをそのままCookie値にする」薄い方式。
 * パスワードを知らない限り正しい値を作れない（一方向ハッシュ）ので、サーバー側に
 * セッションストアを持つ必要が無い。新規npmパッケージは入れず node:crypto だけで完結させる。
 *
 * ログイン試行は IP ベースでレート制限（5回失敗で60秒ロック）。
 */
import { createHash, timingSafeEqual } from 'node:crypto'
import { Router } from 'express'
import type { Request, Response } from 'express'
import { ADMIN_PASSWORD, ADMIN_PATH } from '../config.ts'
import { hasAllowedEmail } from '../store/allowed-emails.ts'

export const ADMIN_SESSION_COOKIE = 'admin_session'
export const EMAIL_GATE_COOKIE = 'email_gate'

/** 30日 */
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

/** レート制限: 最大試行回数 */
const MAX_LOGIN_ATTEMPTS = 5
/** レート制限: ロック時間（ミリ秒） */
const LOCKOUT_MS = 60_000

function sessionToken(password: string): string {
  return createHash('sha256').update(`ebiyon-admin-session:${password}`).digest('hex')
}

/** 起動時のADMIN_PASSWORDから1回だけ計算する（毎リクエストでハッシュを取り直さない） */
const EXPECTED_TOKEN = sessionToken(ADMIN_PASSWORD)

/** メールゲート用のCookieトークン（ADMIN_PASSWORDに紐づく＝パスワード変更で無効化される） */
const EMAIL_GATE_TOKEN = createHash('sha256').update(`email-gate:${ADMIN_PASSWORD}`).digest('hex')

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

/** メールゲートを通過済みか（email_gate Cookieの検証） */
export function isEmailGateVerified(req: Request): boolean {
  const value = parseCookies(req.headers['cookie'])[EMAIL_GATE_COOKIE]
  return value !== undefined && safeEqual(value, EMAIL_GATE_TOKEN)
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

// ── レート制限（IPベース・インメモリ）──
interface LoginAttempt {
  count: number
  firstAt: number
}
const loginAttempts = new Map<string, LoginAttempt>()

/** 古い記録を定期的に掃除（メモリリーク防止） */
setInterval(() => {
  const now = Date.now()
  for (const [ip, attempt] of loginAttempts) {
    if (now - attempt.firstAt > LOCKOUT_MS * 2) loginAttempts.delete(ip)
  }
}, LOCKOUT_MS * 2)

function getClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for']
  if (typeof xff === 'string') return xff.split(',')[0]?.trim() ?? 'unknown'
  return req.ip ?? 'unknown'
}

function isRateLimited(ip: string): { limited: boolean; retryAfterSeconds: number } {
  const attempt = loginAttempts.get(ip)
  if (attempt === undefined) return { limited: false, retryAfterSeconds: 0 }
  if (attempt.count < MAX_LOGIN_ATTEMPTS) return { limited: false, retryAfterSeconds: 0 }
  const elapsed = Date.now() - attempt.firstAt
  if (elapsed >= LOCKOUT_MS) {
    loginAttempts.delete(ip)
    return { limited: false, retryAfterSeconds: 0 }
  }
  return { limited: true, retryAfterSeconds: Math.ceil((LOCKOUT_MS - elapsed) / 1000) }
}

function recordFailedLogin(ip: string): void {
  const attempt = loginAttempts.get(ip)
  if (attempt === undefined) {
    loginAttempts.set(ip, { count: 1, firstAt: Date.now() })
  } else {
    attempt.count += 1
  }
}

function clearLoginAttempts(ip: string): void {
  loginAttempts.delete(ip)
}

// ── ルーター ──
export const adminAuthRouter: Router = Router()

adminAuthRouter.post('/__auth/login', (req, res) => {
  const ip = getClientIp(req)
  const rate = isRateLimited(ip)
  if (rate.limited) {
    res.status(429).json({
      ok: false,
      message: `試行回数の上限に達しました。${rate.retryAfterSeconds}秒後に再試行してください。`,
    })
    return
  }

  const body = req.body as { password?: unknown } | null
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!safeEqual(password, ADMIN_PASSWORD)) {
    recordFailedLogin(ip)
    const attempt = loginAttempts.get(ip)
    const remaining = MAX_LOGIN_ATTEMPTS - (attempt?.count ?? 0)
    const message = remaining > 0
      ? `パスワードが違います。（残り${remaining}回）`
      : `試行回数の上限に達しました。${Math.ceil(LOCKOUT_MS / 1000)}秒後に再試行してください。`
    res.status(401).json({ ok: false, message })
    return
  }
  clearLoginAttempts(ip)
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

/** メールゲート: メールアドレスを検証してCookieを付与する */
adminAuthRouter.post('/__auth/verify-email', (req, res) => {
  const ip = getClientIp(req)
  const rate = isRateLimited(ip)
  if (rate.limited) {
    res.status(429).json({
      ok: false,
      message: `試行回数の上限に達しました。${rate.retryAfterSeconds}秒後に再試行してください。`,
    })
    return
  }

  const body = req.body as { email?: unknown } | null
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (email === '' || !hasAllowedEmail(email)) {
    // 許可リストに無いメール → 不正試行としてカウント（レート制限の対象にする）
    recordFailedLogin(ip)
    // 404を返す（「許可リストに無い」こと自体を悟らせない）
    res.status(404).json({ ok: false })
    return
  }

  // メールゲートCookieを付与 → ログイン画面へ進めるようになる
  clearLoginAttempts(ip)
  res.setHeader(
    'Set-Cookie',
    `${EMAIL_GATE_COOKIE}=${EMAIL_GATE_TOKEN}; ${cookieAttributes(req, SESSION_MAX_AGE_SECONDS)}`,
  )
  res.json({ ok: true, redirect: ADMIN_PATH })
})

/** 管理画面入口（ADMIN_PATH）にログイン画面を返す */
adminAuthRouter.get(ADMIN_PATH, (req: Request, res: Response) => {
  if (isAdminAuthenticated(req)) {
    // ログイン済みならSPAのルート（`/`）へ飛ばす（本番では serveIndexOrLogin がSPAを返す）
    res.redirect('/')
    return
  }
  res.type('html').send(renderLoginPage())
})

/** 未ログイン時に返すログイン画面。ログイン成功後は `/` へリダイレクト（SPAのトップ）。 */
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
            location.href = '/'
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

/**
 * メールゲート画面。許可リストにメールが登録されているとき、ルート（`/`）で表示する。
 * 許可されたメールを入れるとログイン画面へ進む。それ以外は404に見せる。
 */
export function renderEmailGatePage(): string {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>アクセス認証</title>
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
  input[type=email]{width:100%;padding:12px 14px;border:1px solid #DDD;border-radius:8px;
    font-size:14px;margin-bottom:12px}
  input[type=email]:focus{outline:none;border-color:#E4432B}
  button{width:100%;padding:12px 14px;border:none;border-radius:8px;background:#E4432B;
    color:#fff;font-size:14px;font-weight:600;cursor:pointer}
  button:disabled{opacity:.6;cursor:default}
  .error{color:#E4432B;font-size:12px;margin-top:10px;min-height:16px}
  .not-found{display:none;text-align:center}
  .not-found .code{font-size:64px;font-weight:700;color:#CCC;margin-bottom:8px}
  .not-found .msg{font-size:14px;color:#888}
</style></head>
<body>
  <form class="card" id="email-form">
    <img class="logo" src="/assets/ebiyon-favicon-180.png" alt="EBIyon">
    <div class="brand">EBIyon</div>
    <div class="sub">登録されたメールアドレスを入力してください</div>
    <input type="email" id="email" name="email" placeholder="メールアドレス" autofocus required>
    <button type="submit" id="submit-btn">認証</button>
    <div class="error" id="error"></div>
  </form>
  <div class="not-found" id="not-found">
    <div class="code">404</div>
    <div class="msg">ページが見つかりません</div>
  </div>
  <script>
    var form = document.getElementById('email-form')
    var errorEl = document.getElementById('error')
    var btn = document.getElementById('submit-btn')
    var notFound = document.getElementById('not-found')
    form.addEventListener('submit', function (e) {
      e.preventDefault()
      errorEl.textContent = ''
      btn.disabled = true
      var email = document.getElementById('email').value
      fetch('/__auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email }),
      })
        .then(function (res) {
          if (res.status === 404) {
            form.style.display = 'none'
            notFound.style.display = 'block'
            return null
          }
          return res.json()
        })
        .then(function (data) {
          if (data === null) return
          if (data.ok && data.redirect) {
            location.href = data.redirect
          } else if (data.message) {
            errorEl.textContent = data.message
            btn.disabled = false
          } else {
            form.style.display = 'none'
            notFound.style.display = 'block'
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

/** 存在しないページ用の404ページ（管理画面の存在を悟らせない） */
export function render404Page(): string {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ページが見つかりません</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
    font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN",sans-serif;background:#F5F6F8;color:#333}
  .card{text-align:center}
  .code{font-size:64px;font-weight:700;color:#CCC;margin-bottom:8px}
  .msg{font-size:14px;color:#888}
</style></head>
<body>
  <div class="card">
    <div class="code">404</div>
    <div class="msg">ページが見つかりません</div>
  </div>
</body></html>`
}
