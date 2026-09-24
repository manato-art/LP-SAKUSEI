/**
 * 配信金額はページ単位（2026-09-24 点検22）。
 *
 * 媒体の配信金額はページ（ab_test）にしか入らない。以前は Version を1本アーカイブしただけで
 * （既定の「アーカイブ済みを除く」で）合計が Version の数字だけに切り替わり、配信金額 ¥0・CPA「-」、
 * 外部LPの計測タグの PV/CV まで消えていた。フォルダのページ一覧の数字も同じ API なので同じく消えていた。
 *
 *  - 合計と日別は、アーカイブの絞り込みに関係なくページ全体（配信金額・外部LPの計測を含む）
 *  - Version の行の配信金額は「分からない」（null）。¥0 と出さない。CPA・MCPA も出さない
 *  - Version を選んで絞ったときは LP の数字はその Version、配信金額はページ全体のまま（CPAは出さない）
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { getJson, postJson, resetStore, startTestServer, type TestServer } from './helpers/server.ts'

let server: TestServer
const RANGE = 'start_date=2026-01-01&end_date=2026-12-31'

interface Kpi {
  pv: number
  cv: number
  ad_cost: number
  cpa: number | null
  mcpa: number | null
}
interface Report {
  rows: (Kpi & { entity_uid: string; cost_known?: boolean })[]
  totals: Kpi
  daily: (Kpi & { date: string })[]
  filtered_by: string[]
  hidden_rows: number
}

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

/** Version 2本（片方アーカイブ）＋外部LPの計測＋ページの配信金額 */
async function setup(): Promise<{ uid: string; first: string; second: string }> {
  const created = await postJson<{ ab_test: { uid: string } }>(`${server.api}/ab_tests`, {
    title: '配信金額の確認用',
    media_id: 1,
  })
  const uid = created.json.ab_test.uid
  const before = await getJson<Report>(`${server.api}/ab_tests/${uid}/reports?${RANGE}`)
  const first = before.rows[0]?.entity_uid ?? ''
  const articles = await getJson<{ articles: { uid: string }[] }>(`${server.api}/ab_tests/${uid}/articles`)
  const added = await postJson<{ version: { uid: string } }>(
    `${server.api}/articles/${articles.articles[0]?.uid ?? ''}/versions`,
    {},
  )
  const second = added.json.version?.uid ?? ''
  await track(uid, { event: 'pv', version: first, vid: 'VISITOR-COST-1' })
  await track(uid, { event: 'click', version: first, vid: 'VISITOR-COST-1' })
  await track(uid, { event: 'cv', vid: 'VISITOR-COST-1' })
  await track(uid, { event: 'pv', version: second })
  // 外部LPの計測タグは Version を持たない
  await track(uid, { event: 'pv' })
  await postJson(`${server.api}/versions/${second}/archive`, {})
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
  await postJson(`${server.api}/ab_tests/${uid}/ad_costs`, { rows: [{ date: today, ad_cost: 30000 }] })
  return { uid, first, second }
}

describe('配信金額はページ単位', () => {
  it('Version をアーカイブしても（既定の絞り込みでも）合計に配信金額とCPAが出る', async () => {
    const { uid } = await setup()
    const out = await getJson<Report>(`${server.api}/ab_tests/${uid}/reports?${RANGE}`)
    expect(out.totals.ad_cost).toBe(30000)
    expect(out.totals.cv).toBe(1)
    expect(out.totals.cpa).toBe(30000)
    expect(out.daily.reduce((sum, d) => sum + d.ad_cost, 0)).toBe(30000)
  })

  it('合計はページ全体（アーカイブ済みの Version と外部LPの計測も入る）。隠した行の数を返す', async () => {
    const { uid } = await setup()
    const out = await getJson<Report>(`${server.api}/ab_tests/${uid}/reports?${RANGE}`)
    expect(out.totals.pv).toBe(3)
    expect(out.hidden_rows).toBe(1)
    expect(out.filtered_by).toEqual([])
  })

  it('Version の行の配信金額は「分からない」。CPA・MCPA も出さない（¥0 と言わない）', async () => {
    const { uid, first } = await setup()
    const out = await getJson<Report>(`${server.api}/ab_tests/${uid}/reports?${RANGE}`)
    const row = out.rows.find((r) => r.entity_uid === first)
    expect(row?.cost_known).toBe(false)
    expect(row?.cpa).toBeNull()
    expect(row?.mcpa).toBeNull()
  })

  it('Version を選んで絞ると、LPの数字はその Version・配信金額はページ全体のまま（CPAは出さない）', async () => {
    const { uid, first } = await setup()
    const out = await getJson<Report>(`${server.api}/ab_tests/${uid}/reports?${RANGE}&version=${first}`)
    expect(out.totals.pv).toBe(1)
    expect(out.totals.ad_cost).toBe(30000)
    expect(out.totals.cpa).toBeNull()
    expect(out.filtered_by).toEqual(['version'])
  })
})
