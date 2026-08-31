/**
 * 「基本情報」タブが叩くモックAPI（localhost固定・本番ドメインは登場させない・企画書 §3-2）。
 *
 * パスは実機の実測（`capture/clean/folders__UID__ab_tests__UID__edit/default/api-urls.json`）:
 *   GET /api/v1/ab_tests/:uid/edit
 *   GET /api/v1/medias
 *   GET /api/v1/affiliate_service_providers
 * 保存だけは採取時に押していないため未観測（Railsの `edit` に対応する PUT を使う）。
 */
import type { AbTestForEdit } from './basic-info-form.ts'

const API_BASE = '/api/v1'

export interface MediaOption {
  id: number
  name: string
}

async function requestJson<T>(method: 'GET' | 'PUT', path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const json = (await res.json().catch(() => null)) as ({ error?: { message?: string } } & T) | null
  if (!res.ok || json === null) {
    throw new Error(json?.error?.message ?? `${method} ${path} が失敗しました (${res.status})`)
  }
  return json
}

export const basicInfoApi = {
  abTestForEdit: (uid: string) =>
    requestJson<{ ab_test: AbTestForEdit }>('GET', `/ab_tests/${uid}/edit`),
  medias: () => requestJson<{ medias: MediaOption[] }>('GET', '/medias'),
  affiliateServiceProviders: () =>
    requestJson<{ affiliate_service_providers: string[] }>('GET', '/affiliate_service_providers'),
  update: (uid: string, payload: Record<string, unknown>) =>
    requestJson<{ ab_test: AbTestForEdit }>('PUT', `/ab_tests/${uid}`, payload),
}
