import { findUrlIdentifiers } from '../shared/url-identifier.ts'
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
  {
    // 数字を1つ以上含むものに限る。含めないと forceConsistentCasingInFileNames のような
    // 英単語をつないだ識別子を「トークン」と誤検知して、本物の違反が埋もれる。
    name: '長い不透明トークン(32文字以上)',
    pattern: /\b(?![A-Z]+_\d{4}\b)(?=[A-Za-z0-9]*\d)[A-Za-z0-9]{32,}\b/g,
  },
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

  /* ── 規格上「絶対に実在しない」宛先 ────────────────────────────────
   * ここに当たるものは、どう間違えても外部へ到達しない。
   * つまり §13-F「localhost以外へのリクエスト0件」を構造的に満たす。 */

  // RFC 6761 の予約TLD `.test`。DNSに存在しないことが規格で保証されている。
  // 匿名化後の架空ホスト（example.test）と、SSRF防御テストの宛先（evil.test 等）がこれ。
  /^https?:\/\/([a-z0-9-]+\.)*test$/,
  // RFC 2606 の文書用予約ドメイン。UIの入力例・プレースホルダに使う。
  /^https?:\/\/([a-z0-9-]+\.)*example\.(com|net|org)$/,
  // プライベート/予約アドレス（RFC 1918 / ループバック / リンクローカル / CGNAT / TEST-NET）。
  // 公衆インターネットに出ない。SSRF防御のテストが「ここへは繋がせない」ことを
  // 確かめるために書いている宛先なので、検出されるとテストを書くほど赤くなってしまう。
  /^https?:\/\/(?:10(?:\.\d{1,3}){3}|127(?:\.\d{1,3}){3}|169\.254(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|192\.168(?:\.\d{1,3}){2}|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])(?:\.\d{1,3}){2}|192\.0\.2\.\d{1,3}|198\.51\.100\.\d{1,3}|203\.0\.113\.\d{1,3})$/,

  /* ── ユーザーが明示的に依頼した、SB本番とは無関係の外部連携 ──────────
   * 採取物の残骸ではなく、こちらが意図して足した宛先。
   * 足すときは必ず「誰の依頼で・何のために」をここに書く（docs/scrub-policy.md にも転記）。 */

  // Meta広告 実データ連携（指示⑤⑧）。env（トークン/アカウント）を入れたときだけ発信する。
  /^https?:\/\/graph\.facebook\.com$/,
  // Slack通知連携。OAuth（/oauth/v2/authorize）と chat.postMessage（/api/…）。
  /^https?:\/\/(www\.)?slack\.com$/,
  // Chatwork通知連携。APIベースURL。
  /^https?:\/\/api\.chatwork\.com$/,
  // 上のAPI仕様を確認した先。コード内はコメントのリンクだけで、発信はしない。
  /^https?:\/\/developer\.chatwork\.com$/,

  /* ── 配信するLP／エディタが実行時に読むアセット ──────────────────────
   * LPビルダーとしての機能そのもの。読み込まないとウィジェットが動かない・
   * フォント指定が効かない。SB本番バックエンドとは無関係。 */

  // Webフォント（エディタのフォント選択・配信ページの font-family 指定）
  /^https?:\/\/fonts\.googleapis\.com$/,
  // ウィジェットが前提にしている外部ライブラリ（jQuery / Swiper / SmoothScroll / GLightbox）。
  // mock-server/routes/delivery.ts の externalWidgetLibs を参照。
  /^https?:\/\/code\.jquery\.com$/,
  /^https?:\/\/cdn\.jsdelivr\.net$/,
]

/** 実金額らしいパターン（§13-E 実金額パターン）。合成データは桁が撹拌済みなので通る想定。 */
export const SUSPICIOUS_MONEY_PATTERN = /[¥￥]\s?\d{1,3}(?:,\d{3})+|[¥￥]\s?\d{4,}/g

/**
 * スキャン対象ディレクトリ（成果物とコミット対象）。
 * `capture` は配下すべて（clean / css / assets / …）を対象にする。
 * 生キャプチャはリポジトリ外の隔離ディレクトリにあるため、ここには含まれない（§3-3）。
 */
export const SCAN_DIRS: readonly string[] = [
  'capture',
  'src',
  'mock-server',
  'tools',
  // 実名は成果物だけでなく、手順書やテストのフィクスチャにも書かれる。
  // ここを外していたため、実名がコミット済みでもゲートは合格を出していた。
  'docs',
  'tests',
  '.',
]

/**
 * `dist` は走査しない。
 *
 * ビルド出力であって、コミット対象ではない（.gitignore 済み）。
 * 中身は `src` と `capture`（publicDir）を束ねただけで、両方とも上で走査している。
 * つまり dist で見つかるものは必ず元でも見つかるので、検知力は落ちない。
 * 一方で「同じ違反がミニファイ後の行番号でもう一度出る」ため、
 * 直せない指摘が常時2倍に増えて本物が埋もれる。
 * 本番（Railway）の dist はソースから毎回ビルドし直されるので、
 * 手元の古い dist を見張ることに意味は無い。
 */
export const EXCLUDED_BUILD_DIR = 'dist'

/**
 * 金額ゲート（§13-E）の走査範囲。
 *
 * このゲートが探しているのは「**採取した実データ**の金額が消し残っていないか」。
 * 自分たちが書いたUIの文言（プリセットの見本、ヘルプの例示）に出てくる金額まで
 * 拾うと、LPビルダーである以上サンプルに価格が出るのは当たり前なので永久に赤くなる。
 * よって「観測してきたものが置かれる場所」に限定する。
 *
 * 実名・実ID・本番ドメイン・本番トークンといった**本当の漏洩経路**のゲートは
 * 引き続き SCAN_DIRS 全域が対象（そちらは絞らない）。
 */
export const MONEY_SCAN_DIRS: readonly string[] = ['capture', 'docs', 'tests']

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
  // 以下は「我々が書いた成果物」ではないので対象外にする。
  // 走査対象に docs/tests/直下を足した際に、これらが大量の誤検知を出して
  // 本物の違反が埋もれたため。除外の理由は必ずここに書くこと。
  'package-lock.json', // npm が生成する整合性ハッシュ。実データではない
  'scrub-map.json', // 実値→架空値の対応表。実値を持つのが役目・.gitignore 済み
  '企画書.md', // 依頼元の仕様書そのもの（入力であって成果物ではない）
  '企画書_v1.0_archive.md',
  // 「実IDらしき値の検出」自体を試すテスト。合成IDを意図的に書いているので対象外。
  // 本物の実IDは .gate-names.local に登録して実名スキャンで捕まえる（そちらは全ファイルが対象）。
  'tests/gate-url-ids.test.ts',
  'tests/scrub-url-ids.test.ts',
  // 匿名化そのものを試すテスト。合成の金額・外部SaaSタグを入力として意図的に持つ。
  'tests/scrub.test.ts',
  // 金額検出パターン自体を試すテスト。合成の金額を意図的に持つ。
  'tests/gate-scope.test.ts',
  // ホスト置換の挙動を試すテスト。合成の外部ホストを入力として意図的に持つ。
  'tests/scrub-host-only.test.ts',
  // DOM本文の金額置換を試すテスト。合成の金額を入力として意図的に持つ。
  'tests/scrub-dom-numbers.test.ts',
  // オーバーレイ除去とトークン判定を試すテスト。合成の長いトークンを意図的に持つ。
  'tests/scrub-automation-overlay.test.ts',
  'tests/scrub-svg-path.test.ts',
  // プレビュー画面の断片が本番ドメイン（squadbeyond.com / discover-news）を含まないことを
  // 確認するテスト。アサーション文字列としてドメイン名を意図的に持つ（実データではない）。
  'tests/preview-page.test.ts',
  // Version複製モーダルが本番ドメイン（squadbeyond.com）を含まないことを確認するテスト。
  // アサーション文字列としてドメイン名を意図的に持つ（実データではない）。
  'tests/version-duplicate-modal.test.ts',
  // デプロイ設定。$schema の https://railway.app は Railway の設定スキーマURLで、
  // クローン対象の本番ドメインでも実データでもない。
  'railway.json',
]

/**
 * URLの形をした実IDの残存を検知する（企画書 §3 Step0-1）。
 *
 * 「32文字以上の不透明トークン」だけでは足りないことが実測で分かった。
 * 実在のIDには9文字のものもあり、閾値では必ず取りこぼす。
 * IDは**長さではなくURLの位置と形**で見分ける（判定は tools/shared/url-identifier.ts と共有）。
 */
export function findUrlIdentifierLeaks(text: string, routeWords: readonly string[] = []): string[] {
  return findUrlIdentifiers(text, routeWords)
}
