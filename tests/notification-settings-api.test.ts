/**
 * 通知設定の保存口（2026-09-24 点検28）。
 * 動くスイッチは cv_digest / daily_digest（既定オフ）。送った記録（失敗の理由）も一緒に返す。
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { getJson, resetStore, sendJson, startTestServer, type TestServer } from './helpers/server.ts'
import { setState } from '../mock-server/store/store.ts'

let server: TestServer

beforeEach(async () => {
  if (server === undefined) server = await startTestServer()
  resetStore()
})

afterAll(() => server?.close())

interface Out {
  settings: { cv_digest?: boolean; daily_digest?: boolean }
  runs: { cv_last_error: string | null; daily_last_error: string | null }
}

describe('通知設定', () => {
  it('既定はどちらもオフ', async () => {
    const out = await getJson<Out>(`${server.api}/settings/internal_notifications/member`)
    expect(out.settings.cv_digest).toBe(false)
    expect(out.settings.daily_digest).toBe(false)
  })

  it('オンにして保存できる', async () => {
    const res = await sendJson<Out>('PUT', `${server.api}/settings/internal_notifications/member`, {
      cv_digest: true,
      daily_digest: true,
    })
    expect(res.json.settings).toMatchObject({ cv_digest: true, daily_digest: true })
  })

  it('送れなかった理由を返す（画面に出す）', async () => {
    setState((s) => ({ ...s, notificationRuns: { ...s.notificationRuns, cv_last_error: 'line: 上限です' } }))
    const out = await getJson<Out>(`${server.api}/settings/internal_notifications/member`)
    expect(out.runs.cv_last_error).toBe('line: 上限です')
  })
})

describe('通知設定の画面', () => {
  it('何もしないスイッチを残さない（広告アラートは「異常のお知らせ」に一本化）・動くスイッチには説明を付ける', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync('src/app/pages/account-settings.ts', 'utf8')
    expect(src).not.toContain("key: 'ad_alert'")
    expect(src).not.toContain("key: 'cv_notify'")
    expect(src).toContain("key: 'cv_digest'")
    expect(src).toContain("key: 'daily_digest'")
    expect(src).toContain('15分に1通までにまとめ')
    expect(src).toContain('毎朝9時（日本時間）')
  })
})
