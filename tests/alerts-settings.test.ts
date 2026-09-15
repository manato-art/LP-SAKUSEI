/**
 * 異常のお知らせの設定（2026-09-15）。
 * アカウント設定 → 通知設定 から決める。
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { getJson, resetStore, sendJson, startTestServer, type TestServer } from './helpers/server.ts'

let server: TestServer
const URL_PATH = (): string => `${server.api}/settings/alerts`

interface Res {
  settings: {
    enabled: boolean
    cv_silent_hours: number
    cpa_limit: number
    notify: { service: string; destination_id: string } | null
  }
}

beforeEach(async () => {
  if (server === undefined) server = await startTestServer()
  resetStore()
})

afterAll(() => server?.close())

describe('異常のお知らせの設定', () => {
  it('はじめは切（送り先を決めるまで鳴らさない）', async () => {
    const res = await getJson<Res>(URL_PATH())
    expect(res.settings.enabled).toBe(false)
    expect(res.settings.notify).toBeNull()
  })

  it('保存すると残る', async () => {
    await sendJson('PUT', URL_PATH(), {
      enabled: true,
      cv_silent_hours: 12,
      cpa_limit: 8000,
      notify: { service: 'slack', destination_id: 'C123' },
    })
    const res = await getJson<Res>(URL_PATH())
    expect(res.settings).toMatchObject({
      enabled: true,
      cv_silent_hours: 12,
      cpa_limit: 8000,
      notify: { service: 'slack', destination_id: 'C123' },
    })
  })

  it('時間は1〜72の間だけ受ける（0だと鳴りっぱなしになる）', async () => {
    const zero = await sendJson('PUT', URL_PATH(), { cv_silent_hours: 0 })
    expect(zero.status).toBe(422)
    const huge = await sendJson('PUT', URL_PATH(), { cv_silent_hours: 999 })
    expect(huge.status).toBe(422)
  })

  it('CPAの上限に負の数は受けない', async () => {
    const res = await sendJson('PUT', URL_PATH(), { cpa_limit: -1 })
    expect(res.status).toBe(422)
  })

  it('知らない送り先は受けない', async () => {
    const res = await sendJson('PUT', URL_PATH(), {
      notify: { service: 'email', destination_id: 'x@example.test' },
    })
    expect(res.status).toBe(422)
  })

  it('送り先を空にできる（お知らせを止める）', async () => {
    await sendJson('PUT', URL_PATH(), {
      enabled: true,
      notify: { service: 'slack', destination_id: 'C1' },
    })
    await sendJson('PUT', URL_PATH(), { notify: null })
    const res = await getJson<Res>(URL_PATH())
    expect(res.settings.notify).toBeNull()
  })
})
