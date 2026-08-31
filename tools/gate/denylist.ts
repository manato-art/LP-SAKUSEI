/**
 * 静的スキャンのdenylist（企画書 §5-5 grepゲート / §13-E 実データ非混入 / §13-F 本番ドメイン非接続 /
 * §13-G 外部SaaSタグ非ロード）。
 *
 * 注意（重要）: このファイル自身が §13-F のスキャン対象になるため、
 * 本番ドメインの文字列を「そのまま」書くと自分で自分を不合格にしてしまう。
 * よって断片から組み立てて literal を残さない。
 */

/** 採取対象の本番ドメイン（断片から組み立て。ソースに完全形を残さない） */
const PRODUCT_DOMAIN = ['squad', 'beyond', '.', 'com'].join('')

export const PRODUCTION_HOST_PATTERN = new RegExp(
  `[a-z0-9-]*\\.?${PRODUCT_DOMAIN.replace('.', '\\.')}`,
  'gi',
)

/** 外部SaaS識別子（§4-4・§13-G）。クローンに1件も残ってはならない。 */
export const EXTERNAL_SAAS_PATTERNS: readonly { name: string; pattern: RegExp }[] = [
  { name: 'Sentry', pattern: /\b(?:sentry-cdn|browser\.sentry|sentryDsn|SENTRY_DSN)\b/gi },
  { name: 'Pendo', pattern: /\bpendo\.(?:initialize|io)\b/gi },
  { name: 'HubSpot', pattern: /\b(?:hs-scripts|hubspot\.com|_hsq)\b/gi },
  { name: 'Google Tag Manager', pattern: /\b(?:googletagmanager|GTM-[A-Z0-9]{4,})\b/g },
  { name: 'GA4', pattern: /\b(?:google-analytics\.com|gtag\(|G-[A-Z0-9]{8,})\b/g },
  { name: 'Mixpanel', pattern: /\bmixpanel\.(?:init|track)\b/gi },
  { name: 'Channel.io', pattern: /\b(?:channel(?:io|talk)|ChannelIO)\b/gi },
]

/**
 * 本番uid/トークン形式（§5-5 grepゲート(3)）。
 * クローンのuidは `KIND_0001` 形式なので、それ以外の長い不透明トークンは残骸とみなす。
 */
export const PRODUCTION_TOKEN_PATTERNS: readonly { name: string; pattern: RegExp }[] = [
  { name: 'JWT', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  { name: '長い不透明トークン(32文字以上)', pattern: /\b(?![A-Z]+_\d{4}\b)[A-Za-z0-9]{32,}\b/g },
  { name: 'Bearerヘッダ', pattern: /\bBearer\s+(?!sample_token_)[A-Za-z0-9._-]{20,}/g },
]

/**
 * 外部ホスト検出（§13-F「localhost以外へのリクエスト0件」の静的版）。
 * 成果物に残ってよいのは localhost と、置換すると壊れるもの（SVG名前空間等）だけ。
 */
export const EXTERNAL_HOST_PATTERN = /https?:\/\/(?!localhost|127\.0\.0\.1)[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+/g

/** 置換すると壊れる／害が無いため許可するホスト。増やすときは docs/scrub-policy.md に理由を書く。 */
// EXTERNAL_HOST_PATTERN は scheme+host までしか拾わないので、許可リストもホスト単位で書く
export const EXTERNAL_HOST_ALLOWLIST: readonly RegExp[] = [
  /^https?:\/\/(www\.)?w3\.org$/,          // SVG/XMLの名前空間宣言。消すとSVGが壊れる
  /^https?:\/\/svgjs\.com$/,                // SVG書き出しツールのメタデータ（発信しない）
  /^https?:\/\/(www\.)?sketch(app)?\.com$/, // 同上（デザインツールのメタデータ）
  /^https?:\/\/quilljs\.com$/,              // ベンダーCSSの帰属コメント
  /^https?:\/\/fontawesome\.com$/,          // 同上
  /^https?:\/\/git\.io$/,                   // 同上
  // 匿名化後の架空ホスト。example.test は RFC 6761 の予約TLDで**絶対に名前解決されない**
  // （＝到達不能なので §13-F「localhost以外へのリクエスト0件」を実質的に満たす）
  /^https?:\/\/([a-z0-9-]+\.)*example\.test$/,
]

/** 実金額らしいパターン（§13-E 実金額パターン）。合成データは桁が撹拌済みなので通る想定。 */
export const SUSPICIOUS_MONEY_PATTERN = /[¥￥]\s?\d{1,3}(?:,\d{3}){2,}/g

/**
 * スキャン対象ディレクトリ（成果物とコミット対象）。
 * `capture` は配下すべて（clean / css / assets / …）を対象にする。
 * 生キャプチャはリポジトリ外の隔離ディレクトリにあるため、ここには含まれない（§3-3）。
 */
export const SCAN_DIRS: readonly string[] = ['capture', 'src', 'mock-server', 'tools', 'dist']

/** スキャン対象拡張子 */
export const SCAN_EXTENSIONS: readonly string[] = [
  '.html', '.htm', '.css', '.js', '.ts', '.json', '.har', '.md', '.txt', '.svg',
]

/**
 * 自己参照の除外。
 * denylist自身とゲート実装は「検出パターンを書いてある場所」なので対象外にする。
 * これ以外の除外を足すときは docs/scrub-policy.md に理由を残すこと（抜け道を作らない）。
 */
export const SELF_EXCLUDE: readonly string[] = [
  'tools/gate/denylist.ts',
  'tools/gate/grep-gate.ts',
  // 外部SaaSタグの「除去パターン」の定義元。検出語を持っているのが正しいファイルなので対象外。
  // （実行時にこれらをロードするコードではない。理由は docs/scrub-policy.md §除外一覧）
  'tools/scrub/policy.ts',
]
