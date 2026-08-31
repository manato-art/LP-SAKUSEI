/**
 * スクラブ本体（企画書 §5-5）。
 * 辞書適用 → パターン置換（ドメイン/uid/メール/電話）→ 除去（外部タグ・本番バンドル）の順に適用する。
 */
import {
  ANY_EXTERNAL_HOST,
  BARE_HOST,
  CONDITIONAL_STRIP_RULES,
  EXTRA_PRODUCTION_HOST_PATTERNS,
  HOST_ALLOWLIST,
  RESIDUAL_SAAS_PATTERNS,
  LOCAL_API_ORIGIN,
  LOCAL_APP_ORIGIN,
  NEUTRAL_DOMAIN,
  STRIP_PATTERNS,
} from './policy.ts'
import { applyDictionary, type ScrubMap } from './dictionary.ts'
import { fakeEmail, fakeHost, fakePhone, fakeToken } from './replacers.ts'

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
/**
 * `data-test` / `data-testid` の値は**構造上の識別子**であってユーザーデータではない。
 * 長いトークンとみなして置換すると、土台に挙動を付けるための目印が壊れる（実採取で判明）。
 * スクラブの前に退避し、あとで戻す。
 */
const TEST_ATTR_RE = /\sdata-test(?:id)?="([^"]*)"/g

function protectTestAttrs(text: string): { text: string; restore: (s: string) => string } {
  const saved: string[] = []
  const masked = text.replace(TEST_ATTR_RE, (match) => {
    saved.push(match)
    return ` data-sbtestattr-${saved.length - 1}`
  })
  const restore = (input: string): string =>
    input.replace(/ data-sbtestattr-(\d+)/g, (_m, i: string) => saved[Number(i)] ?? '')
  return { text: masked, restore }
}

export function scrubText(input: string, map: ScrubMap, hosts: HostRewrite): ScrubResult {
  const stripped: string[] = []
  const protectedAttrs = protectTestAttrs(input)
  let text = protectedAttrs.text

  for (const { name, pattern } of STRIP_PATTERNS) {
    if (pattern.test(text)) stripped.push(name)
    text = text.replace(pattern, '')
    pattern.lastIndex = 0
  }

  // タグ単位の条件付き除去: 中身にSaaS識別子があるものだけを消す（他のタグは残す）
  for (const { name, tag, mustContain } of CONDITIONAL_STRIP_RULES) {
    let removed = false
    text = text.replace(tag, (match) => {
      if (!mustContain.test(match)) return match
      removed = true
      return ''
    })
    tag.lastIndex = 0
    if (removed) stripped.push(name)
  }

  text = applyDictionary(text, map)

  // ホスト書き換え: api系 → localhost、それ以外 → 中立ドメイン
  text = text.replace(hosts.productionHostPattern, (match) => {
    const lower = match.toLowerCase()
    if (lower.includes('api') || lower.includes('report')) return LOCAL_API_ORIGIN
    if (lower.includes('app')) return LOCAL_APP_ORIGIN
    return NEUTRAL_DOMAIN
  })

  // 製品ドメイン以外の本番ホスト（CDN / 外部フォント / 計測タグ）も中和する
  for (const { pattern, to } of EXTRA_PRODUCTION_HOST_PATTERNS) {
    text = text.replace(pattern, to)
    pattern.lastIndex = 0
  }

  // WebSocket は localhost の /cable へ
  text = text.replace(/wss?:\/\/[^\s"'<>]*\/cable/gi, `ws://localhost:4010/cable`)

  // 残った外部ホストを**全て**中和する（許可リスト以外）。
  // 顧客のLP配信ドメインや外部SaaSの非script参照は列挙では漏れるため、最後に総当たりで潰す。
  text = text.replace(ANY_EXTERNAL_HOST, (match, scheme: string, host: string) => {
    if (HOST_ALLOWLIST.some((re) => re.test(host))) return match
    return `${scheme}//${fakeHost(host)}`
  })

  // scheme無しの素のホスト名も中和（顧客のLP配信ドメイン等）
  text = text.replace(BARE_HOST, (match, host: string) => {
    if (HOST_ALLOWLIST.some((re) => re.test(host))) return match
    if (host.endsWith('example.test')) return match
    return fakeHost(host)
  })

  // タグ除去後に残ったSaaS識別子（GTMコンテナID等）を掃除（§13-G は0件必須）
  for (const pattern of RESIDUAL_SAAS_PATTERNS) {
    text = text.replace(pattern, 'REMOVED')
    pattern.lastIndex = 0
  }

  text = text.replace(GENERIC_EMAIL_RE, (m) => (m.endsWith('example.test') ? m : fakeEmail(m)))
  text = text.replace(JP_PHONE_RE, (m) => fakePhone(m))
  text = text.replace(BEARER_RE, (m) => `Bearer ${fakeToken(m)}`)
  text = text.replace(LONG_TOKEN_RE, (m) => (m.startsWith('sample_token_') ? m : fakeToken(m)))

  return { text: protectedAttrs.restore(text), stripped }
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
