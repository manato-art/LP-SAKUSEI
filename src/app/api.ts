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

  media: () => request<{ ab_tests: unknown[] }>('GET', '/ab_tests?per_page=1'),
  reset: () => fetch('/__mock/reset', { method: 'POST' }).then((r) => r.json()),
}

/** 媒体ロスターはダッシュボードAPIに無いので専用に取る */
export async function fetchMedia(): Promise<Media[]> {
  const res = await fetch(`${BASE}/teams/media`)
  if (!res.ok) throw new Error(`媒体リストの取得に失敗しました (${res.status})`)
  return ((await res.json()) as { media: Media[] }).media
}
