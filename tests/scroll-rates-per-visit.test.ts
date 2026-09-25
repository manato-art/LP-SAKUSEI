/**
 * FVER / SVER / FSVER / OAR は「1人ずつ、その人の画面で」数える（2026-09-25・数値面分析テスト）。
 *
 * 画面1枚ぶんの幅（fv）と最初の計測リンクの位置（offer）は、見た人の端末（画面の高さ・LPの横幅）で変わる。
 * 以前は行ごとに「最後に届いた fv / offer」を1つだけ持ち、全員の離脱位置・到達をそれで数え直していた。
 * スマホとPCが混ざると、PCの人の離脱をスマホの画面幅で数える＝全端末のFVER・OARがずれていた
 * （本番と同じLPで、スマホだけ・PCだけなら合うのに、全端末だとずれるのを実測で確認）。
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { getJson, postJson, resetStore, startTestServer, type TestServer } from './helpers/server.ts'

let server: TestServer

const RANGE = 'start_date=2026-01-01&end_date=2026-12-31'

interface Kpi {
  entity_uid?: string
  hm_pv: number
  fver: number | null
  sver: number | null
  fsver: number | null
  oar: number | null
}

async function setup(): Promise<{ uid: string; version: string }> {
  const created = await postJson<{ ab_test: { uid: string } }>(`${server.api}/ab_tests`, {
    title: '1人ずつ数える確認用',
    media_id: 1,
  })
  const uid = created.json.ab_test.uid
  const report = await getJson<{ rows: Kpi[] }>(`${server.api}/ab_tests/${uid}/reports?${RANGE}`)
  return { uid, version: report.rows[0]?.entity_uid ?? '' }
}

async function track(uid: string, payload: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${server.baseUrl}/lp/${uid}/__track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  await res.text()
}

const reach = (upTo: number): number[] => Array.from({ length: 10 }, (_, i) => (i <= upTo ? 1 : 0))

beforeEach(async () => {
  if (server === undefined) server = await startTestServer()
  resetStore()
})

afterAll(() => server?.close())

describe('画面の大きさが違う人が混ざっても、1人ずつその人の画面で数える', () => {
  it('PC（画面4バンド）とスマホ（画面2バンド）が混ざったときのFVER・SVER・OAR', async () => {
    const { uid, version } = await setup()
    // PC: 画面は4バンドぶん。下端がバンド3のまま離れた＝最初の画面で離脱。ボタンはバンド5で、そこまで見ていない
    await track(uid, { event: 'heatmap', version, bands: 10, rb: 1, fv: 4, offer: 5, reach: reach(3), exit_band: 3 })
    // スマホ: 画面は2バンドぶん。バンド3（ボタンの位置）まで見てから戻り、バンド1で離れた＝最初の画面で離脱
    await track(uid, { event: 'heatmap', version, bands: 10, rb: 1, fv: 2, offer: 3, reach: reach(3), exit_band: 1 })

    const report = await getJson<{ rows: Kpi[]; totals: Kpi }>(`${server.api}/ab_tests/${uid}/reports?${RANGE}`)
    const row = report.rows.find((r) => r.entity_uid === version)
    for (const kpi of [row, report.totals]) {
      expect(kpi?.hm_pv).toBe(2)
      // 2人とも最初の画面で離脱（最後に届いたスマホの画面幅でPCの人を数えると、PCの人は2画面目に入ってしまう）
      expect(kpi?.fver).toBe(1)
      expect(kpi?.sver).toBe(0)
      expect(kpi?.fsver).toBe(1)
      // ボタンまで見たのはスマホの人だけ（PCの人のボタンはバンド5）
      expect(kpi?.oar).toBe(0.5)
    }
  })

  it('広告ごとの行も1人ずつ数える', async () => {
    const { uid, version } = await setup()
    const params = ['utm_source=fb']
    await track(uid, { event: 'heatmap', version, bands: 10, rb: 1, fv: 4, offer: 5, reach: reach(3), exit_band: 3, params })
    await track(uid, { event: 'heatmap', version, bands: 10, rb: 1, fv: 2, offer: 3, reach: reach(3), exit_band: 1, params })

    const report = await getJson<{ rows: (Kpi & { children: (Kpi & { name: string })[] })[] }>(
      `${server.api}/ab_tests/${uid}/reports?${RANGE}`,
    )
    const child = report.rows.find((r) => r.entity_uid === version)?.children.find((c) => c.name === 'utm_source=fb')
    expect(child?.fver).toBe(1)
    expect(child?.oar).toBe(0.5)
  })

  it('ボタンが無いLP（offer が来ない）ではOARは「-」のまま', async () => {
    const { uid, version } = await setup()
    await track(uid, { event: 'heatmap', version, bands: 10, rb: 1, fv: 4, offer: -1, reach: reach(3), exit_band: 3 })
    const report = await getJson<{ totals: Kpi }>(`${server.api}/ab_tests/${uid}/reports?${RANGE}`)
    expect(report.totals.fver).toBe(1)
    expect(report.totals.oar).toBeNull()
  })
})
