/**
 * 外部LPのHTMLをサーバー側で取ってきて、ヒートマップの背景として描ける形に整える。
 *
 * なぜサーバー側で取るのか:
 *   実LP（別アカウントのSquadBeyond等）は `x-frame-options: SAMEORIGIN` を返すので、
 *   ブラウザから直接 iframe に嵌めることができない。サーバーが取得して、
 *   自オリジンの srcdoc として渡すことで初めて背景に敷ける。
 *
 * 安全側の作り（**任意のURLを取りに行く処理なので、ここが甘いと踏み台になる**）:
 *   - http / https のみ。それ以外のスキーム（file: gopher: など）は拒否
 *   - 名前解決した**全アドレス**を検査し、私有・ループバック・リンクローカル・
 *     クラウドのメタデータIPを1つでも含んだら拒否（SSRF）
 *   - リダイレクトは手動で最大3回まで追い、**毎回同じ検査**を通す
 *     （最初だけ検査してリダイレクトで内部に飛ばされる古典的な穴を塞ぐ）
 *   - タイムアウト8秒・最大3MB。応答は Content-Type が HTML のものだけ
 *
 * 取得したHTMLの扱い:
 *   スクリプト等は下の `sanitizeHtml` で落とすが、**それを安全性の根拠にはしない**。
 *   最終的な防御は呼び出し側の `<iframe sandbox>`（allow-scripts を与えない）であり、
 *   ここでの除去は多層防御の1枚目という位置づけ。
 *
 * 既知の限界: 名前解決してから実際に接続するまでの間にDNSが差し替わる
 *   （DNSリバインディング）余地は残る。塞ぐにはIP固定接続が要るが、
 *   この画面は管理者認証の内側でしか呼べないため、現状はこの検査で運用する。
 */
import { lookup } from 'node:dns/promises'
import { isIP, isIPv4 } from 'node:net'

const MAX_BYTES = 3 * 1024 * 1024
const TIMEOUT_MS = 8000
const MAX_REDIRECTS = 3

export interface ExternalPageResult {
  html: string
  /** 実際に取得できたURL（リダイレクト後） */
  finalUrl: string
}

export class ExternalPageError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message)
    this.name = 'ExternalPageError'
  }
}

/** IPv4 が私有・特殊用途のレンジに入っているか。 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map((n) => Number.parseInt(n, 10))
  const [a, b] = parts as [number, number, number, number]
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true // 解釈できないものは通さない
  }
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 169 && b === 254) return true // リンクローカル（169.254.169.254 = メタデータ）
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 192 && b === 0) return true // 192.0.0.0/24
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true // ベンチマーク用
  if (a >= 224) return true // マルチキャスト・予約
  return false
}

/** IPv6 が私有・特殊用途か。IPv4射影アドレスは中身のIPv4で判定する。 */
function isPrivateIPv6(ip: string): boolean {
  const v = ip.toLowerCase().split('%')[0] ?? ''
  if (v === '::1' || v === '::') return true
  const mapped = /^::ffff:(.+)$/.exec(v)
  if (mapped !== null) {
    const inner = mapped[1] as string
    return isIPv4(inner) ? isPrivateIPv4(inner) : true
  }
  const head = v.split(':')[0] ?? ''
  const n = Number.parseInt(head.padEnd(4, '0'), 16)
  if (Number.isNaN(n)) return true
  if ((n & 0xfe00) === 0xfc00) return true // fc00::/7 ユニークローカル
  if ((n & 0xffc0) === 0xfe80) return true // fe80::/10 リンクローカル
  if ((n & 0xff00) === 0xff00) return true // ff00::/8 マルチキャスト
  return false
}

/** ホスト名を名前解決し、**全アドレス**が公開レンジであることを確かめる。 */
async function assertPublicHost(hostname: string): Promise<void> {
  // URL.hostname はIPv6リテラルを `[::1]` の形で返す。角括弧付きのままでは
  // 名前解決も isIP 判定も通らないので、先に外す。
  const host = hostname.replace(/^\[|\]$/g, '')

  // すでにIPリテラルなら名前解決を挟まず直接判定する
  const literal = isIP(host)
  if (literal !== 0) {
    const isPrivate = literal === 4 ? isPrivateIPv4(host) : isPrivateIPv6(host)
    if (isPrivate) {
      throw new ExternalPageError('内部ネットワーク宛のURLは取得できません。', 'blocked_host')
    }
    return
  }

  let addrs: { address: string; family: number }[]
  try {
    addrs = await lookup(host, { all: true })
  } catch {
    throw new ExternalPageError(`ホスト名を解決できません: ${host}`, 'dns_failed')
  }
  if (addrs.length === 0) {
    throw new ExternalPageError(`ホスト名を解決できません: ${host}`, 'dns_failed')
  }
  for (const { address, family } of addrs) {
    const isPrivate = family === 4 ? isPrivateIPv4(address) : isPrivateIPv6(address)
    if (isPrivate) {
      throw new ExternalPageError('内部ネットワーク宛のURLは取得できません。', 'blocked_host')
    }
  }
}

/** URLとして妥当で、http/https で、公開ホスト宛であることを確かめる。 */
async function assertFetchable(url: URL): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ExternalPageError('http / https のURLだけ取得できます。', 'bad_scheme')
  }
  await assertPublicHost(url.hostname)
}

/**
 * `<script>` など実行され得る要素と、`on*=` ハンドラを落とす。
 * **これは多層防御の1枚目**で、安全性の根拠は呼び出し側の `<iframe sandbox>` にある。
 */
export function sanitizeHtml(html: string): string {
  return (
    html
      // 中身ごと落とす要素
      .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
      .replace(/<noscript\b[\s\S]*?<\/noscript\s*>/gi, '')
      .replace(/<object\b[\s\S]*?<\/object\s*>/gi, '')
      .replace(/<embed\b[^>]*>/gi, '')
      .replace(/<iframe\b[\s\S]*?<\/iframe\s*>/gi, '')
      // 閉じタグが無い書き方への保険
      .replace(/<script\b[^>]*>/gi, '')
      // onclick= のようなインラインハンドラ（引用符あり／なしの両方）
      .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
      .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
      .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
      // javascript: リンク
      .replace(/(href|src)\s*=\s*"\s*javascript:[^"]*"/gi, '$1="#"')
      .replace(/(href|src)\s*=\s*'\s*javascript:[^']*'/gi, "$1='#'")
  )
}

/**
 * 相対パスの画像・CSSが解決できるように `<base>` を差し込む。
 * 既に `<base>` があるページはそのままにする（二重指定は最初の1つが勝つため無意味）。
 */
export function injectBase(html: string, finalUrl: string): string {
  if (/<base\b/i.test(html)) return html
  const tag = `<base href="${finalUrl.replace(/"/g, '&quot;')}">`
  if (/<head\b[^>]*>/i.test(html)) {
    return html.replace(/<head\b[^>]*>/i, (m) => `${m}${tag}`)
  }
  return `${tag}${html}`
}

/** 上限つきでレスポンス本文を読む（巨大なページでメモリを食い潰さない）。 */
async function readCapped(res: Response): Promise<string> {
  const body = res.body
  if (body === null) return ''
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value !== undefined) {
      total += value.byteLength
      if (total > MAX_BYTES) {
        await reader.cancel()
        throw new ExternalPageError('ページが大きすぎます（3MB超）。', 'too_large')
      }
      chunks.push(value)
    }
  }
  return Buffer.concat(chunks).toString('utf8')
}

/**
 * 外部LPを取得して、背景として描ける安全なHTMLを返す。
 * 失敗は必ず `ExternalPageError` で返す（呼び出し側が理由を出せるように）。
 */
export async function fetchExternalPage(rawUrl: string): Promise<ExternalPageResult> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new ExternalPageError('URLの形式が正しくありません。', 'bad_url')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await assertFetchable(url)
      const res = await fetch(url, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          // 実際の閲覧者と同じ見た目のページを受け取りたいので、通常のブラウザとして名乗る
          accept: 'text/html,application/xhtml+xml',
          'user-agent': 'Mozilla/5.0 (compatible; LP-SAKUSEI-heatmap/1.0)',
        },
      })

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location')
        if (loc === null || loc === '') {
          throw new ExternalPageError('リダイレクト先が示されていません。', 'bad_redirect')
        }
        url = new URL(loc, url) // 次のループ先頭で再検査する
        continue
      }
      if (!res.ok) {
        throw new ExternalPageError(`取得に失敗しました（HTTP ${res.status}）。`, 'http_error')
      }
      const type = res.headers.get('content-type') ?? ''
      if (!/text\/html|application\/xhtml/i.test(type)) {
        throw new ExternalPageError('HTMLではないため背景にできません。', 'not_html')
      }
      const raw = await readCapped(res)
      const finalUrl = url.toString()
      return { html: injectBase(sanitizeHtml(raw), finalUrl), finalUrl }
    }
    throw new ExternalPageError('リダイレクトが多すぎます。', 'too_many_redirects')
  } catch (error) {
    if (error instanceof ExternalPageError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ExternalPageError('取得がタイムアウトしました（8秒）。', 'timeout')
    }
    throw new ExternalPageError(
      `取得に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      'fetch_failed',
    )
  } finally {
    clearTimeout(timer)
  }
}
