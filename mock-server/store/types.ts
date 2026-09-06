/**
 * エンティティ定義（企画書 §10-2）。値はすべて架空。
 * 本ファイルは「形」だけを定義し、実データは一切持たない（§3-1）。
 */

export type MediaIconName = string

export interface Media {
  id: number
  name: string
  icon_name: MediaIconName
  ad_cooperation: boolean
}

export interface Plan {
  id: number
  uid: string
  team_id: number
  name: string
  price: number
  seats: number
  current: boolean
}

export interface Addon {
  id: number
  uid: string
  name: string
  price: number
  enabled: boolean
}

export interface Team {
  id: number
  uid: string
  name: string
  plan_id: number
}

export type MemberRole = 'admin' | 'team-owner' | 'member' | 'viewer'

export interface Member {
  id: number
  uid: string
  name: string
  email: string
  role: MemberRole
  team_id: number
}

export interface Folder {
  id: number
  team_id: number
  uid: string
  name: string
  parent_id: number | null
  ab_tests_count: number
  is_favorite: boolean
  created_at: number
  updated_at: number
}

/**
 * 配信ステータス（2026-08-31 実機観測）。
 * 表示: prepared=準備中 / delivered=配信中 / stopping=停止中 / finished=終了
 * 一覧の既定フィルタは `except_finished`（＝「終了以外」）。
 * 企画書の 'none|reviewing|approved|rejected' は誤り。
 */
export type AdStatus = 'prepared' | 'delivered' | 'stopping' | 'finished'

export const AD_STATUS_LABELS: Readonly<Record<AdStatus, string>> = {
  prepared: '準備中',
  delivered: '配信中',
  stopping: '停止中',
  finished: '終了',
}

/** CV計測条件（基本情報「CV条件」） */
export type ConversionCondition = 'click' | 'access'

export interface ConversionSetting {
  id: number
  conversion_condition: ConversionCondition
}

/**
 * beyondページ。2026-08-31 の実APIレスポンス（GET /api/v2/folders/:uuid/ab_tests）に合わせている。
 * created_at / updated_at は **数値（UNIXタイムスタンプ）**。ISO文字列ではない。
 */
export interface AbTest {
  id: number
  team_id: number
  uid: string
  title: string
  memo: string
  media_id: number | null
  folder_id: number | null
  ad_status: AdStatus
  /** 1=(該当なし) / 2=beyondエディター / 3=HTMLエディター。作成後は変更不可 */
  editor_version: number
  delivery_type: string
  conversion_unit_price: number
  conversion_setting: ConversionSetting
  affiliate_service_provider: string | null
  product_genres: readonly string[]
  gender: string | null
  age_from: number | null
  age_to: number | null
  /** 配信ページのブラウザタブに表示する名前（未設定ならtitleをフォールバック） */
  page_title: string
  created_at: number
  updated_at: number
  creator_member_id: number
}

export interface Article {
  id: number
  uid: string
  ab_test_id: number
  memo: string
  archived: boolean
  style_applied: boolean
  created_at: number
  updated_timestamp: number
}

/** 企画書 §9-1[2]: distribution_ratio は 0-100。合計100%でなければ警告（境界バリデーション） */
/** Versionの状態バッジ。AbTestのad_statusとは別軸（企画書§10-2の混同を是正） */
export type VersionStatus = '準備中' | '公開中' | '停止'

/** 流入元別ルール1件（URLクエリの照合） */
export interface ParamRule {
  /** パラメータ名（例: utm_creative）。空なら「どのパラメータでも」 */
  name: string
  /** 照合方法。exact=完全一致 / prefix=前方一致 / suffix=後方一致 / contains=部分一致 */
  match: 'exact' | 'prefix' | 'suffix' | 'contains'
  /** 値（例: summer） */
  value: string
}

/** 時間帯1件（HH:MM 24h） */
export interface TimeRange {
  from: string
  to: string
}

/** 配信期間1件 */
export interface DatePeriod {
  /** YYYY-MM-DD */
  from: string
  /** YYYY-MM-DD */
  to: string
  /** on=配信する / off=配信しない */
  mode: 'on' | 'off'
}

export interface Version {
  id: number
  uid: string
  article_id: number
  name: string
  distribution_ratio: number
  status: VersionStatus
  is_control: boolean
  /** アーカイブ済み（Version一覧の「アーカイブ」タブへ移る）。既定 false。 */
  archived: boolean
  /**
   * デバイス別出し分け（Versionオプション設定＞デバイス別）。各デバイスへ配信するか。
   * FAQ「出し分けロジック＝Branch Operation(配信割合) × デバイス別ON/OFF の掛け算」。
   * OFFにしたデバイスではこのVersionは配信されず、別の配信可能Versionが表示される。既定は全ON。
   */
  device_targets: { sp: boolean; tablet: boolean; pc: boolean }
  /**
   * 流入元別（旧・パラメーター別）。配信URLのクエリが登録ルールのいずれかに一致したとき
   * このVersionを表示する。未登録（空配列/未定義）なら常に対象（フォールバック）。
   */
  param_rules?: ParamRule[]
  /** モバイルOS別。ONにしたOSからのアクセス時のみ表示（いずれかON指定でPCは対象外）。未指定=制限なし。 */
  os_targets?: { android: boolean; ios: boolean }
  /** キャリア別。ONにした回線からのアクセス時のみ表示。未指定=制限なし。 */
  carrier_targets?: { docomo: boolean; au: boolean; softbank: boolean }
  /** 時間別。登録した時間帯（HH:MM〜HH:MM）内のみ表示。未登録=制限なし。 */
  time_ranges?: TimeRange[]
  /** 日付別。期間ごとに配信する/しない。未登録=日付別は適用しない。 */
  date_periods?: DatePeriod[]
  html: string
  css: string
  thumbnail_url: string | null
  created_at: number
  updated_at: number
}

export interface RedirectPage {
  id: number
  uid: string
  ab_test_id: number
  name: string
  url: string
  weight: number
  enabled: boolean
  /** リダイレクト時間（秒・指示⑮ 中間ページ設定） */
  redirect_time?: number
  /** リファラー設定（version=VersionURL / redirect_page=中間ページURL） */
  referrer_type?: 'version' | 'redirect_page'
}

export interface ExitPopup {
  id: number
  uid: string
  ab_test_id: number
  name: string
  ratio: number
  enabled: boolean
  preset_id: string | null

  // 基本タブ
  visit_count: string
  phone_number: string
  link_url: string
  callback_url: string

  // 表示タブ
  animation: string
  delay_seconds: number
  scroll_trigger: boolean
  scroll_position: number
  countdown_trigger: boolean
  countdown_seconds: number
  back_button_trigger: boolean
  exit_trigger: boolean

  // 位置タブ
  position_x: number
  position_y: number

  // 出し分けタブ
  device_sp: boolean
  device_tablet: boolean
  device_pc: boolean

  // HTMLタブ
  html: string
  javascript: string
  head_tag: string
  body_tag: string
}

/** 追尾型ポップアップ（指示85: スクロール追従バナー） */
export interface FollowPopup {
  id: number
  uid: string
  ab_test_id: number
  name: string
  enabled: boolean
  preset_id: string | null

  // 表示設定
  position: 'top' | 'bottom' | 'bottom-right' | 'bottom-left'
  show_after_scroll: number  // スクロール%で表示（0=即時）
  show_close_button: boolean
  animation: string

  // 出し分け
  device_sp: boolean
  device_tablet: boolean
  device_pc: boolean

  // コンテンツ
  html: string
  javascript: string
  css: string
}

export type SplitTestType = 'devices' | 'oses' | 'carriers' | 'hours' | 'periods' | 'params'

export interface SplitTestRule {
  key: string
  label: string
  ratio: number
  enabled: boolean
}

export interface SplitTestSetting {
  id: number
  ab_test_id: number
  type: SplitTestType
  rules: readonly SplitTestRule[]
}

/** 日次の一次メトリクス。派生KPIは §10-5 の恒等式で都度算出（保存しない） */
export interface DailyMetric {
  entity_uid: string
  scope: ReportScope
  date: string
  pv: number
  click: number
  cv: number
  ad_cost: number
  sales: number
}

export type ReportScope = 'ab_test' | 'version' | 'lp' | 'creative'

export interface Conversion {
  id: number
  uid: string
  ab_test_uid: string
  version_uid: string
  media_id: number | null
  amount: number
  occurred_at: number
  status: string
}

export interface ConversionTag {
  id: number
  uid: string
  folder_id: number
  name: string
  tag_type: string
  snippet: string
}

export interface FormField {
  name: string
  type: 'text' | 'email' | 'tel' | 'select' | 'checkbox' | 'textarea'
  required: boolean
}

export interface Form {
  id: number
  uid: string
  folder_id: number
  name: string
  fields: readonly FormField[]
}

export interface OperatorArticle {
  id: number
  uid: string
  folder_id: number
  name: string
  body: string
}

export type TaskStatus = 'todo' | 'doing' | 'done'

export interface Task {
  id: number
  uid: string
  team_id: number
  title: string
  assignee_member_id: number | null
  status: TaskStatus
  due_at: string | null
  created_at: number
}

export interface Inspection {
  id: number
  uid: string
  team_id: number
  authority: string
  folder_id: number | null
  status: string
  submitted_at: string | null
}

export type AdProvider = 'facebook' | 'google' | 'microsoft' | 'x' | 'yahoo'

export interface AdAccount {
  id: number
  uid: string
  team_id: number
  provider: AdProvider
  account_name: string
  connected: boolean
  connected_at: string | null
}

export interface AspAccount {
  id: number
  uid: string
  team_id: number
  asp_name: string
  connected: boolean
}

export interface Domain {
  id: number
  uid: string
  team_id: number
  host: string
  status: 'active' | 'pending' | 'error'
  ssl: boolean
}

export interface Tag {
  id: number
  uid: string
  team_id: number
  name: string
  color: string
}

/**
 * 一括タグ設定（実SB「ツール>一括タグ」＝/teams/tags）。
 * 範囲(チーム/フォルダグループ/フォルダ)で対象を決め、HEAD/BODYのJSタグ・noindex・
 * 計測ASP・CV条件を、対象フォルダ配下の配信ページ(/lp)へまとめて差し込む。
 */
export interface BulkTagSetting {
  id: number
  uid: string
  team_id: number
  name: string
  /** 範囲: チーム全体(全フォルダ)に設置 */
  team_wide: boolean
  /** 範囲: フォルダグループ(＝親フォルダ)id。配下の全フォルダに設置 */
  folder_group_ids: number[]
  /** 範囲: 個別フォルダ id */
  folder_ids: number[]
  /** 計測ツール・ASP（連携用パラメーター自動付与の対象）。未設定は null */
  asp_account_id: number | null
  /** CV条件。未設定は null */
  cv_condition: string | null
  /** noindexを含める */
  noindex: boolean
  /** JavaScript HEAD に差し込むタグ */
  head_js: string
  /** JavaScript BODY に差し込むタグ */
  body_js: string
  created_at: number
  updated_at: number
}

export interface ProductSearchForm {
  id: number
  uid: string
  team_id: number
  name: string
  keyword: string
}

export interface SbAiConversation {
  id: number
  uid: string
  title: string
  created_at: string
}

export interface SbAiMessage {
  id: number
  conversation_id: number
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface HeatmapPoint {
  x: number
  y: number
  value: number
}

export interface Heatmap {
  id: number
  ab_test_uid: string
  version_uid: string
  type: 'click' | 'scroll'
  points: readonly HeatmapPoint[]
  thumbnail_url: string | null
}

export interface MediaAsset {
  id: number
  uid: string
  team_id: number
  url: string
  width: number
  height: number
  name: string
}

export interface ReportExclusion {
  id: number
  uid: string
  team_id: number
  target: string
  reason: string
}

export interface User {
  id: number
  uid: string
  name: string
  email: string
  public_api_key: string | null
  current_team_id: number
}

export interface NotificationSetting {
  scope: 'member' | 'team'
  cv_notify: boolean
  daily_report: boolean
  ad_alert: boolean
}

export interface HtmlPart {
  id: number
  uid: string
  name: string
  html: string
}

export interface Seminar {
  id: number
  uid: string
  title: string
  held_at: string
  url: string
}

export interface Introduction {
  id: number
  uid: string
  title: string
  body: string
}

export interface Permission {
  id: number
  key: string
  label: string
  granted: boolean
}

/** モックの全状態。書き込みのたびに新しいStateを作る（イミュータブル・§12） */
export type HtmlTagDocumentProperty = 'head' | 'body'
export interface HtmlTag {
  tag: string
  document_property: HtmlTagDocumentProperty
  body: string
}

export interface ArticleHtmlSetting {
  article_uid: string
  /** メタタグ設定「noindexを含める」。実機の既定はON（実機観測） */
  noindex: boolean
  html_tags: readonly HtmlTag[]
}

export interface State {
  users: readonly User[]
  teams: readonly Team[]
  members: readonly Member[]
  plans: readonly Plan[]
  addons: readonly Addon[]
  media: readonly Media[]
  folders: readonly Folder[]
  abTests: readonly AbTest[]
  articles: readonly Article[]
  versions: readonly Version[]
  redirectPages: readonly RedirectPage[]
  exitPopups: readonly ExitPopup[]
  followPopups: readonly FollowPopup[]
  splitTestSettings: readonly SplitTestSetting[]
  conversions: readonly Conversion[]
  conversionTags: readonly ConversionTag[]
  forms: readonly Form[]
  operatorArticles: readonly OperatorArticle[]
  tasks: readonly Task[]
  inspections: readonly Inspection[]
  adAccounts: readonly AdAccount[]
  aspAccounts: readonly AspAccount[]
  domains: readonly Domain[]
  tags: readonly Tag[]
  bulkTags: readonly BulkTagSetting[]
  productSearchForms: readonly ProductSearchForm[]
  sbAiConversations: readonly SbAiConversation[]
  sbAiMessages: readonly SbAiMessage[]
  heatmaps: readonly Heatmap[]
  mediaAssets: readonly MediaAsset[]
  reportExclusions: readonly ReportExclusion[]
  notificationSettings: readonly NotificationSetting[]
  htmlParts: readonly HtmlPart[]
  seminars: readonly Seminar[]
  introductions: readonly Introduction[]
  permissions: readonly Permission[]
  metrics: readonly DailyMetric[]
  /** HTML設定モーダル（noindex とタグ）。記事ごとに1件。 */
  htmlTags: readonly ArticleHtmlSetting[]
  nextId: number
}
