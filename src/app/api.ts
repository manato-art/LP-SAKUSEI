/**
 * モックAPIクライアント（企画書 §10-1・localhost固定）。
 * 本番ドメインは登場させない（§3-2）。
 */
import type { MasterStyleSheet } from './master-style.ts'

const BASE = '/api/v1'

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  if (!res.ok && res.status !== 204) {
    const detail = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    throw new Error(detail?.error?.message ?? `${method} ${path} が失敗しました (${res.status})`)
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}

export interface Folder {
  id: number
  uid: string
  name: string
  parent_id: number | null
  /** 配信URLに使うドメイン（'' ＝未設定 / 'system' ＝このシステムのドメイン / ホスト名） */
  domain?: string
  ab_tests_count: number
  is_favorite: boolean
}

export interface Media {
  id: number
  name: string
  icon_name: string
}

export interface AbTest {
  id: number
  uid: string
  title: string
  ad_status: string
  editor_version: number
  folder_id: number | null
  media: { name: string } | null
  delivery_type?: string
  conversion_unit_price?: number
  conversion_setting?: { conversion_condition: string }
  affiliate_service_provider?: string | null
  product_genres?: readonly string[]
  created_at?: number
  updated_at?: number
  /** domain＝配信URLに使うドメイン（'' ＝未設定 / 'system' ＝このシステムのドメイン / ホスト名） */
  folder?: { uid: string; name: string; domain?: string } | null
  /** Meta広告連携の紐付け（未設定は null）。トークンは含まない＝サーバーの環境変数のみ。 */
  meta_level?: string | null
  meta_object_id?: string | null
}

export interface RelationCounts {
  id: number
  versions_count: number
  exit_popups_count: number
  funnel_steps_count: number
  ab_test_uid: string | null
}

export interface BulkTag {
  uid: string
  name: string
  team_wide: boolean
  folder_group_ids: number[]
  folder_ids: number[]
  asp_account_id: number | null
  asp: string | null
  cv_condition: string | null
  noindex: boolean
  head_js: string
  body_js: string
}

export interface Version {
  id: number
  uid: string
  name: string
  distribution_ratio: number
  status: string
  archived?: boolean
  device_targets?: { sp: boolean; tablet: boolean; pc: boolean }
  /** 流入元別/OS別/キャリア別/時間別/日付別 の版ごと設定（配信の出し分けに使う） */
  param_rules?: { name: string; match: 'exact' | 'prefix' | 'suffix' | 'contains'; value: string }[]
  os_targets?: { android: boolean; ios: boolean } | null
  carrier_targets?: { docomo: boolean; au: boolean; softbank: boolean } | null
  time_ranges?: { from: string; to: string }[]
  date_periods?: { from: string; to: string; mode: 'on' | 'off' }[]
  html: string
  css: string
}

/**
 * レポートの1行ぶんのKPI。派生値は `mock-server/store/metrics.ts` の恒等式（企画書 §10-5）で
 * サーバー側が算出したものをそのまま受け取る。ゼロ除算は null（UIで「-」表示）。
 */
export interface ReportKpi {
  pv: number
  click: number
  cv: number
  ad_cost: number
  /** 媒体の表示回数（Meta広告等から取り込み） */
  imp: number
  /** 媒体が計測したクリック */
  media_click: number
  /** 媒体が計測したCV */
  media_cv: number
  sales: number
  gross_profit: number
  roas: number | null
  roi: number | null
  cvr: number | null
  cpa: number | null
  /** click / pv */
  ctr: number | null
  /** cv / pv */
  ctvr: number | null
  /** media_click / imp */
  media_ctr: number | null
  /** ad_cost / media_cv */
  mcpa: number | null
}

export interface ReportVersionRow extends ReportKpi {
  scope: string
  entity_uid: string
  name: string
  status: string
  distribution_ratio: number
}

export interface ReportDailyRow extends ReportKpi {
  date: string
}

export interface ReportResponse {
  rows: ReportVersionRow[]
  totals: ReportKpi
  daily: ReportDailyRow[]
  period: { start_date: string; end_date: string }
}

/**
 * ヒートマップの実測集計（計測タグ由来）。バンド＝ページを縦に等分した区画。
 * 比率は PV が 0 のとき null（0件と「まだ誰も来ていない」を区別する）。
 */
export interface HeatmapVersionStat {
  version_uid: string
  version_name: string | null
  bands: number
  pv: number
  /** 到達率（そのバンドまで到達した割合） */
  arrival: (number | null)[]
  /** 離脱率（そのバンドで離脱した割合） */
  exit: (number | null)[]
  /** 滞在時間の平均ミリ秒 */
  attention: number[]
  /** そのバンドに落ちたクリック数 */
  elementClick: number[]
  /** クリックの相対座標（x=幅比・y=ページ高さ比） */
  clicks: { x: number; y: number }[]
}

export interface HeatmapStatsResponse {
  period: { start_date: string; end_date: string }
  versions: HeatmapVersionStat[]
}

export interface HeatmapEntry {
  id: number
  ab_test_uid: string
  version_uid: string
  type: 'click' | 'scroll'
  points: readonly { x: number; y: number; value: number }[]
  thumbnail_url: string | null
}

/** マジック置換の一覧（1ページぶん） */
export interface BulkReplacePage {
  ab_test_uid: string
  title: string
  rows: BulkReplaceRow[]
}

export interface BulkReplaceRow {
  /** 置換のときにこの行を指す値（画像/リンクはURL、テキストは検索語） */
  value: string
  /** 画面に出す文字（テキストは前後の文脈） */
  label: string
  count: number
  version_uid: string
  version_name: string
  /** リンクのみ: 計測機能が付いているか */
  tracking?: boolean
  /** テキストのみ: そのVersion内で何番目の一致か */
  text_index?: number
}

/** メディアの検索項目（実SB「ツール > メディア」） */
export interface MediaField {
  name: string
  /** ボタン / セレクトボックス / 上限下限メディア / チェックボックス */
  type: 'button' | 'select_box' | 'min_max' | 'check_box'
  /** 商品への選択肢の紐付け（単一 / 複数） */
  link: 'single' | 'multiple'
  options: string[]
}

/** メディア＝商品検索フォームの定義 */
export interface Media {
  uid: string
  name: string
  keyword: string
  fields: MediaField[]
}

/** メディアが絞り込む対象の商品 */
export interface Product {
  uid: string
  name: string
  price: number
  rating: number
  site_url: string
  description: string
  image: string
}

/** 審査対象のフォルダ1件 */
export interface InspectionFolder {
  uid: string
  name: string
  is_favorite: boolean
  inspection_target: boolean
}

export interface InspectionFolderGroup extends InspectionFolder {
  folders: InspectionFolder[]
}

/** 審査に並ぶ1件（Version か 離脱防止ポップアップ） */
export interface InspectionEntry {
  uid: string
  name: string
  kind: string
  status: string
  comment: string
  folder_name: string
  ab_test_uid: string
  ab_test_title: string
}

export const api = {
  folders: () => request<{ folders: Folder[] }>('GET', '/folders?per_page=200'),
  // 計測ツール・ASPアカウント一覧（一括タグ/基本情報で使う）
  aspAccounts: () =>
    request<{ asp_accounts: { id: number; asp_name: string }[] }>('GET', '/teams/asp_accounts'),
  // 一括タグ設定（/teams/tags）
  bulkTags: () => request<{ bulk_tags: BulkTag[] }>('GET', '/bulk_tags'),
  createBulkTag: () => request<{ bulk_tag: BulkTag }>('POST', '/bulk_tags'),
  updateBulkTag: (uid: string, patch: Record<string, unknown>) =>
    request<{ bulk_tag: BulkTag }>('PATCH', `/bulk_tags/${uid}`, patch),
  deleteBulkTag: (uid: string) => request<{ ok: boolean }>('DELETE', `/bulk_tags/${uid}`),
  // マジック置換（/articles/bulk_replaces）
  bulkReplaceTargets: (params: { abTestUids: readonly string[]; kind: string; q?: string }) =>
    request<{ pages: BulkReplacePage[]; message?: string }>(
      'GET',
      `/articles/bulk_replaces/targets?ab_test_uids=${encodeURIComponent(params.abTestUids.join(','))}` +
        `&kind=${encodeURIComponent(params.kind)}&q=${encodeURIComponent(params.q ?? '')}`,
    ),
  // メディア（商品検索フォーム）と商品（/teams/product_search_forms）
  mediaTemplates: () =>
    request<{ templates: { id: string; name: string }[] }>(
      'GET',
      '/teams/product_search_forms/templates',
    ),
  mediaList: () =>
    request<{ product_search_forms: Media[] }>('GET', '/teams/product_search_forms'),
  createMedia: (templateId: string, name: string) =>
    request<{ product_search_form: Media }>('POST', '/teams/product_search_forms', {
      template_id: templateId,
      name,
    }),
  updateMedia: (uid: string, patch: { name?: string; fields?: MediaField[] }) =>
    request<{ product_search_form: Media }>('PUT', `/teams/product_search_forms/${uid}`, patch),
  deleteMedia: (uid: string) =>
    request<null>('DELETE', `/teams/product_search_forms/${uid}`),
  products: () => request<{ products: Product[] }>('GET', '/teams/products'),
  createProduct: (body: Partial<Product>) =>
    request<{ product: Product }>('POST', '/teams/products', body),
  updateProduct: (uid: string, body: Partial<Product>) =>
    request<{ product: Product }>('PUT', `/teams/products/${uid}`, body),
  deleteProduct: (uid: string) => request<null>('DELETE', `/teams/products/${uid}`),
  importProductCsv: (csv: string) =>
    request<{ imported: number }>('POST', '/teams/products/import', { csv }),
  // 審査（/inspections）
  inspectionFolders: () =>
    request<{ groups: InspectionFolderGroup[]; ungrouped: InspectionFolder[] }>(
      'GET',
      '/inspections/folders',
    ),
  setInspectionTarget: (uid: string, on: boolean) =>
    request<{ uid: string; inspection_target: boolean }>('PUT', `/inspections/folders/${uid}`, {
      inspection_target: on,
    }),
  inspectionEntries: (params: { kind: string; status: string; q?: string }) =>
    request<{
      entries: InspectionEntry[]
      counts: Record<string, number>
      total: number
    }>(
      'GET',
      `/inspections/entries?kind=${encodeURIComponent(params.kind)}` +
        `&status=${encodeURIComponent(params.status)}&q=${encodeURIComponent(params.q ?? '')}`,
    ),
  setInspectionStatus: (uid: string, body: { kind: string; status: string; comment?: string }) =>
    request<{ entry: InspectionEntry }>('PUT', `/inspections/entries/${uid}`, body),
  bulkReplace: (body: {
    kind: string
    targets: { version_uid: string; value: string; indexes?: number[] }[]
    replacement: string
    tracking?: string
  }) => request<{ replaced: number; versions: number }>('POST', '/articles/bulk_replaces', body),
  createFolder: (name: string) => request<{ folder: Folder }>('POST', '/folders', { name }),
  /** フォルダのドメインを変える（'' ＝未設定 / 'system' ＝このシステムのドメイン / ホスト名） */
  setFolderDomain: (uid: string, domain: string) =>
    request<{ folder: Folder }>('PUT', `/folders/${uid}`, { domain }),
  /** クイックドメインを発行してフォルダに割り当てる（土台ドメインが未設定なら422） */
  issueQuickDomain: (uid: string) =>
    request<{ folder: Folder }>('POST', `/folders/${uid}/quick_domain`),
  folderDetail: (uid: string) =>
    request<{ folder: Folder; ab_tests: AbTest[] }>('GET', `/folders/${uid}`),
  toggleFavorite: (uid: string, isFavorite: boolean) =>
    request<{ folder: Folder }>('PATCH', `/folders/${uid}/favorite`, { is_favorite: isFavorite }),

  abTests: () => request<{ ab_tests: AbTest[] }>('GET', '/ab_tests?per_page=200'),
  createAbTest: (input: {
    title: string
    folder_id: number | null
    media_id: number | null
    editor_version: number
  }) =>
    request<{ ab_test: AbTest; article: { uid: string }; version: Version }>(
      'POST',
      '/ab_tests',
      input,
    ),
  abTest: (uid: string) => request<{ ab_test: AbTest }>('GET', `/ab_tests/${uid}`),
  /** Version数/ポップアップ数/中間ページ数。`ids` は ab_test.id のカンマ区切り */
  relationCounts: (folderUid: string, ids: readonly number[]) =>
    request<{ relation_counts: RelationCounts[] }>(
      'GET',
      `/folders/${folderUid}/ab_tests/relation_counts?ids=${ids.join(',')}`,
    ),
  /** 基本情報の部分更新（PUT /ab_tests/:uid） */
  updateAbTest: (uid: string, patch: Record<string, unknown>) =>
    request<{ ab_test: AbTest }>('PUT', `/ab_tests/${uid}`, patch),
  articles: (abTestUid: string) =>
    request<{ articles: { uid: string }[] }>('GET', `/ab_tests/${abTestUid}/articles`),
  addArticle: (abTestUid: string, name?: string) =>
    request<{ article: { uid: string } }>('POST', `/ab_tests/${abTestUid}/articles`, {
      ...(name === undefined ? {} : { name }),
    }),
  redirectPages: (abTestUid: string) =>
    request<{ redirect_pages: RedirectPage[] }>('GET', `/ab_tests/${abTestUid}/redirect_pages`),
  addRedirectPage: (abTestUid: string) =>
    request<{ redirect_page: RedirectPage }>('POST', `/ab_tests/${abTestUid}/redirect_pages/create`),
  updateRedirectPage: (uid: string, patch: { name?: string; url?: string; redirect_time?: number; referrer_type?: string }) =>
    request<{ redirect_page: RedirectPage }>('PATCH', `/redirect_pages/${uid}`, patch),
  addRedirectPageTag: (uid: string, documentProperty: 'head' | 'body') =>
    request<{ tag: RedirectPageTag }>('POST', `/redirect_pages/${uid}/tags`, { document_property: documentProperty }),
  updateRedirectPageTag: (uid: string, id: number, patch: { name?: string; body?: string }) =>
    request<{ tag: RedirectPageTag }>('PATCH', `/redirect_pages/${uid}/tags/${id}`, patch),
  deleteRedirectPageTag: (uid: string, id: number) =>
    request<undefined>('DELETE', `/redirect_pages/${uid}/tags/${id}`),
  deleteRedirectPage: (uid: string) =>
    request<void>('DELETE', `/redirect_pages/${uid}`),

  versions: (articleUid: string) =>
    request<{ versions: Version[]; distribution_total: number; distribution_warning: string | null }>(
      'GET',
      `/articles/${articleUid}/versions`,
    ),
  addVersion: (articleUid: string) =>
    request<{ version: Version }>('POST', `/articles/${articleUid}/versions`),
  saveVersion: (uid: string, patch: { html?: string; css?: string; name?: string }) =>
    request<{ version: Version }>('PUT', `/versions/${uid}`, patch),
  setRatio: (uid: string, ratio: number) =>
    request<{
      version: Version
      distribution_total: number
      distribution_warning: string | null
      adjusted_siblings?: ReadonlyArray<{ uid: string; distribution_ratio: number }>
    }>('PATCH', `/versions/${uid}/distribution`, { distribution_ratio: ratio }),
  publish: (uid: string) => request<{ version: Version }>('POST', `/versions/${uid}/publish`),
  duplicateVersion: (uid: string) =>
    request<{ version: Version }>('POST', `/versions/${uid}/duplicate`),
  duplicateVersionToArticle: (uid: string, targetArticleUid: string) =>
    request<{ version: Version }>('POST', `/versions/${uid}/duplicate_to`, {
      target_article_uid: targetArticleUid,
    }),
  deleteVersion: (uid: string) => request<void>('DELETE', `/versions/${uid}`),
  archiveVersion: (uid: string) =>
    request<{ version: Version }>('POST', `/versions/${uid}/archive`),
  unarchiveVersion: (uid: string) =>
    request<{ version: Version }>('POST', `/versions/${uid}/unarchive`),
  setDeviceTargets: (uid: string, targets: { sp: boolean; tablet: boolean; pc: boolean }) =>
    request<{ version: Version }>('PATCH', `/versions/${uid}/device_targets`, targets),
  /** 流入元別/OS別/キャリア別/時間別/日付別 の版ごと設定を保存（渡した項目だけ更新） */
  setVersionTargeting: (uid: string, patch: Record<string, unknown>) =>
    request<{ version: Version }>('PATCH', `/versions/${uid}/targeting`, patch),
  masterStyleSheet: (articleUid: string) =>
    request<{ master_style_sheet: MasterStyleSheet }>(
      'GET',
      `/articles/${articleUid}/master_style_sheet`,
    ),

  /** 離脱ポップアップ一覧 */
  exitPopups: (abTestUid: string) =>
    request<{ exit_popups: ExitPopup[] }>('GET', `/ab_tests/${abTestUid}/exit_popups`),
  /** 離脱ポップアップ作成 */
  createExitPopup: (abTestUid: string, body: Partial<ExitPopup> & { name: string }) =>
    request<{ exit_popup: ExitPopup }>('POST', `/ab_tests/${abTestUid}/exit_popups`, body),
  /** 離脱ポップアップ更新（割合変更時は2個なら adjusted_siblings で相方の追従結果が返る） */
  updateExitPopup: (abTestUid: string, popupUid: string, patch: Partial<ExitPopup>) =>
    request<{
      exit_popup: ExitPopup
      adjusted_siblings?: ReadonlyArray<{ uid: string; ratio: number }>
    }>('PUT', `/ab_tests/${abTestUid}/exit_popups/${popupUid}`, patch),
  /** 離脱ポップアップ削除 */
  deleteExitPopup: (abTestUid: string, popupUid: string) =>
    request<void>('DELETE', `/ab_tests/${abTestUid}/exit_popups/${popupUid}`),

  /** Meta広告の紐付け（媒体実績の取り込み元）。トークンは扱わない＝サーバーの環境変数のみ。 */
  setMetaLink: (abTestUid: string, body: { meta_level: string; meta_object_id: string }) =>
    request<{ ok: boolean; meta_level: string | null; meta_object_id: string | null }>(
      'PUT',
      `/ab_tests/${abTestUid}/meta_link`,
      body,
    ),
  /** 媒体実績（配信金額/IMP/媒体Click/媒体CV）を指定期間ぶん取り込む。 */
  metaSync: (abTestUid: string, body: { start_date: string; end_date: string }) =>
    request<{ ok: boolean; days: number; start_date: string; end_date: string }>(
      'POST',
      `/ab_tests/${abTestUid}/meta_sync`,
      body,
    ),

  /** 追尾型ポップアップ一覧 */
  followPopups: (abTestUid: string) =>
    request<{ follow_popups: FollowPopup[] }>('GET', `/ab_tests/${abTestUid}/follow_popups`),
  /** 追尾型ポップアップ作成 */
  createFollowPopup: (abTestUid: string, body: Partial<FollowPopup> & { name: string }) =>
    request<{ follow_popup: FollowPopup }>('POST', `/ab_tests/${abTestUid}/follow_popups`, body),
  /** 追尾型ポップアップ更新 */
  updateFollowPopup: (abTestUid: string, popupUid: string, patch: Partial<FollowPopup>) =>
    request<{ follow_popup: FollowPopup }>('PUT', `/ab_tests/${abTestUid}/follow_popups/${popupUid}`, patch),
  /** 追尾型ポップアップ削除 */
  deleteFollowPopup: (abTestUid: string, popupUid: string) =>
    request<void>('DELETE', `/ab_tests/${abTestUid}/follow_popups/${popupUid}`),

  /** レポートタブ（§10-3 `GET /ab_tests/:uid/reports?start_date&end_date`） */
  report: (abTestUid: string, query: string) =>
    request<ReportResponse>('GET', `/ab_tests/${abTestUid}/reports?${query}`),
  /** クリエイティブレポート（§10-3 `GET /ab_tests/:uid/creative_report`） */
  creativeReport: (abTestUid: string, query: string) =>
    request<ReportResponse>('GET', `/ab_tests/${abTestUid}/creative_report?${query}`),
  /** ヒートマップ比較（§10-3 `GET /ab_tests/:uid/heatmaps/comparisons`） */
  heatmaps: (abTestUid: string) =>
    request<{ heatmaps: HeatmapEntry[] }>('GET', `/ab_tests/${abTestUid}/heatmaps/comparisons`),
  /** ヒートマップの実測集計（計測タグ由来）。ラインの4モードぶんをVersionごとに返す。 */
  heatmapStats: (abTestUid: string, query: string) =>
    request<HeatmapStatsResponse>('GET', `/ab_tests/${abTestUid}/heatmaps/stats?${query}`),
  /**
   * ヒートマップ背景用の実LP。外部LP（自前のVersion HTMLを持たない）のときだけ使う。
   * まだ1度も計測タグが動いていない場合は404が返る（＝背景はサンプルのまま）。
   */
  externalPage: (abTestUid: string) =>
    request<{ html: string; final_url: string }>('GET', `/ab_tests/${abTestUid}/external_page`),

  media: () => request<{ ab_tests: unknown[] }>('GET', '/ab_tests?per_page=1'),
  reset: () => fetch('/__mock/reset', { method: 'POST' }).then((r) => r.json()),

  /** フォルダ名変更 */
  renameFolder: (uid: string, name: string) =>
    request<{ folder: Folder }>('PUT', `/folders/${uid}`, { name }),
  /** フォルダ削除 */
  deleteFolder: (uid: string) => request<void>('DELETE', `/folders/${uid}`),
  /** beyondページ削除 */
  deleteAbTest: (uid: string) => request<void>('DELETE', `/ab_tests/${uid}`),
  /** 通知設定取得 */
  notificationSettings: (scope: string) =>
    request<{ settings: NotificationSetting | null }>('GET', `/settings/internal_notifications/${scope}`),
  /** 通知設定更新 */
  updateNotificationSettings: (scope: string, patch: Partial<NotificationSetting>) =>
    request<{ settings: NotificationSetting | null }>('PUT', `/settings/internal_notifications/${scope}`, patch),
  /** 現在のユーザー */
  currentUser: () => request<{ user: User | null }>('GET', '/users/me'),
  /** ユーザー更新 */
  updateUser: (patch: { name?: string }) =>
    request<{ user: User | null }>('PUT', '/users/me', patch),
  /** チームメンバー一覧 */
  teamMembers: () => request<{ members: Member[] }>('GET', '/teams/members'),
  /** レポート除外追加 */
  /** Slack連携の状態（未設定 / 未連携 / 連携済み） */
  slackStatus: () =>
    request<{
      configured: boolean
      connected: boolean
      team_name: string | null
      redirect_uri: string
    }>('GET', '/slack/status'),
  /** 送り先に選べるチャンネル */
  slackChannels: () =>
    request<{ channels: { id: string; name: string }[] }>('GET', '/slack/channels'),
  /** 連携を解除 */
  disconnectSlack: () => request<void>('DELETE', '/slack'),
  /** 外部連携の資格情報の状態（値そのものは返らない） */
  integrations: () =>
    request<{
      slack: { configured: boolean; from_env: boolean; has_saved: boolean }
      chatwork: { configured: boolean; from_env: boolean; has_saved: boolean }
    }>('GET', '/integrations'),
  /** 資格情報を保存（渡した項目だけ更新する） */
  saveIntegration: (patch: {
    slack_client_id?: string
    slack_client_secret?: string
    chatwork_api_token?: string
  }) => request<void>('PUT', '/integrations', patch),
  /** 入れた資格情報を消す */
  clearIntegration: (service: 'slack' | 'chatwork') =>
    request<void>('DELETE', `/integrations/${service}`),
  /** タスクをその場で1回実行して通知を送る */
  runTaskNow: (input: {
    name: string
    span: string
    target: { service: 'slack' | 'chatwork'; id: string }
  }) =>
    request<{ ok: boolean }>('POST', '/notify/run', {
      name: input.name,
      span: input.span,
      service: input.target.service,
      destination_id: input.target.id,
    }),
  /** 通知を試し送りする */
  testNotify: (target: { service: 'slack' | 'chatwork'; id: string }) =>
    request<{ ok: boolean }>('POST', '/notify/test', {
      service: target.service,
      destination_id: target.id,
    }),
  /** チャットワーク連携の状態（トークンが入っているか） */
  chatworkStatus: () => request<{ configured: boolean }>('GET', '/chatwork/status'),
  /** 送り先に選べる部屋 */
  chatworkRooms: () =>
    request<{ rooms: { id: number; name: string; type: string }[] }>('GET', '/chatwork/rooms'),
  /** 画面のテーマカラー */
  themeColor: () => request<{ accent: string }>('GET', '/settings/theme'),
  saveThemeColor: (accent: string) =>
    request<{ accent: string }>('PUT', '/settings/theme', { accent }),
  /** レポート除外の一覧（除外アクセス数つき） */
  reportExclusions: () =>
    request<{ report_exclusions: ReportExclusionEntry[] }>('GET', '/report-exclusions'),
  addReportExclusion: (input: {
    conditions: readonly {
      kind: ExclusionKind
      matchType: ExclusionMatch
      value: string
      join: ExclusionJoin
    }[]
    isWhitelist: boolean
    reason?: string
  }) =>
    request<{ report_exclusion: ReportExclusionEntry }>('POST', '/report-exclusions', {
      conditions: input.conditions.map((c) => ({
        kind: c.kind,
        match_type: c.matchType,
        value: c.value,
        join: c.join,
      })),
      is_whitelist: input.isWhitelist,
      ...(input.reason !== undefined ? { reason: input.reason } : {}),
    }),
  /** リクエスト数の集計（レポート除外画面の下段） */
  exclusionRequests: (query: string) =>
    request<ExclusionRequestStats>('GET', `/report-exclusions/requests?${query}`),
  /** レポート除外削除 */
  deleteReportExclusion: (uid: string) => request<void>('DELETE', `/report-exclusions/${uid}`),
  /** 登録済みドメイン一覧（フォルダのドメイン変更で選ぶ） */
  domains: () => request<{ domains: DomainEntry[] }>('GET', '/teams/domains'),
  /** クイックドメインの土台（'' ＝未設定） */
  quickDomain: () => request<{ quick_domain: { base: string } }>('GET', '/teams/quick_domain'),
  setQuickDomain: (base: string) =>
    request<{ quick_domain: { base: string } }>('PUT', '/teams/quick_domain', { base }),
  /** ドメイン追加 */
  addDomain: (host: string) =>
    request<{ domain: DomainEntry }>('POST', '/teams/domains', { host }),
  /** タスク作成 */
  createTask: (input: {
    title: string
    description?: string
    schedule?: { kind: string; hour: string; minute: string; weekdays: readonly number[] }
    span?: string
    notify?: { service: 'slack' | 'chatwork'; destination_id: string } | null
  }) => request<{ task: Task }>('POST', '/tasks', input),
  /** タスク更新 */
  updateTask: (uid: string, patch: { status?: string; title?: string }) =>
    request<{ task: Task }>('PUT', `/tasks/${uid}`, patch),
  /** タスク一覧 */
  listTasks: () => request<{ tasks: Task[] }>('GET', '/tasks'),
  /** SB AI 会話一覧 */
  sbAiConversations: () =>
    request<{ conversations: SbAiConversation[] }>('GET', '/sb_ai/conversations'),
  /** SB AI 会話作成 */
  sbAiCreateConversation: () =>
    request<{ conversation: SbAiConversation }>('POST', '/sb_ai/conversations'),
  /** SB AI メッセージ送信 */
  sbAiSendMessage: (conversationUid: string, content: string) =>
    request<{ messages: SbAiMessage[] }>('POST', `/sb_ai/conversations/${conversationUid}/messages`, {
      content,
    }),

  /** Meta実データ連携（指示⑤⑧）。env未設定なら configured:false */
  metaStatus: () => request<{ configured: boolean }>('GET', '/meta/status'),
  metaInsights: (query: string) =>
    request<MetaInsightsResponse>('GET', `/meta/insights?${query}`),
  /** 外部連携画面のMeta広告アカウント一覧（指示⑦） */
  metaAdAccounts: () => request<MetaAdAccountsResponse>('GET', '/meta/adaccounts'),
}

/** 外部連携: Meta広告アカウント1件 */
export interface MetaAdAccount {
  account_id: string
  name: string
  account_status: number
  currency: string
  created_date: string
}

export interface MetaAdAccountsResponse {
  configured: boolean
  accounts: MetaAdAccount[]
  error?: string
}

/** 離脱ポップアップ（指示80） */
export interface ExitPopup {
  id: number
  uid: string
  ab_test_id: number
  name: string
  ratio: number
  enabled: boolean
  preset_id: string | null
  visit_count: string
  phone_number: string
  /** クリック時の遷移先URL（計測ON時は sb_tracking=true 付き・画像リンクと同じ規約） */
  link_url: string
  /** 遷移先を新しいタブで開くか（'_blank' / '_self'） */
  link_target: string
  /** 計測用URL（クリックでビーコン発火・複数可・画像の data-tracking-urls と同じ） */
  tracking_urls: string[]
  animation: string
  delay_seconds: number
  scroll_trigger: boolean
  scroll_position: number
  countdown_trigger: boolean
  countdown_seconds: number
  back_button_trigger: boolean
  exit_trigger: boolean
  position_x: number
  position_y: number
  device_sp: boolean
  device_tablet: boolean
  device_pc: boolean
  html: string
  javascript: string
  head_tag: string
  body_tag: string
  /** 指示176: ポップの種別。'exit'=離脱防止（既定・離脱意図で発動）/
   *  'instant'=表示直後（LPを開いた直後にオーバーレイ表示）。未設定は 'exit' 扱い。 */
  popup_kind?: 'exit' | 'instant'
  /** 指示172: ポップを触ったときの動作。'link'=遷移先URLへ移動（既定）/
   *  'close'=LPに戻る（ポップを閉じて元の位置へ・×と同じ）。未設定は 'link' 扱い。 */
  link_action?: 'link' | 'close'
}

/** 追尾型ポップアップ（指示85） */
export interface FollowPopup {
  id: number
  uid: string
  ab_test_id: number
  name: string
  enabled: boolean
  preset_id: string | null
  position: 'top' | 'bottom' | 'bottom-right' | 'bottom-left'
  show_after_scroll: number
  show_close_button: boolean
  animation: string
  device_sp: boolean
  device_tablet: boolean
  device_pc: boolean
  html: string
  javascript: string
  css: string
}

/** 中間ページ（redirect page・指示⑮） */
export interface RedirectPage {
  id: number
  uid: string
  ab_test_id: number
  name: string
  url: string
  weight: number
  enabled: boolean
  redirect_time?: number
  referrer_type?: 'version' | 'redirect_page'
  /** 中間ページタグ設定（名前付きの HEAD / BODY のタグ） */
  tags?: RedirectPageTag[]
}

/** 中間ページタグ設定の1件 */
export interface RedirectPageTag {
  id: number
  name: string
  document_property: 'head' | 'body'
  body: string
}

/** Meta広告のアカウント集計KPI（実取得） */
export interface MetaKpi {
  ad_cost: number
  pv: number
  click: number
  media_click: number
  cv: number
  ctr: number | null
  roas: number | null
}

export interface MetaInsightsResponse {
  configured: boolean
  kpi: MetaKpi | null
  error?: string
}

/** チームメンバー */
export interface Member {
  id: number
  uid: string
  name: string
  email: string
  role: string
  team_id: number
}

/** ユーザー */
export interface User {
  id: number
  uid: string
  name: string
  email: string
  public_api_key: string | null
  current_team_id: number
}

/** 通知設定 */
export interface NotificationSetting {
  scope: string
  cv_notify: boolean
  daily_report: boolean
  ad_alert: boolean
}

/** タスク */
export interface Task {
  id: number
  uid: string
  title: string
  /** 最後に実行した分（JST）。未実行なら null */
  last_run_slot?: string | null
  last_run_status?: 'ok' | 'failed' | null
  last_run_error?: string | null
  assignee_member_id: number | null
  status: string
  due_at: string | null
  created_at: number
}

/** ドメイン */
export interface DomainEntry {
  id: number
  uid: string
  host: string
  status: string
  ssl: boolean
  /** quick＝クイックドメイン（自動発行） / custom＝手で登録した独自ドメイン */
  kind?: 'quick' | 'custom'
}

/** レポート除外 */
/**
 * レポート除外（実物の「アクセス拒否」タブ）。
 * 選択肢は実物のプルダウンを開いて確認したもの（2026-09-08）。
 */
export type ExclusionKind = 'email' | 'ip' | 'referer' | 'param' | 'team'
export type ExclusionMatch = 'exact' | 'partial' | 'prefix' | 'suffix'
export type ExclusionJoin = 'and' | 'or'

export interface ExclusionCondition {
  kind: ExclusionKind
  match_type: ExclusionMatch
  value: string
  /** 次の行との繋ぎ方。最後の行では使わない */
  join: ExclusionJoin
}

export interface ReportExclusionEntry {
  id: number
  uid: string
  /** 除外リンクの合言葉。uidは連番で推測できるので、リンクにはこちらを使う */
  exclude_token: string
  /** 実物は「＋複数条件を組み合わせる」で行を増やせるので、1件が複数条件を持つ */
  conditions: readonly ExclusionCondition[]
  is_whitelist: boolean
  /** 除外アクセス数。記録が無ければ null（実物も「―」） */
  excluded_count: number | null
  reason: string
}

/** リクエスト数の集計（リファラ / ソースIP / パラメータ） */
export interface ExclusionRequestStats {
  period: { start_date: string; end_date: string }
  total: number
  referers: readonly { value: string; count: number }[]
  ips: readonly { value: string; count: number }[]
  params: readonly { value: string; count: number }[]
}

/** SB AI 会話 */
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

/** 媒体ロスターはダッシュボードAPIに無いので専用に取る */
export async function fetchMedia(): Promise<Media[]> {
  const res = await fetch(`${BASE}/teams/media`)
  if (!res.ok) throw new Error(`媒体リストの取得に失敗しました (${res.status})`)
  return ((await res.json()) as { media: Media[] }).media
}
