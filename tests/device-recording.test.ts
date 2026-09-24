/**
 * 端末（スマホ / タブレット / PC）を記録する（2026-09-24 点検29）。
 *
 * 以前は端末を記録していなかったので、レポート上の「端末」で絞っても、
 * ヒートマップの SP / PC を切り替えても数字が変わらなかった（Version の出し分け設定で行を隠すだけ）。
 * 表示・クリック・CV・スクロールの記録を受けたとき、サーバーが User-Agent から端末を分けて数える。
 * 記録を始める前のデータには端末が無いので、端末で絞ったときは「いつから記録しているか」を返す。
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { getJson, postJson, resetStore, startTestServer, type TestServer } from './helpers/server.ts'
import { deviceOfUserAgent } from '../mock-server/lib/device.ts'

let server: TestServer
const RANGE = 'start_date=2026-01-01&end_date=2026-12-31'

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const IPAD =
  'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'

async function track(uid: string, ua: string, payload: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${server.baseUrl}/lp/${uid}/__track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': ua },
    body: JSON.stringify(payload),
  })
  await res.text()
}

interface Report {
  rows: { entity_uid: string; pv: number; click: number; cv: number }[]
  totals: { pv: number; click: number; cv: number; fver: number | null }
  daily: { pv: number }[]
  filtered_by: string[]
  device_since: string | null
}

beforeEach(async () => {
  if (server === undefined) server = await startTestServer()
  resetStore()
})

afterAll(() => server?.close())

async function createPage(): Promise<{ uid: string; version: string }> {
  const created = await postJson<{ ab_test: { uid: string } }>(`${server.api}/ab_tests`, {
    title: '端末の確認用',
    media_id: 1,
  })
  const uid = created.json.ab_test.uid
  const report = await getJson<Report>(`${server.api}/ab_tests/${uid}/reports?${RANGE}`)
  return { uid, version: report.rows[0]?.entity_uid ?? '' }
}

describe('User-Agent から端末を分ける', () => {
  it('iPhone はスマホ・iPad はタブレット・Mac は PC', () => {
    expect(deviceOfUserAgent(IPHONE)).toBe('sp')
    expect(deviceOfUserAgent(IPAD)).toBe('tablet')
    expect(deviceOfUserAgent(MAC)).toBe('pc')
    expect(deviceOfUserAgent('')).toBe('pc')
  })
})

describe('端末で絞ると数字が変わる', () => {
  it('表示・クリック・CV を端末ごとに数える', async () => {
    const { uid, version } = await createPage()
    await track(uid, IPHONE, { event: 'pv', version, vid: 'VISITOR-DEV-SP1' })
    await track(uid, IPHONE, { event: 'click', version, vid: 'VISITOR-DEV-SP1' })
    await track(uid, IPHONE, { event: 'cv', vid: 'VISITOR-DEV-SP1' })
    await track(uid, MAC, { event: 'pv', version })
    await track(uid, MAC, { event: 'pv', version })

    const all = await getJson<Report>(`${server.api}/ab_tests/${uid}/reports?${RANGE}`)
    const sp = await getJson<Report>(`${server.api}/ab_tests/${uid}/reports?${RANGE}&device=sp`)
    const pc = await getJson<Report>(`${server.api}/ab_tests/${uid}/reports?${RANGE}&device=pc`)
    expect(all.totals.pv).toBe(3)
    expect(sp.totals).toMatchObject({ pv: 1, click: 1, cv: 1 })
    expect(pc.totals).toMatchObject({ pv: 2, click: 0, cv: 0 })
    expect(sp.rows[0]).toMatchObject({ pv: 1, click: 1, cv: 1 })
    expect(pc.rows[0]).toMatchObject({ pv: 2 })
    expect(sp.daily.reduce((sum, d) => sum + d.pv, 0)).toBe(1)
    expect(sp.filtered_by).toEqual(['device'])
  })

  it('いつから端末を記録しているかを返す（まだ無ければ null）', async () => {
    const { uid, version } = await createPage()
    const before = await getJson<Report>(`${server.api}/ab_tests/${uid}/reports?${RANGE}&device=sp`)
    expect(before.device_since).toBeNull()
    await track(uid, IPHONE, { event: 'pv', version })
    const after = await getJson<Report>(`${server.api}/ab_tests/${uid}/reports?${RANGE}&device=sp`)
    expect(after.device_since).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('スクロールの記録も端末ごと（FVER も絞った端末のぶん）', async () => {
    const { uid, version } = await createPage()
    await track(uid, IPHONE, { event: 'heatmap', version, bands: 4, reach: [1, 0, 0, 0], exit_band: 0, fv: 1 })
    await track(uid, MAC, { event: 'heatmap', version, bands: 4, reach: [1, 1, 1, 1], exit_band: 3, fv: 1 })
    const sp = await getJson<Report>(`${server.api}/ab_tests/${uid}/reports?${RANGE}&device=sp`)
    const pc = await getJson<Report>(`${server.api}/ab_tests/${uid}/reports?${RANGE}&device=pc`)
    expect(sp.totals.fver).toBe(1)
    expect(pc.totals.fver).toBe(0)
  })
})

describe('ヒートマップを端末で分ける', () => {
  it('device を付けるとその端末の記録だけ。どの端末に何PVあるかも返す', async () => {
    const { uid, version } = await createPage()
    await track(uid, IPHONE, { event: 'heatmap', version, bands: 4, reach: [1, 1, 0, 0] })
    await track(uid, IPHONE, { event: 'heatmap', version, bands: 4, reach: [1, 1, 1, 0] })
    await track(uid, IPAD, { event: 'heatmap', version, bands: 4, reach: [1, 0, 0, 0] })
    await track(uid, MAC, { event: 'heatmap', version, bands: 4, reach: [1, 1, 1, 1] })

    type Stats = {
      versions: { version_uid: string; pv: number; arrival: (number | null)[] }[]
      device_coverage: { version_uid: string; all: number; sp: number; tablet: number; pc: number }[]
    }
    const sp = await getJson<Stats>(`${server.api}/ab_tests/${uid}/heatmaps/stats?${RANGE}&device=sp`)
    const pc = await getJson<Stats>(`${server.api}/ab_tests/${uid}/heatmaps/stats?${RANGE}&device=pc`)
    expect(sp.versions[0]?.pv).toBe(2)
    expect(sp.versions[0]?.arrival[2]).toBe(0.5)
    expect(pc.versions[0]?.pv).toBe(1)
    expect(sp.device_coverage[0]).toMatchObject({ version_uid: version, all: 4, sp: 2, tablet: 1, pc: 1 })
  })
})
