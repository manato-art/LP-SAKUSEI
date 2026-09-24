/**
 * レポートの細かい食い違い（2026-09-24 点検19）。
 *
 *  - デイリーレポートの行の FVER/SVER/FSVER/OAR が常に「-」だった（日ごとにスクロールの記録を足していなかった）
 *  - レポート設定の「クリエイティブ」を切っても何も変わらず、「Branch Operation」を切るとクリエイティブの一覧まで消えた
 *    → それぞれ自分の一覧だけを決める（Branch Operation＝children、クリエイティブ＝creative_children）
 *  - クリエイティブの「配信中 / 停止中」でグラフを絞れるよう、Version ごとの日別（LP側）も返す
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { getJson, postJson, resetStore, sendJson, startTestServer, type TestServer } from './helpers/server.ts'

let server: TestServer
const RANGE = 'start_date=2026-01-01&end_date=2026-12-31'

interface Row {
  entity_uid: string
  children?: { name: string }[]
  creative_children?: { name: string }[]
  daily_lp?: { date: string; pv: number; click: number; cv: number }[]
}
interface Report {
  rows: Row[]
  daily: { date: string; pv: number; fver: number | null }[]
}

async function track(uid: string, payload: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${server.baseUrl}/lp/${uid}/__track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  await res.text()
}

async function setup(): Promise<{ uid: string; version: string }> {
  const created = await postJson<{ ab_test: { uid: string } }>(`${server.api}/ab_tests`, {
    title: '日別と一覧の確認用',
    media_id: 1,
  })
  const uid = created.json.ab_test.uid
  const report = await getJson<Report>(`${server.api}/ab_tests/${uid}/reports?${RANGE}`)
  return { uid, version: report.rows[0]?.entity_uid ?? '' }
}

beforeEach(async () => {
  if (server === undefined) server = await startTestServer()
  resetStore()
})

afterAll(() => server?.close())

describe('デイリーレポートの行', () => {
  it('日ごとの FVER もスクロールの記録から出す', async () => {
    const { uid, version } = await setup()
    await track(uid, { event: 'pv', version })
    await track(uid, { event: 'heatmap', version, bands: 4, reach: [1, 0, 0, 0], exit_band: 0, fv: 1 })
    const report = await getJson<Report>(`${server.api}/ab_tests/${uid}/reports?${RANGE}`)
    const day = report.daily.find((d) => d.pv > 0)
    expect(day?.fver).toBe(1)
  })

  it('Version で絞った日別にも出す', async () => {
    const { uid, version } = await setup()
    await track(uid, { event: 'pv', version })
    await track(uid, { event: 'heatmap', version, bands: 4, reach: [1, 1, 1, 1], exit_band: 3, fv: 1 })
    const report = await getJson<Report>(`${server.api}/ab_tests/${uid}/reports?${RANGE}&version=${version}`)
    const day = report.daily.find((d) => d.pv > 0)
    expect(day?.fver).toBe(0)
  })
})

describe('レポート設定の列はそれぞれ自分の一覧だけを決める', () => {
  it('クリエイティブを切るとクリエイティブの一覧から消え、Branch Operation には残る', async () => {
    const { uid, version } = await setup()
    await track(uid, { event: 'pv', version, params: ['utm_source=fb', 'utm_term=abc'] })
    await sendJson('PUT', `${server.api}/ab_tests/${uid}/parameter_scopes`, {
      parameter_scopes: [{ name: 'utm_term', creative: false }],
    })
    const report = await getJson<Report>(`${server.api}/ab_tests/${uid}/reports?${RANGE}`)
    const row = report.rows.find((r) => r.entity_uid === version)
    expect(row?.children?.map((c) => c.name).sort()).toEqual(['utm_source=fb', 'utm_term=abc'])
    expect(row?.creative_children?.map((c) => c.name)).toEqual(['utm_source=fb'])
  })

  it('Branch Operation を切ってもクリエイティブの一覧には残る', async () => {
    const { uid, version } = await setup()
    await track(uid, { event: 'pv', version, params: ['utm_term=abc'] })
    await sendJson('PUT', `${server.api}/ab_tests/${uid}/parameter_scopes`, {
      parameter_scopes: [{ name: 'utm_term', branch_operation: false }],
    })
    const report = await getJson<Report>(`${server.api}/ab_tests/${uid}/reports?${RANGE}`)
    const row = report.rows.find((r) => r.entity_uid === version)
    expect(row?.children).toEqual([])
    expect(row?.creative_children?.map((c) => c.name)).toEqual(['utm_term=abc'])
  })
})

describe('Version ごとの日別（LP側）', () => {
  it('表示・クリック・CV がある日だけ返す', async () => {
    const { uid, version } = await setup()
    await track(uid, { event: 'pv', version })
    await track(uid, { event: 'click', version })
    const report = await getJson<Report>(`${server.api}/ab_tests/${uid}/reports?${RANGE}`)
    const daily = report.rows.find((r) => r.entity_uid === version)?.daily_lp ?? []
    expect(daily).toHaveLength(1)
    expect(daily[0]).toMatchObject({ pv: 1, click: 1, cv: 0 })
  })
})
