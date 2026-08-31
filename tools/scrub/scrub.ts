/**
 * スクラブ本体（企画書 §5-5）。
 * 辞書適用 → パターン置換（ドメイン/uid/メール/電話）→ 除去（外部タグ・本番バンドル）の順に適用する。
 */
import { LOCAL_API_ORIGIN, LOCAL_APP_ORIGIN, NEUTRAL_DOMAIN, STRIP_PATTERNS } from './policy.ts'
import { applyDictionary, type ScrubMap } from './dictionary.ts'
import { fakeEmail, fakePhone, fakeToken } from './replacers.ts'

/**
 * 本番ホストのローカル化（§5-5・§3-2）。
 * 対象ドメインは「採取対象のホスト名」を外から渡す（コードに本番ドメインを固定で書かない）。
 */
export interface HostRewrite {
  /** 例: ['app', 'api', 'api-workers', 'report'] の各サブドメインを含む正規表現 */
  productionHostPattern: RegExp
}

const GENERIC_EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g
const JP_PHONE_RE = /\b0\d{1,4}-\d{1,4}-\d{3,4}\b/g
const BEARER_RE = /\b(?:Bearer\s+)[A-Za-z0-9._-]{20,}\b/g
const LONG_TOKEN_RE = /\b[A-Za-z0-9_-]{32,}\b/g

export interface ScrubResult {
  text: string
  stripped: string[]
}

/**
 * 生キャプチャ文字列を匿名化する。
 * 順序が重要: 除去 → 辞書 → パターン。除去を先にやることで、
 * 消える予定のタグ内の値を無駄に辞書登録・置換しない。
 */
export function scrubText(input: string, map: ScrubMap, hosts: HostRewrite): ScrubResult {
  const stripped: string[] = []
  let text = input

  for (const { name, pattern } of STRIP_PATTERNS) {
    if (pattern.test(text)) stripped.push(name)
    text = text.replace(pattern, '')
    pattern.lastIndex = 0
  }

  text = applyDictionary(text, map)

  // ホスト書き換え: api系 → localhost、それ以外 → 中立ドメイン
  text = text.replace(hosts.productionHostPattern, (match) => {
    const lower = match.toLowerCase()
    if (lower.includes('api') || lower.includes('report')) return LOCAL_API_ORIGIN
    if (lower.includes('app')) return LOCAL_APP_ORIGIN
    return NEUTRAL_DOMAIN
  })

  // WebSocket は localhost の /cable へ
  text = text.replace(/wss?:\/\/[^\s"'<>]*\/cable/gi, `ws://localhost:4010/cable`)

  text = text.replace(GENERIC_EMAIL_RE, (m) => (m.endsWith('example.test') ? m : fakeEmail(m)))
  text = text.replace(JP_PHONE_RE, (m) => fakePhone(m))
  text = text.replace(BEARER_RE, (m) => `Bearer ${fakeToken(m)}`)
  text = text.replace(LONG_TOKEN_RE, (m) => (m.startsWith('sample_token_') ? m : fakeToken(m)))

  return { text, stripped }
}

/** JSON(fixtures)用。文字列値だけをスクラブし、構造とキーは保つ。 */
export function scrubJson(node: unknown, map: ScrubMap, hosts: HostRewrite): unknown {
  if (Array.isArray(node)) return node.map((item) => scrubJson(item, map, hosts))
  if (node !== null && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node).map(([key, value]) => [key, scrubJson(value, map, hosts)]),
    )
  }
  if (typeof node === 'string') return scrubText(node, map, hosts).text
  return node
}
