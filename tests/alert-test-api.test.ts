/**
 * お知らせのテストのAPI（2026-09-17・本人の依頼）。
 *
 *   POST /settings/alerts/test      … 見本を1通、決めた送り先すべてへ送る（お知らせが切でも送る＝テストなので）
 *   GET  /settings/alerts/coverage  … いま見張っている対象（読むだけ）
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const spy = vi.hoisted(() => ({
  sent: [] as { service: string; text: string }[],
  failing: new Set<string>(),
}))

vi.mock('../mock-server/notify.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../mock-server/notify.ts')>()
  return {
    ...actual,
    sendNotification: (service: string, _id: string, text: string): Promise<void> => {
      spy.sent.push({ service, text })
      return spy.failing.has(service)
        ? Promise.reject(new actual.NotifyError(`${service}へ送れませんでした（テスト）`, 'send_failed'))
        : Promise.resolve()
    },
  }
})

const { getJson, postJson, resetStore, startTestServer } = await import('./helpers/server.ts')
const { setState } = await import('../mock-server/store/store.ts')

let server: Awaited<ReturnType<typeof startTestServer>>

beforeAll(async () => {
  server = await startTestServer()
})

afterAll(async () => {
  await server.close()
})

beforeEach(() => {
  resetStore()
  spy.sent.length = 0
  spy.failing.clear()
})

function withDestinations(notify: { service: 'line' | 'chatwork' | 'slack'; destination_id: string }[], enabled = false): void {
  setState((s) => ({ ...s, alertSetting: { ...s.alertSetting, enabled, notify } }))
}

describe('見本を送る', () => {
  it('決めた送り先すべてへ1通ずつ送る（お知らせが切でも送る）', async () => {
    withDestinations([
      { service: 'line', destination_id: '' },
      { service: 'chatwork', destination_id: '123' },
    ])
    const res = await postJson<{ sent: number; failures: unknown[] }>(`${server.api}/settings/alerts/test`, {})
    expect(res.status).toBe(200)
    expect(res.json).toEqual({ sent: 2, failures: [] })
    expect(spy.sent.map((s) => s.service)).toEqual(['line', 'chatwork'])
    expect(spy.sent[0]?.text).toContain('【テスト】')
  })

  it('送り先が無ければ送らずに理由を返す', async () => {
    withDestinations([])
    const res = await postJson(`${server.api}/settings/alerts/test`, {})
    expect(res.status).toBe(422)
    expect(spy.sent).toHaveLength(0)
  })

  it('送れなかった送り先は、理由と一緒に返す（届かない原因が分かるように）', async () => {
    spy.failing.add('chatwork')
    withDestinations([
      { service: 'line', destination_id: '' },
      { service: 'chatwork', destination_id: '123' },
    ])
    const res = await postJson<{ sent: number; failures: { service: string; message: string }[] }>(`${server.api}/settings/alerts/test`, {})
    expect(res.json.sent).toBe(1)
    expect(res.json.failures).toEqual([{ service: 'chatwork', message: 'chatworkへ送れませんでした（テスト）' }])
  })

  it('見本を送っても「送った」記録（1日1通の合図）は増やさない（本物の知らせを止めない）', async () => {
    withDestinations([{ service: 'line', destination_id: '' }], true)
    await postJson(`${server.api}/settings/alerts/test`, {})
    const { getState } = await import('../mock-server/store/store.ts')
    expect(getState().alertSentSlots).toEqual([])
  })
})

describe('いま見張っている対象', () => {
  it('読むだけで返す', async () => {
    withDestinations([{ service: 'line', destination_id: '' }])
    const res = await getJson<{ enabled: boolean; destinations: number; cv_pages: string[]; pending_switches: number }>(
      `${server.api}/settings/alerts/coverage`,
    )
    expect(res).toMatchObject({ enabled: false, destinations: 1, cv_pages: [], pending_switches: 0 })
    expect(spy.sent).toHaveLength(0)
  })
})
