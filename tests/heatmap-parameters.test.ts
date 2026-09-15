/**
 * ヒートマップの広告パラメータ絞り込み（2026-09-15・実物の採取に合わせて実装）。
 *
 * 実物（`/ab_tests/:uid/reports/lp?tab=heatmap`）の左のVersion一覧には、
 * そのVersionで実際に来た `utm_*` がチェックボックスで並び（`_paramsOption_`）、
 * 何も選んでいないカードには「全パラメータ合算」と出る（`_noParam_`）。
 * 採取物: capture/clean/ab_tests__UID__reports__lp/heatmap-params-expanded/
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { getJson, postJson, resetStore, startTestServer, type TestServer } from './helpers/server.ts'

let server: TestServer

interface StatsResponse {
  versions: { version_uid: string; pv: number; param?: string }[]
  parameters: { version_uid: string; param: string; pv: number }[]
}

const RANGE = 'start_date=2000-01-01&end_date=2099-12-31'

async function track(uid: string, payload: Record<string, unknown>): Promise<void> {
  await fetch(`${server.baseUrl}/lp/${uid}/__track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

async function createAbTest(): Promise<string> {
  const created = await postJson<{ ab_test: { uid: string } }>(`${server.api}/ab_tests`, {
    title: 'パラメータ確認用',
    media_id: 1,
  })
  return created.json.ab_test.uid
}

beforeEach(async () => {
  if (server === undefined) server = await startTestServer()
  resetStore()
})

afterAll(() => server?.close())

describe('ヒートマップの広告パラメータ', () => {
  it('来たパラメータをPVの多い順に返す', async () => {
    const uid = await createAbTest()
    await track(uid, { event: 'heatmap', bands: 4, reach: [1, 1, 0, 0], params: ['utm_source=fb', 'utm_medium=paid'] })
    await track(uid, { event: 'heatmap', bands: 4, reach: [1, 0, 0, 0], params: ['utm_source=fb'] })

    const stats = await getJson<StatsResponse>(`${server.api}/ab_tests/${uid}/heatmaps/stats?${RANGE}`)
    expect(stats.parameters.map((p) => `${p.param}:${p.pv}`)).toEqual(['utm_source=fb:2', 'utm_medium=paid:1'])
  })

  it('合算（パラメータ指定なし）は1回の表示を1PVとして数える', async () => {
    const uid = await createAbTest()
    await track(uid, { event: 'heatmap', bands: 4, reach: [1, 1, 0, 0], params: ['utm_source=fb', 'utm_medium=paid'] })

    const stats = await getJson<StatsResponse>(`${server.api}/ab_tests/${uid}/heatmaps/stats?${RANGE}`)
    expect(stats.versions[0]?.pv).toBe(1)
  })

  it('param を指定すると、そのパラメータで来た表示だけを集計する', async () => {
    const uid = await createAbTest()
    await track(uid, { event: 'heatmap', bands: 4, reach: [1, 1, 1, 1], params: ['utm_source=fb'] })
    await track(uid, { event: 'heatmap', bands: 4, reach: [1, 0, 0, 0], params: ['utm_source=ig'] })

    const all = await getJson<StatsResponse>(`${server.api}/ab_tests/${uid}/heatmaps/stats?${RANGE}`)
    const fb = await getJson<StatsResponse>(
      `${server.api}/ab_tests/${uid}/heatmaps/stats?${RANGE}&param=${encodeURIComponent('utm_source=fb')}`,
    )
    expect(all.versions[0]?.pv).toBe(2)
    expect(fb.versions[0]?.pv).toBe(1)
    expect(fb.versions[0]?.param).toBe('utm_source=fb')
  })

  it('utm_ で始まらないパラメータは受け取らない（個人情報が紛れ得るため）', async () => {
    const uid = await createAbTest()
    await track(uid, { event: 'heatmap', bands: 4, params: ['email=a@b.test', 'utm_source=fb'] })

    const stats = await getJson<StatsResponse>(`${server.api}/ab_tests/${uid}/heatmaps/stats?${RANGE}`)
    expect(stats.parameters.map((p) => p.param)).toEqual(['utm_source=fb'])
  })

  it('パラメータの無いLPでは一覧が空になる（「パラメーターなし」の状態）', async () => {
    const uid = await createAbTest()
    await track(uid, { event: 'heatmap', bands: 4, reach: [1, 0, 0, 0] })

    const stats = await getJson<StatsResponse>(`${server.api}/ab_tests/${uid}/heatmaps/stats?${RANGE}`)
    expect(stats.parameters).toEqual([])
    expect(stats.versions[0]?.pv).toBe(1)
  })
})
