/**
 * 到達の物差しの新旧（2026-09-24 点検30）。
 *
 * 新しい計測タグは rb:1（画面の下端で到達を数えた）を付けて送る。
 * 外部LPのブラウザに古いタグが残っていることがあるので、rb の無い送信もそのまま受ける。
 * 画面が「この期間には古い数え方の記録が混ざっている」と言えるよう、古いぶんの PV を返す。
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { getJson, postJson, resetStore, startTestServer, type TestServer } from './helpers/server.ts'

let server: TestServer

const RANGE = 'start_date=2026-01-01&end_date=2026-12-31'

async function track(uid: string, payload: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${server.baseUrl}/lp/${uid}/__track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  await res.text()
}

beforeEach(async () => {
  if (server === undefined) server = await startTestServer()
  resetStore()
})

afterAll(() => server?.close())

describe('到達の物差しの新旧', () => {
  it('古いタグ（rb 無し）と新しいタグ（rb:1）の両方を受け、古いぶんの PV を返す', async () => {
    const created = await postJson<{ ab_test: { uid: string } }>(`${server.api}/ab_tests`, {
      title: '物差し確認用',
      media_id: 1,
    })
    const uid = created.json.ab_test.uid
    await track(uid, { event: 'heatmap', bands: 4, reach: [1, 0, 0, 0] })
    await track(uid, { event: 'heatmap', bands: 4, reach: [1, 1, 0, 0], rb: 1 })
    await track(uid, { event: 'heatmap', bands: 4, reach: [1, 1, 1, 0], rb: 1 })

    const stats = await getJson<{ versions: { pv: number; legacy_pv: number }[] }>(
      `${server.api}/ab_tests/${uid}/heatmaps/stats?${RANGE}`,
    )
    expect(stats.versions[0]?.pv).toBe(3)
    expect(stats.versions[0]?.legacy_pv).toBe(1)
  })
})
