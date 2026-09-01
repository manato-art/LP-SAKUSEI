/**
 * モックAPIクライアント（企画書 §10-1・localhost固定）。
 * 本番ドメインは登場させない（§3-2）。
 */
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
  articles: (abTestUid: string) =>
    request<{ articles: { uid: string }[] }>('GET', `/ab_tests/${abTestUid}/articles`),

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
  deleteVersion: (uid: string) => request<void>('DELETE', `/versions/${uid}`),

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
}

/** 媒体ロスターはダッシュボードAPIに無いので専用に取る */
export async function fetchMedia(): Promise<Media[]> {
  const res = await fetch(`${BASE}/teams/media`)
  if (!res.ok) throw new Error(`媒体リストの取得に失敗しました (${res.status})`)
  return ((await res.json()) as { media: Media[] }).media
}
