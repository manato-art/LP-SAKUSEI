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
}

export interface Version {
  id: number
  uid: string
  name: string
  distribution_ratio: number
  status: string
  archived?: boolean
  device_targets?: { sp: boolean; tablet: boolean; pc: boolean }
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
  sales: number
  gross_profit: number
  roas: number | null
  roi: number | null
  cvr: number | null
  cpa: number | null
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

export interface HeatmapEntry {
  id: number
  ab_test_uid: string
  version_uid: string
  type: 'click' | 'scroll'
  points: readonly { x: number; y: number; value: number }[]
  thumbnail_url: string | null
}

export const api = {
  folders: () => request<{ folders: Folder[] }>('GET', '/folders?per_page=200'),
  createFolder: (name: string) => request<{ folder: Folder }>('POST', '/folders', { name }),
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
  updateRedirectPage: (uid: string, patch: { name?: string; url?: string; redirect_time?: number }) =>
    request<{ redirect_page: RedirectPage }>('PATCH', `/redirect_pages/${uid}`, patch),

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
    request<{ version: Version; distribution_total: number; distribution_warning: string | null }>(
      'PATCH',
      `/versions/${uid}/distribution`,
      { distribution_ratio: ratio },
    ),
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
  masterStyleSheet: (articleUid: string) =>
    request<{ master_style_sheet: MasterStyleSheet }>(
      'GET',
      `/articles/${articleUid}/master_style_sheet`,
    ),

  /** レポートタブ（§10-3 `GET /ab_tests/:uid/reports?start_date&end_date`） */
  report: (abTestUid: string, query: string) =>
    request<ReportResponse>('GET', `/ab_tests/${abTestUid}/reports?${query}`),
  /** クリエイティブレポート（§10-3 `GET /ab_tests/:uid/creative_report`） */
  creativeReport: (abTestUid: string, query: string) =>
    request<ReportResponse>('GET', `/ab_tests/${abTestUid}/creative_report?${query}`),
  /** ヒートマップ比較（§10-3 `GET /ab_tests/:uid/heatmaps/comparisons`） */
  heatmaps: (abTestUid: string) =>
    request<{ heatmaps: HeatmapEntry[] }>('GET', `/ab_tests/${abTestUid}/heatmaps/comparisons`),

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
  addReportExclusion: (target: string, reason?: string) =>
    request<{ report_exclusion: ReportExclusionEntry }>('POST', '/report-exclusions', {
      target,
      ...(reason !== undefined ? { reason } : {}),
    }),
  /** レポート除外削除 */
  deleteReportExclusion: (uid: string) => request<void>('DELETE', `/report-exclusions/${uid}`),
  /** ドメイン追加 */
  addDomain: (host: string) =>
    request<{ domain: DomainEntry }>('POST', '/teams/domains', { host }),
  /** タスク作成 */
  createTask: (title: string) =>
    request<{ task: Task }>('POST', '/tasks', { title }),
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
}

/** レポート除外 */
export interface ReportExclusionEntry {
  id: number
  uid: string
  target: string
  reason: string
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
