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

/** 除去対象（§5-5「除去」）。マッチした要素/属性/行ごと落とす。 */
export const STRIP_PATTERNS: readonly { name: string; pattern: RegExp }[] = [
  { name: '本番JSバンドル参照', pattern: /<script\b[^>]*src=["'][^"']*\/assets\/index-[a-f0-9]+\.js["'][^>]*>\s*<\/script>/gi },
  { name: 'Google Tag Manager', pattern: /<script\b[^>]*googletagmanager[^<]*<\/script>/gi },
  { name: 'GTM noscript', pattern: /<noscript>[^<]*<iframe\b[^>]*googletagmanager[\s\S]*?<\/noscript>/gi },
  { name: 'GA4', pattern: /<script\b[^>]*google-analytics[^<]*<\/script>/gi },
  { name: 'Sentry', pattern: /<script\b[^>]*(?:sentry-cdn|browser\.sentry)[^<]*<\/script>/gi },
  { name: 'Sentry DSN', pattern: /https?:\/\/[a-f0-9]+@[a-z0-9.-]*ingest[a-z0-9.-]*\/\d+/gi },
  { name: 'Channel.io', pattern: /<script\b[^>]*channel(?:\.io|talk)[^<]*<\/script>/gi },
  { name: 'Pendo', pattern: /<script\b[^>]*pendo[^<]*<\/script>/gi },
  { name: 'HubSpot', pattern: /<script\b[^>]*(?:hs-scripts|hubspot)[^<]*<\/script>/gi },
  { name: 'Mixpanel', pattern: /<script\b[^>]*mixpanel[^<]*<\/script>/gi },
]

/** ホスト書き換え（§5-5・§3-2 本番ドメインをコードに残さない） */
export const LOCAL_API_ORIGIN = 'http://localhost:4010'
export const LOCAL_APP_ORIGIN = 'http://localhost:5173'
export const NEUTRAL_DOMAIN = 'example.test'
