/**
 * エンティティ定義（企画書 §10-2）。値はすべて架空。
 * 本ファイルは「形」だけを定義し、実データは一切持たない（§3-1）。
 */

import type { MediaField } from './media-templates.ts'

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
  /**
   * 配信URLに使うドメイン（実物はフォルダが持つ・2026-09-13）。
   * '' ＝ 未設定（配信URLを出さない）/ 'system' ＝ このシステムのドメイン / それ以外 ＝ 独自ドメインのホスト名。
   * 項目が無い古いデータは起動時に 'system' にする（store/folder-domain.ts）。
   */
  domain?: string
  /**
   * 審査の対象にするフォルダか（実SB「ツール > 審査」の /inspections/folders でトグル）。
   * ONにしたフォルダのVersion／ポップアップだけが審査画面に並ぶ。既定はOFF。
   */
  inspection_target?: boolean
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
/** Meta広告の紐付け階層。LPごとに粒度を変えられる。 */
export type MetaLevel = 'account' | 'campaign' | 'adset' | 'ad'

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
  /**
   * Meta広告の紐付け（媒体実績＝配信金額/IMP/媒体Click/媒体CV の取り込み元）。
   * 未設定なら取り込まない。トークンは**ここには保存しない**（環境変数 META_ACCESS_TOKEN のみ）。
   */
  meta_level?: MetaLevel
  /** meta_level に対応するID。account のときは `act_` を除いた数字部分。 */
  meta_object_id?: string
  /**
   * 外部LPの所在（`https://host/path`）。計測タグが最初のPVで知らせてくる。
   * ヒートマップの背景に実LPを敷くためだけに使う。クエリ・ハッシュは含めない。
   */
  external_url?: string
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

/** 中間ページタグ設定の1件（本体: HEAD / BODY を押すと名前付きのタグが1件増える） */
export interface RedirectPageTag {
  id: number
  /** タグ名 */
  name: string
  document_property: HtmlTagDocumentProperty
  /** JavaScript */
  body: string
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
  /** 中間ページタグ設定（この中間ページだけに入れる、名前付きの HEAD / BODY のタグ。未設定は空） */
  tags?: readonly RedirectPageTag[]
  /** 旧形式（2026-09-11 の一時期、名前なしの HEAD / BODY 2欄で保存していた）。読むだけで、一覧を開くと tags に置き換える */
  html_tags?: readonly HtmlTag[]
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
  /** クリック時の遷移先URL（計測ON時は sb_tracking=true 付き） */
  link_url: string
  /** 遷移先を新しいタブで開くか（'_blank' / '_self'） */
  link_target: string
  /** 計測用URL（クリックでビーコン発火・複数可） */
  tracking_urls: string[]

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

  /** 指示176: 'exit'=離脱防止（既定）/ 'instant'=表示直後（LP表示直後にオーバーレイ）。未設定は 'exit'。 */
  popup_kind?: 'exit' | 'instant'
  /** 指示172: 'link'=遷移先URLへ移動（既定）/ 'close'=LPに戻る（閉じて元の位置へ）。未設定は 'link'。 */
  link_action?: 'link' | 'close'
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
  /** LP側の実測（計測タグ） */
  pv: number
  click: number
  cv: number
  /** 媒体側の取り込み値（Meta広告APIなど）。未取得は0。 */
  ad_cost: number
  sales: number
  /** 媒体の表示回数 */
  imp?: number
  /** 媒体が計測したクリック */
  media_click?: number
  /** 媒体が計測したCV */
  media_cv?: number
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

/**
 * 訪問者の目印（squadbeyond_uid）ごとの、LPを見た・計測リンクを押した記録（2026-09-11）。
 * CVタグから成果が届いたとき、その人がどのVersionを見て（押して）いたかを照らし合わせて、Version別にCVを数える。
 * SquadBeyond 本体と同じく「計測リンクを押してから1日以内の成果」だけを数えるので、1日を過ぎた記録は消す（store/visitor-touches.ts）。
 */
export interface VisitorTouch {
  /** 訪問者の目印（LPのリンクに付く squadbeyond_uid ＝ Cookie _sb_tu） */
  vid: string
  ab_test_uid: string
  /** 見ていたVersion（外部LPの計測タグでは空） */
  version_uid: string
  /** LPを見た時刻（UNIXミリ秒） */
  viewed_at: number | null
  /** 計測リンクを押した時刻（UNIXミリ秒） */
  clicked_at: number | null
  /** この目印の成果を数えた時刻（同じ目印の成果は1回だけ数える） */
  converted_at: number | null
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

/** タスクの実行間隔（実物のプルダウンどおり） */
export type TaskScheduleKind =
  | 'once'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly_first'
  | 'monthly_last'

/** 通知に載せるレポートの期間 */
export type TaskReportSpan = 'today' | 'yesterday' | 'last7days'

/**
 * いつ動かすか。時刻はすべて**日本時間**で判定する（`lib/jst.ts`）。
 * `weekdays` は 0=日曜 … 6=土曜。`weekly` のときだけ使う。
 */
export interface TaskSchedule {
  kind: TaskScheduleKind
  hour: string
  minute: string
  weekdays: readonly number[]
}

/** どこへ送るか。未設定なら通知しない */
export interface TaskNotify {
  service: 'slack' | 'chatwork'
  destination_id: string
}

export interface Task {
  id: number
  uid: string
  team_id: number
  title: string
  assignee_member_id: number | null
  status: TaskStatus
  due_at: string | null
  created_at: number
  /** 説明（画面の「説明」欄） */
  description: string
  schedule: TaskSchedule
  span: TaskReportSpan
  notify: TaskNotify | null
  /**
   * 最後に実行した分（`YYYY-MM-DD HH:MM` のJST）。
   * 1分の間に何度も見張りが回っても二重に送らないための目印。
   */
  last_run_slot: string | null
  /** 最後の実行がどうなったか（画面に出して、届いていないことに気づけるようにする） */
  last_run_status: 'ok' | 'failed' | null
  last_run_error: string | null
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

/**
 * 審査の状態（実SB「ツール > 審査」の絞り込みチップと同じ4つ）。
 * 何も出していないものは「審査待ち」として扱う。
 */
export type InspectionStatus = 'waiting' | 'reviewing' | 'approved' | 'rejected'

/** 審査の対象（Version か 離脱防止ポップアップ）1件ぶんの状態 */
export interface InspectionEntry {
  /** 'version' | 'popup' */
  kind: string
  /** 対象のuid（Version または ExitPopup） */
  target_uid: string
  status: InspectionStatus
  /** 差し戻し・承認のときのひとこと */
  comment: string
  updated_at: number
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
  /**
   * 計測ツール・ASP名。'AFFILICODE' のとき配信リンクへ連携用パラメーターを自動付与する
   * （SB公式FAQ準拠: squadbeyond_uid / sb_tracking=true / sb_article_uid）。未設定は null。
   */
  asp: string | null
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

/**
 * メディア＝商品検索フォームの定義（実SB「ツール > メディア > メディア一覧」）。
 * 商品一覧（Product）を絞り込むための項目を持つ。
 */
export interface ProductSearchForm {
  id: number
  uid: string
  team_id: number
  name: string
  keyword: string
  /** 検索項目。テンプレートから作られ、あとから編集できる */
  fields: MediaField[]
}

/** メディアが絞り込む対象の商品（実SB「ツール > メディア > 商品一覧」） */
export interface Product {
  id: number
  uid: string
  team_id: number
  name: string
  /** 税抜価格。未入力は0 */
  price: number
  /** 1〜5。未入力は0 */
  rating: number
  site_url: string
  description: string
  /** 画像（データURL）。未設定は空文字 */
  image: string
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

/**
 * ヒートマップの集計（計測タグが送る位置情報を、LP×Version×日付で積む）。
 *
 * 実物のヒートマップは「到達率 / 離脱率 / 滞在時間 / クリック数」の4モードを持つ。
 * どれもページ内の縦位置が要るので、ページを `bands` 等分したバンド単位で持つ。
 *   reach[i] : そのバンドまで到達した訪問数（到達率＝reach[i]/pv）
 *   exit[i]  : そのバンドで離脱した訪問数（離脱率＝exit[i]/pv）
 *   dwell_ms[i] / dwell_n[i] : 滞在時間の合計とサンプル数（平均＝合計/サンプル数）
 *   clicks   : クリックの相対座標（x=幅比, y=ページ高さ比）
 */
export interface HeatmapStat {
  ab_test_uid: string
  version_uid: string
  date: string
  bands: number
  pv: number
  reach: number[]
  exit: number[]
  dwell_ms: number[]
  dwell_n: number[]
  clicks: { x: number; y: number }[]
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

/**
 * レポート除外の条件（実物の「アクセス拒否」タブ）。
 *
 * 選択肢は実物のプルダウンを開いて確認したもの（2026-09-08）。
 *   除外対象   … IPアドレス / リファラ / パラメータ / チーム
 *   マッチタイプ … 完全一致 / 部分一致 / 前方一致 / 後方一致
 *   結合条件   … AND / OR
 *
 * `email` はこのクローンの追加分。Webサイトからブラウザのログイン
 * アカウントは読めないので、本人に一度「除外リンク」を開いてもらい、
 * そのブラウザに目印を残す方式で実現している（`exclude-link.ts`）。
 */
export type ExclusionKind = 'email' | 'ip' | 'referer' | 'param' | 'team'
export type ExclusionMatch = 'exact' | 'partial' | 'prefix' | 'suffix'
export type ExclusionJoin = 'and' | 'or'

/** 1行ぶんの条件 */
export interface ExclusionCondition {
  kind: ExclusionKind
  match_type: ExclusionMatch
  value: string
  /** 次の行との繋ぎ方。最後の行では使わない */
  join: ExclusionJoin
}

/**
 * 除外ルール1件。実物は「＋複数条件を組み合わせる」で行を増やせるので、
 * 1件が複数の条件を持つ。
 */
export interface ReportExclusion {
  id: number
  uid: string
  team_id: number
  /**
   * 除外リンク（`/exclude/:token`）に使う合言葉。
   * uid は連番で推測できるため、リンクには使わない。
   * 推測できると、他人のメールアドレスが見えるうえ、
   * 誰でも自分のアクセスをレポートから外せてしまう。
   */
  exclude_token: string
  conditions: readonly ExclusionCondition[]
  /**
   * ホワイトリスト対象。実物の説明どおり「アクセス拒否の対象から除外」する。
   * レポートには反映されないが、ページはブロックされずに表示される。
   */
  is_whitelist: boolean
  reason: string
}

/** 配信リクエストの記録（レポート除外画面の「リクエスト数」の材料） */
export interface RequestLogEntry {
  team_id: number
  date: string
  /** 送信元IP */
  ip: string
  /** リファラ（無ければ空文字） */
  referer: string
  /** クエリパラメータを `k=v` にしたもの */
  params: readonly string[]
  /** この1件が除外条件に当たったか */
  excluded: boolean
  /** 除外リンクを開いたブラウザに残っている目印（無ければ空） */
  exclude_token: string
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
  inspectionEntries: readonly InspectionEntry[]
  adAccounts: readonly AdAccount[]
  aspAccounts: readonly AspAccount[]
  domains: readonly Domain[]
  tags: readonly Tag[]
  bulkTags: readonly BulkTagSetting[]
  productSearchForms: readonly ProductSearchForm[]
  products: readonly Product[]
  sbAiConversations: readonly SbAiConversation[]
  sbAiMessages: readonly SbAiMessage[]
  heatmaps: readonly Heatmap[]
  /** 計測タグが送るヒートマップの集計（LP×Version×日付） */
  heatmapStats: readonly HeatmapStat[]
  mediaAssets: readonly MediaAsset[]
  /** 画面のテーマカラー（アクセント色）。`#RRGGBB` */
  themeAccent: string
  /**
   * Slack連携。認可が済むとここに入る。
   * アクセストークンはAPIのレスポンスには**含めない**（`routes/slack.ts`）。
   */
  slack: { teamName: string; accessToken: string } | null
  /**
   * 画面から入れた外部サービスの資格情報。
   * 同じ名前の環境変数があればそちらが優先される（本番は環境変数で上書きできる）。
   * 値はAPIのレスポンスに**一切返さない**。返すのは「入っているか」だけ。
   */
  integrations: {
    slackClientId: string
    slackClientSecret: string
    chatworkApiToken: string
  }
  reportExclusions: readonly ReportExclusion[]
  /** 配信リクエストの記録（直近ぶんだけ保持する） */
  requestLogs: readonly RequestLogEntry[]
  /** 訪問者の目印ごとの「見た・押した」記録（CVをVersion別に数えるため。1日分だけ持つ・store/visitor-touches.ts） */
  visitorTouches: readonly VisitorTouch[]
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
