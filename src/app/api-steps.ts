/** ステップ（記事）の名前・色の変更と削除（2026-09-24） */
import { editorSessionHeaders } from './editor-session.ts'

export interface StepArticle {
  uid: string
  memo?: string
  color?: string
}

async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...editorSessionHeaders() },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    throw new Error(detail?.error?.message ?? `${method} ${path} が失敗しました (${res.status})`)
  }
  return (res.status === 204 ? undefined : await res.json()) as T
}

export const stepsApi = {
  update: (uid: string, patch: { memo?: string; color?: string }) =>
    send<{ article: StepArticle }>('PATCH', `/articles/${encodeURIComponent(uid)}`, patch),
  remove: (uid: string) => send<undefined>('DELETE', `/articles/${encodeURIComponent(uid)}`),
}
