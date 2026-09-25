/**
 * 申し込んだ人だけのヒートマップ（2026-09-25・本人「CVボタンは作り直して、申し込んだ人が実際どこまで読んで
 * どこ押したかをヒートマップ上に出したい」）。
 *
 * 位置の記録（heatmap）はLPを離れたときに届き、申し込み（cv）はあとからサンクスページのタグで届く。
 * 同じ人の目印（vid）で結びつけ、成果が数えられた人の記録だけを「申し込んだ人」の行に足す（segment=cv で読む）。
 * 以前のCVの列は「画面のどこで起きたかを記録していない」ので、色も線も出なかった。
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { getJson, postJson, resetStore, startTestServer, type TestServer } from './helpers/server.ts'

let server: TestServer

const RANGE = 'start_date=2026-01-01&end_date=2030-12-31'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'

interface Stat {
  version_uid: string
  pv: number
  arrival: (number | null)[]
  elementClick: number[]
}

async function setup(): Promise<{ uid: string; version: string }> {
  const created = await postJson<{ ab_test: { uid: string } }>(`${server.api}/ab_tests`, { title: 'CVのヒートマップ', media_id: 1 })
  const uid = created.json.ab_test.uid
  const report = await getJson<{ rows: { entity_uid: string }[] }>(`${server.api}/ab_tests/${uid}/reports?${RANGE}`)
  return { uid, version: report.rows[0]?.entity_uid ?? '' }
}

async function track(uid: string, payload: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${server.baseUrl}/lp/${uid}/__track`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain', 'User-Agent': IPHONE },
    body: JSON.stringify(payload),
  })
  await res.text()
}

/** 10バンドのLPで、upTo まで見て、exit で離れ、clickY の位置を押した記録 */
function heatmap(version: string, vid: string, upTo: number, clickY: number | null, params: string[] = []) {
  return {
    event: 'heatmap',
    version,
    vid,
    bands: 10,
    rb: 1,
    fv: 3,
    offer: 2,
    reach: Array.from({ length: 10 }, (_, i) => (i <= upTo ? 1 : 0)),
    dwell: Array.from({ length: 10 }, (_, i) => (i <= upTo ? 1000 : 0)),
    exit_band: upTo,
    clicks: clickY === null ? [] : [{ x: 0.5, y: clickY, cx: 0 }],
    params,
  }
}

async function cvStats(uid: string, extra = ''): Promise<Stat[]> {
  const res = await getJson<{ versions: Stat[] }>(`${server.api}/ab_tests/${uid}/heatmaps/stats?${RANGE}&segment=cv${extra}`)
  return res.versions
}

beforeEach(async () => {
  if (server === undefined) server = await startTestServer()
  resetStore()
})

afterAll(() => server?.close())

describe('申し込んだ人だけのヒートマップ', () => {
  it('押して申し込んだ人の記録だけが入る（押しただけの人・見ただけの人は入らない）', async () => {
    const { uid, version } = await setup()
    // 申し込んだ人: バンド6まで読み、バンド2（0.25）を押した
    await track(uid, { event: 'pv', version, vid: 'visitor-cv-00001' })
    await track(uid, { event: 'click', version, vid: 'visitor-cv-00001' })
    await track(uid, heatmap(version, 'visitor-cv-00001', 6, 0.25))
    await track(uid, { event: 'cv', vid: 'visitor-cv-00001', amount: 0 })
    // 押したけれど申し込まなかった人: バンド9まで読んだ
    await track(uid, { event: 'pv', version, vid: 'visitor-clk-0001' })
    await track(uid, { event: 'click', version, vid: 'visitor-clk-0001' })
    await track(uid, heatmap(version, 'visitor-clk-0001', 9, 0.95))
    // 見ただけの人
    await track(uid, { event: 'pv', version, vid: 'visitor-see-0001' })
    await track(uid, heatmap(version, 'visitor-see-0001', 1, null))

    const cv = await cvStats(uid)
    expect(cv).toHaveLength(1)
    expect(cv[0]?.pv).toBe(1)
    expect(cv[0]?.arrival[6]).toBe(1)
    expect(cv[0]?.arrival[7]).toBe(0)
    expect(cv[0]?.elementClick[2]).toBe(1)
    expect(cv[0]?.elementClick[9]).toBe(0)

    // ふつうのヒートマップは今までどおり全員（3人）
    const all = await getJson<{ versions: Stat[] }>(`${server.api}/ab_tests/${uid}/heatmaps/stats?${RANGE}`)
    expect(all.versions[0]?.pv).toBe(3)
  })

  it('申し込みが位置の記録より先に届いても入る', async () => {
    const { uid, version } = await setup()
    await track(uid, { event: 'pv', version, vid: 'visitor-early-01' })
    await track(uid, { event: 'click', version, vid: 'visitor-early-01' })
    await track(uid, { event: 'cv', vid: 'visitor-early-01', amount: 0 })
    await track(uid, heatmap(version, 'visitor-early-01', 4, 0.2))
    const cv = await cvStats(uid)
    expect(cv[0]?.pv).toBe(1)
    expect(cv[0]?.arrival[4]).toBe(1)
  })

  it('位置の記録が「押した」記録より先に届いても入る（ほぼ同時に送られ、本番では順番が入れ替わった）', async () => {
    const { uid, version } = await setup()
    await track(uid, { event: 'pv', version, vid: 'visitor-race-001' })
    await track(uid, heatmap(version, 'visitor-race-001', 5, 0.3))
    await track(uid, { event: 'click', version, vid: 'visitor-race-001' })
    await track(uid, { event: 'cv', vid: 'visitor-race-001', amount: 0 })
    const cv = await cvStats(uid)
    expect(cv[0]?.pv).toBe(1)
    expect(cv[0]?.arrival[5]).toBe(1)
  })

  it('同じ人の申し込みが2回届いても1人ぶん', async () => {
    const { uid, version } = await setup()
    await track(uid, { event: 'pv', version, vid: 'visitor-twice-01' })
    await track(uid, { event: 'click', version, vid: 'visitor-twice-01' })
    await track(uid, heatmap(version, 'visitor-twice-01', 4, 0.2))
    await track(uid, { event: 'cv', vid: 'visitor-twice-01', amount: 0 })
    await track(uid, { event: 'cv', vid: 'visitor-twice-01', amount: 0 })
    expect((await cvStats(uid))[0]?.pv).toBe(1)
  })

  it('端末（スマホ）と広告（fb）で絞れる', async () => {
    const { uid, version } = await setup()
    const params = ['utm_source=fb']
    await track(uid, { event: 'pv', version, vid: 'visitor-fb-00001', params })
    await track(uid, { event: 'click', version, vid: 'visitor-fb-00001', params })
    await track(uid, heatmap(version, 'visitor-fb-00001', 5, 0.3, params))
    await track(uid, { event: 'cv', vid: 'visitor-fb-00001', amount: 0 })

    expect((await cvStats(uid, '&device=sp'))[0]?.pv).toBe(1)
    expect(await cvStats(uid, '&device=pc')).toHaveLength(0)
    expect((await cvStats(uid, `&param=${encodeURIComponent('utm_source=fb')}`))[0]?.pv).toBe(1)
    expect(await cvStats(uid, `&param=${encodeURIComponent('utm_source=google')}`)).toHaveLength(0)
  })

  it('目印の無い位置の記録（古いタグ）は、申し込んだ人の行には入らない', async () => {
    const { uid, version } = await setup()
    await track(uid, { event: 'pv', version, vid: 'visitor-old-0001' })
    await track(uid, { event: 'click', version, vid: 'visitor-old-0001' })
    const { vid: _drop, ...noVid } = heatmap(version, 'visitor-old-0001', 4, 0.2)
    await track(uid, noVid)
    await track(uid, { event: 'cv', vid: 'visitor-old-0001', amount: 0 })
    expect(await cvStats(uid)).toHaveLength(0)
  })
})
