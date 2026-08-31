/**
 * 匿名化ポリシー（企画書 §5-5 の「保持/置換の境界」を機械可読にしたもの）。
 * 正本の説明は docs/scrub-policy.md。
 *
 * 大原則:
 *   保持(verbatim) = 画面クローム / i18n文字列（ラベル・ボタン文言・空状態文・エラー文・
 *                    バリデーション文言）。ここが忠実度の本体なので絶対に壊さない。
 *   置換           = ユーザー生成コンテンツ（施策名・人名・金額・ドメイン・アップロード物）。
 */

/**
 * fixtures(JSON) のうち「値がユーザーデータであるフィールド名」。
 * ここに載ったフィールドの値だけが置換辞書に採用され、その literal がHTML/CSSにも波及する。
 * （＝フィールド名という文脈を使って高精度に置換し、マイクロコピーの巻き込みを防ぐ）
 */
export const USER_DATA_FIELDS: readonly string[] = [
  'title',
  'name',
  'memo',
  'account_name',
  'team_name',
  'ab_test_title',
  'version_name',
  'folder_name',
  'host',
  'email',
  'tel',
  'phone',
  'url',
  'thumbnail_url',
  'snippet',
  'body',
  'content',
  'html',
  'css',
  'uid',
  'public_api_key',
  'token',
  'access_token',
  'refresh_token',
]

/**
 * 値が数値でも置換対象（金額・実績値）のフィールド名。桁感は保つ（§5-5）。
 */
export const NUMERIC_USER_DATA_FIELDS: readonly string[] = [
  'sales',
  'ad_cost',
  'gross_profit',
  'amount',
  'price',
  'pv',
  'click',
  'cv',
  'roas',
  'roi',
  'cvr',
  'cpa',
]

/**
 * 絶対に置換しないフィールド名（構造・列挙値。ここを壊すと挙動再現が崩れる）。
 * USER_DATA_FIELDS より優先される。
 */
export const STRUCTURAL_FIELDS: readonly string[] = [
  'id',
  'type',
  'status',
  'role',
  'scope',
  'provider',
  'icon_name',
  'key',
  'label',
  'created_at',
  'updated_at',
  'occurred_at',
  'date',
  'locale',
  'per_page',
  'page',
  'current_page',
  'total_pages',
  'total_count',
  'distribution_ratio',
  'published',
  'enabled',
  'archived',
  'required',
  'ssl',
  'connected',
  'is_control',
  'ad_cooperation',
  'style_applied',
  'editor_version',
]

/**
 * 除去対象（§5-5「除去」）。マッチした要素/属性/行ごと落とす。
 *
 * 重要（実採取で判明）: 外部SaaSは `<script src>` だけでなく
 * **インラインスクリプト・noscript・preconnect** としても埋まっている。
 * ホスト名を架空値へ置換するだけでは識別子（GTMコンテナID等）が残り、§13-G を満たせない。
 * よって「SaaSの識別子を含むタグは中身ごと削除する」方針にする。
 */
/** 外部SaaSの識別子（企画書 §4-4 の一覧＋実採取で見つかったもの） */
export const SAAS_IDENTIFIER =
  /googletagmanager|google-analytics|gtag\(|GTM-[A-Z0-9]{4,}|hs-scripts|hs-banner|hs-analytics|hubspot|hubteam|pendo|mixpanel|channel(?:io|talk)|ChannelIO|sentry-cdn|browser\.sentry|_hsq/i

/**
 * 単純な正規表現での除去（マッチしたら無条件で消してよいもの）。
 */
export const STRIP_PATTERNS: readonly { name: string; pattern: RegExp }[] = [
  {
    name: '本番JSバンドル参照',
    pattern: /<script\b[^>]*src=["'][^"']*\/assets\/index-[a-f0-9]+\.js["'][^>]*>\s*<\/script>/gi,
  },
  { name: 'Sentry DSN', pattern: /https?:\/\/[a-f0-9]+@[a-z0-9.-]*ingest[a-z0-9.-]*\/\d+/gi },
]

/**
 * タグ単位の条件付き除去（企画書 §4-4・§13-G）。
 *
 * **重要**: 「タグを丸ごと拾う正規表現」＋「中身にSaaS識別子が含まれるかの判定」を分ける。
 * 正規表現ひとつで表そうとすると、条件部分がオプショナル扱いになって
 * **全てのタグを消してしまう**（実際にこのバグを踏んだ。テストが検出）。
 * 土台のscriptを巻き込むと再現が壊れるため、必ず内容を検査してから消す。
 */
/** 採取に使ったブラウザ自動化が注入する要素の目印。 */
const AUTOMATION_OVERLAY = /claude-(?:agent|phantom)-/i

export const CONDITIONAL_STRIP_RULES: readonly { name: string; tag: RegExp; mustContain: RegExp }[] = [
  { name: '外部SaaSのscript', tag: /<script\b[\s\S]*?<\/script>/gi, mustContain: SAAS_IDENTIFIER },
  { name: '外部SaaSのnoscript', tag: /<noscript\b[\s\S]*?<\/noscript>/gi, mustContain: SAAS_IDENTIFIER },
  { name: '外部SaaSのlink', tag: /<link\b[^>]*>/gi, mustContain: SAAS_IDENTIFIER },
  { name: '外部SaaSのiframe', tag: /<iframe\b[\s\S]*?<\/iframe>/gi, mustContain: SAAS_IDENTIFIER },
  // SaaSが挿入した**空のマウント要素**（scriptを消すと動かないただの空div。土台に不要）。
  // 空要素だけを対象にすることで、中身のある要素を巻き込まない。
  {
    name: '外部SaaSの空マウント要素',
    tag: /<(div|span)\b[^>]*(?:hs-|hubspot|pendo|channel-?(?:io|talk)|mixpanel)[^>]*>\s*<\/\1>/gi,
    mustContain: /hs-|hubspot|pendo|channel|mixpanel/i,
  },
  // SaaS関連のHTMLコメント（`<!-- Start of HubSpot Embed Code -->` 等）。描画されないが識別子が残る
  { name: '外部SaaSのコメント', tag: /<!--[\s\S]*?-->/g, mustContain: SAAS_IDENTIFIER },
  // 採取に使ったブラウザ自動化が注入したオーバーレイ（発光枠・偽カーソル・そのCSS）。
  // 実物のアプリの一部ではないので土台に残してはいけない。
  // 残すと (1) 視覚一致率の比較対象が原本と別物になり、(2) AIの名前がDOMに焼き付く。
  {
    name: '自動化オーバーレイの要素',
    tag: /<(div|span)\b[^>]*id="claude-(?:agent|phantom)-[^"]*"[\s\S]*?<\/\1>/gi,
    mustContain: AUTOMATION_OVERLAY,
  },
  {
    name: '自動化オーバーレイのstyle',
    tag: /<style\b[^>]*id="claude-[^"]*"[\s\S]*?<\/style>/gi,
    mustContain: AUTOMATION_OVERLAY,
  },
]

/**
 * タグ除去後に残った識別子の掃除。
 * §13-G は「外部SaaSの識別子が0件」を要求するため、
 * タグ以外（属性値・JS変数・JSON文字列・プロトコル相対URL）に残った分もここで消す。
 */
export const RESIDUAL_SAAS_PATTERNS: readonly RegExp[] = [
  /\bGTM-[A-Z0-9]{4,}\b/g,
  /\bG-[A-Z0-9]{8,}\b/g,
  /\bUA-\d{4,}-\d+\b/g,
  // SaaSのホスト名そのもの（`//js-na1.hs-scripts.com/...` のようなプロトコル相対も含む）
  /\/?\/?[a-z0-9-]*\.?(?:hs-scripts|hs-banner|hs-analytics|hubspot|hubteam|hubspotfeedback|pendo|mixpanel|channel|googletagmanager|google-analytics)\.(?:com|io|net)[^\s"'<>]*/gi,
  // SaaS名がURLの**パス側**に残るケース（帰属コメント等）。ホストは既に架空だが
  // §13-G の文言は「識別子0ヒット」なのでURLごと中和する。
  /https?:\/\/[^\s"'<>]*(?:HubSpot|Pendo|Mixpanel|Sentry|ChannelIO)[^\s"'<>]*/gi,
  // CSSのクラス名/セレクタに残るSaaS名（`.hubspot.xxx` 等）
  /\.(?:hubspot|pendo|mixpanel|channelio|channeltalk)\b/gi,
]

/** ホスト書き換え（§5-5・§3-2 本番ドメインをコードに残さない） */
export const LOCAL_API_ORIGIN = 'http://localhost:4010'
export const LOCAL_APP_ORIGIN = 'http://localhost:5173'
export const NEUTRAL_DOMAIN = 'example.test'

/**
 * 製品ドメイン以外にも中和が必要な本番ホスト（2026-08-31 の実採取で判明）。
 * 実CSSには画像CDN（CloudFront）や外部フォントの参照が埋まっている。
 */
export const EXTRA_PRODUCTION_HOST_PATTERNS: readonly { name: string; pattern: RegExp; to: string }[] = [
  { name: 'CloudFront CDN', pattern: /\b[a-z0-9]+\.cloudfront\.net\b/gi, to: 'cdn.example.test' },
  { name: 'Google Fonts (css)', pattern: /https?:\/\/fonts\.googleapis\.com/gi, to: '/assets/fonts' },
  { name: 'Google Fonts (static)', pattern: /https?:\/\/fonts\.gstatic\.com/gi, to: '/assets/fonts' },
  { name: 'unpkg', pattern: /https?:\/\/unpkg\.com/gi, to: '/assets/vendor' },
  { name: 'cdnjs', pattern: /https?:\/\/cdnjs\.cloudflare\.com/gi, to: '/assets/vendor' },
]

/**
 * 置換してはいけないホスト（消すと壊れる／害が無いもの）。
 * これ以外の外部ホストは**すべて**架空ホストへ中和する（列挙式では必ず漏れるため）。
 *
 * 実採取で判明した「列挙では漏れるもの」:
 *   - 顧客ごとのLP配信ドメイン（フォルダ単位で異なる・無数にある）
 *   - 外部SaaSの script 以外の参照（preconnect / iframe / インライン設定値）
 */
export const HOST_ALLOWLIST: readonly RegExp[] = [
  /^(?:www\.)?w3\.org$/, // SVG/XMLの名前空間。消すとSVGが壊れる
  /^svgjs\.com$/,
  /^(?:www\.)?sketch(?:app)?\.com$/,
  /^quilljs\.com$/,
  /^fontawesome\.com$/,
  /^git\.io$/,
  /^localhost(?::\d+)?$/,
  /^127\.0\.0\.1(?::\d+)?$/,
]

/** 許可リストに載っていない全ての外部ホスト（scheme + host まで） */
export const ANY_EXTERNAL_HOST = /(https?:)\/\/([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+)(?::\d+)?/g

/**
 * scheme無しの素のホスト名（実在TLDのもの）。
 * 顧客のLP配信ドメインは本文中に裸で出るため、scheme付きの置換だけでは残る。
 * 誤爆を避けるため実在性の高いTLDに限定する。
 */
export const BARE_HOST =
  /\b([a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|co\.jp|jp|tokyo|io|net|dev|app|site|shop|info|biz|page|link|me|tv|cc|xyz))\b/gi

/**
 * その値をユーザーデータとして扱うか。
 *
 * **既定は「扱う」**。フィールド名の許可リスト方式は4回続けて実データを素通りさせた
 * （実名 → 実ID → 実ページ名 → 企業名とメールのローカル部）。
 * 新しいフィールドが出るたびに列挙を足すやり方では、必ず5回目が来る。
 * だから「知らないフィールドは疑う」に反転し、**素通しするものだけを列挙**する。
 *
 * 素通しの条件は「その値の形が構造的だと分かること」に限る。
 * 過剰な置換は忠実度を殺す（実際にアセットのファイル名を壊した）ので、
 * 形で構造的と分かるものは残す。
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ]|$)/
/** APIの列挙値。小文字の英字とアンダースコアだけで、数字を含まない。 */
const ENUM_LIKE = /^[a-z]+(?:_[a-z]+)*$/
const NUMERIC_ONLY = /^-?\d+(?:\.\d+)?$/
const BOOLEAN_LIKE = /^(?:true|false|null)$/i
/**
 * CSSの値。名前として置換すると**実CSSが壊れる**。
 * 実際に rgb(0, 0, 0) 等が施策名に置換され、採取CSSの色指定が8,603箇所무効になった。
 * 色関数・単位つきの数値・CSSキーワード・複合値（影/フォント指定）を含む。
 */
const CSS_VALUE =
  /^(?:#[0-9a-fA-F]{3,8}|(?:rgba?|hsla?|var|calc|translate[XYZ]?|scale|rotate|url)\(|-?\d+(?:\.\d+)?(?:px|%|em|rem|vh|vw|pt|deg|s|ms)?\b)/
/** ASCIIだけで、CSSの値らしい記号（括弧・カンマ・単位）を含む複合値。 */
const CSS_COMPOUND = /^[\x20-\x7E"']+$/
const HAS_CJK = /[぀-ヿ㐀-鿿]/
/** ルートのパス（ASCIIのみ）。日本語を含むパスは名前が埋まっている可能性があるので除外しない。 */
const URL_PATH = /^\/[\w\-./?=&%:]*$/

export function isUserDataValue(field: string, value: string): boolean {
  if (STRUCTURAL_FIELDS.includes(field)) return false
  const trimmed = value.trim()
  // 日本語を含むものは、フィールド名に関わらず必ず対象（人名・企業名・施策名はここに来る）
  if (HAS_CJK.test(trimmed)) return trimmed.length >= 2
  if (trimmed.length < 3) return false
  if (ISO_DATE.test(trimmed)) return false
  if (NUMERIC_ONLY.test(trimmed)) return false
  if (BOOLEAN_LIKE.test(trimmed)) return false
  if (CSS_VALUE.test(trimmed)) return false
  // 影やフォント指定のような複合値。ASCIIのみで、色関数や単位を含むもの。
  if (CSS_COMPOUND.test(trimmed) && /(?:rgba?\(|hsla?\(|\d(?:px|em|rem|%)\b)/.test(trimmed)) {
    return false
  }
  // CSSのキーワード（inline-block など）。英小文字とハイフンだけ。
  if (/^[a-z]+(?:-[a-z]+)+$/.test(trimmed)) return false
  // フォント指定。総称ファミリ（sans-serif 等）で終わるものはCSSの値であって名前ではない。
  if (/(?:sans-serif|serif|monospace|cursive|fantasy|system-ui)\s*$/.test(trimmed)) return false
  if (ENUM_LIKE.test(trimmed)) return false
  // 先頭が `/` の値はルートのパス。名前として置換すると土台のリンクが壊れる
  // （実際に `/folders` が施策名に置換され、タブの遷移先が消えた）。
  // パスの中の実IDは URL の形から別途拾う（tools/shared/url-identifier.ts）。
  if (URL_PATH.test(trimmed)) return false
  return true
}
