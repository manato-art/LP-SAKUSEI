/**
 * 表示の遅さを受け取り、レポートに出す（2026-09-16・本人の依頼）。
 *
 * 計測タグが離脱時にヒートマップと一緒に送る `load` を記録し、
 * レポートのVersionの行ごとに「3秒以上かかった人の割合」と人数を返す。
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { getJson, postJson, resetStore, startTestServer, type TestServer } from './helpers/server.ts'
import { getState } from '../mock-server/store/store.ts'
import { toDateKey } from '../mock-server/store/metrics.ts'

let server: TestServer

beforeAll(async () => {
  server = await startTestServer()
})

afterAll(async () => {
  await server.close()
})

beforeEach(() => {
  resetStore()
})

async function createPage(): Promise<{ abTestUid: string; versionUid: string }> {
  const created = await postJson<{ ab_test: { uid: string } }>(`${server.api}/ab_tests`, {
    title: '表示速度の確認',
    media_id: 1,
  })
  const version = getState().versions.at(-1)
  if (version === undefined) throw new Error('Versionを作れませんでした')
  return { abTestUid: created.json.ab_test.uid, versionUid: version.uid }
}

async function leave(abTestUid: string, versionUid: string, load: unknown): Promise<void> {
  await fetch(`${server.baseUrl}/lp/${abTestUid}/__track`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ event: 'heatmap', version: versionUid, bands: 20, load }),
  })
}

describe('表示の遅さを受け取る', () => {
  it('ヒートマップと一緒に届いた読み込み時間を記録する', async () => {
    const { abTestUid, versionUid } = await createPage()
    await leave(abTestUid, versionUid, { ms: 800, done: 1 })
    await leave(abTestUid, versionUid, { ms: 4500, done: 1 })

    const stat = getState().pageSpeedStats.find((s) => s.version_uid === versionUid)
    expect(stat?.loaded.reduce((a, b) => a + b, 0)).toBe(2)
  })

  it('読み込み時間が無い・おかしいときは記録しない（ヒートマップは今までどおり積む）', async () => {
    const { abTestUid, versionUid } = await createPage()
    await leave(abTestUid, versionUid, undefined)
    await leave(abTestUid, versionUid, { ms: -5, done: 1 })

    expect(getState().pageSpeedStats).toEqual([])
    expect(getState().heatmapStats.find((h) => h.version_uid === versionUid && (h.param ?? '') === '')?.pv).toBe(2)
  })
})

describe('レポートに出す', () => {
  it('Versionの行ごとに、3秒以上かかった人の割合と人数を返す', async () => {
    const { abTestUid, versionUid } = await createPage()
    await leave(abTestUid, versionUid, { ms: 800, done: 1 })
    await leave(abTestUid, versionUid, { ms: 4500, done: 1 })
    await leave(abTestUid, versionUid, { ms: 3200, done: 0 })
    await leave(abTestUid, versionUid, { ms: 500, done: 0 })

    const today = toDateKey(new Date())
    const report = await getJson<{
      rows: { entity_uid: string; speed?: { slow_share: number | null; samples: number } }[]
    }>(`${server.api}/ab_tests/${abTestUid}/reports?start_date=${today}&end_date=${today}`)
    const row = report.rows.find((r) => r.entity_uid === versionUid)
    // 遅い: 4500(完了) + 3200(待って帰った) ／ 速い: 800 ／ 分からない: 500(3秒たたず帰った)
    expect(row?.speed).toEqual({ slow_share: 2 / 3, samples: 3 })
  })

  it('記録が無いVersionは割合を出さない', async () => {
    const { abTestUid, versionUid } = await createPage()
    const today = toDateKey(new Date())
    const report = await getJson<{
      rows: { entity_uid: string; speed?: { slow_share: number | null; samples: number } }[]
    }>(`${server.api}/ab_tests/${abTestUid}/reports?start_date=${today}&end_date=${today}`)
    expect(report.rows.find((r) => r.entity_uid === versionUid)?.speed).toEqual({ slow_share: null, samples: 0 })
  })
})
