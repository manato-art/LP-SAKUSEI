/**
 * 広告費の取り込み（2026-09-15・本人の依頼「おすすめの順番で作成」の2番目）。
 *
 * 今は Meta 連携でしか配信金額が入らないので、Google / Yahoo / X を回している案件では
 * 配信金額・CPA・MCPA・ROAS・ROI がずっと空のままだった。
 * 日別の実績を貼り付けて入れられるようにする。
 *
 * 媒体が返すのは日別の**絶対値**なので、取り込みは上書き（再実行しても二重計上しない）。
 */
import { readFileSync } from 'node:fs'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { getJson, postJson, resetStore, startTestServer, type TestServer } from './helpers/server.ts'
import { parseAdCostCsv } from '../src/app/pages/ad-cost-csv.ts'

let server: TestServer

const RANGE = 'start_date=2026-01-01&end_date=2026-12-31'

beforeEach(async () => {
  if (server === undefined) server = await startTestServer()
  resetStore()
})

afterAll(() => server?.close())

async function createPage(): Promise<string> {
  const created = await postJson<{ ab_test: { uid: string } }>(`${server.api}/ab_tests`, {
    title: '広告費の確認用',
    media_id: 1,
  })
  return created.json.ab_test.uid
}

interface Report {
  totals: { ad_cost: number; cpa: number | null; mcpa: number | null }
  daily: { date: string; ad_cost: number }[]
}

describe('CSVの読み取り', () => {
  it('日本語の見出しを読む', () => {
    const out = parseAdCostCsv('日付,配信金額,表示回数,クリック,CV\n2026-09-15,12345,1000,50,3\n')
    expect(out.rows).toEqual([
      { date: '2026-09-15', ad_cost: 12345, imp: 1000, media_click: 50, media_cv: 3 },
    ])
    expect(out.errors).toEqual([])
  })

  it('英語の見出しも読む', () => {
    const out = parseAdCostCsv('date,spend,impressions,clicks,conversions\n2026-09-15,100,2,1,0\n')
    expect(out.rows[0]).toEqual({ date: '2026-09-15', ad_cost: 100, imp: 2, media_click: 1, media_cv: 0 })
  })

  it('配信金額だけでも読む（他は0）', () => {
    const out = parseAdCostCsv('日付,配信金額\n2026-09-15,500\n')
    expect(out.rows[0]).toEqual({ date: '2026-09-15', ad_cost: 500, imp: 0, media_click: 0, media_cv: 0 })
  })

  it('桁区切りと円記号と余分な空白を落とす', () => {
    const out = parseAdCostCsv('日付,配信金額\n 2026-09-15 , "¥12,345" \n')
    expect(out.rows[0]?.ad_cost).toBe(12345)
  })

  it('日付が読めない行は、その行だけ理由つきで落とす', () => {
    const out = parseAdCostCsv('日付,配信金額\n2026/9/15,100\nだめ,200\n2026-09-16,300\n')
    expect(out.rows.map((r) => r.date)).toEqual(['2026-09-15', '2026-09-16'])
    expect(out.errors).toHaveLength(1)
    expect(out.errors[0]).toContain('3行目')
  })

  it('見出しに日付か配信金額が無ければ何も読まない（取り違えを防ぐ）', () => {
    const out = parseAdCostCsv('あ,い\n1,2\n')
    expect(out.rows).toEqual([])
    expect(out.errors[0]).toContain('日付')
  })

  it('タブ区切り（スプレッドシートからの貼り付け）も読む', () => {
    const out = parseAdCostCsv('日付\t配信金額\n2026-09-15\t777\n')
    expect(out.rows[0]?.ad_cost).toBe(777)
  })
})

describe('取り込み', () => {
  it('取り込むとレポートの配信金額に出る', async () => {
    const uid = await createPage()
    await postJson(`${server.api}/ab_tests/${uid}/ad_costs`, {
      rows: [{ date: '2026-09-15', ad_cost: 10000, imp: 500, media_click: 20, media_cv: 2 }],
    })
    const report = await getJson<Report>(`${server.api}/ab_tests/${uid}/reports?${RANGE}`)
    expect(report.totals.ad_cost).toBe(10000)
    expect(report.daily.find((d) => d.date === '2026-09-15')?.ad_cost).toBe(10000)
  })

  it('同じ日をもう一度取り込んでも二重計上しない（上書き）', async () => {
    const uid = await createPage()
    const send = async (cost: number): Promise<void> => {
      await postJson(`${server.api}/ab_tests/${uid}/ad_costs`, {
        rows: [{ date: '2026-09-15', ad_cost: cost }],
      })
    }
    await send(10000)
    await send(3000)
    const report = await getJson<Report>(`${server.api}/ab_tests/${uid}/reports?${RANGE}`)
    expect(report.totals.ad_cost).toBe(3000)
  })

  it('CVが入っていればCPAが出る', async () => {
    const uid = await createPage()
    const track = async (payload: Record<string, unknown>): Promise<void> => {
      const res = await fetch(`${server.baseUrl}/lp/${uid}/__track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      await res.text()
    }
    // 目印は8文字以上でないと記録しない（store/visitor-touches.ts の VISITOR_ID）
    await track({ event: 'pv', vid: 'VISITOR-CPA-1' })
    await track({ event: 'click', vid: 'VISITOR-CPA-1' })
    await track({ event: 'cv', amount: 0, vid: 'VISITOR-CPA-1' })
    await postJson(`${server.api}/ab_tests/${uid}/ad_costs`, {
      rows: [{ date: '2026-09-15', ad_cost: 8000 }],
    })
    const report = await getJson<Report>(`${server.api}/ab_tests/${uid}/reports?${RANGE}`)
    expect(report.totals.cpa).toBe(8000)
  })

  it('日付の形が違う行は受け取らない', async () => {
    const uid = await createPage()
    const res = await postJson(`${server.api}/ab_tests/${uid}/ad_costs`, {
      rows: [{ date: '2026/09/15', ad_cost: 100 }],
    })
    expect(res.status).toBe(422)
  })

  it('無いページには入れない', async () => {
    const res = await postJson(`${server.api}/ab_tests/NOT_EXIST/ad_costs`, {
      rows: [{ date: '2026-09-15', ad_cost: 100 }],
    })
    expect(res.status).toBe(404)
  })
})

/**
 * 画面の配線（jsdomを使わないので実装の形で固定する）。
 * 採取した「広告媒体連携」には手を入れず、その下に足す（実物のUIは変えない）。
 */
describe('取り込み画面', () => {
  const ui = readFileSync('src/app/pages/ad-cost-import.ts', 'utf8')
  const host = readFileSync('src/app/pages/external-integration.ts', 'utf8')

  it('このシステムだけの機能だと画面に書く', () => {
    expect(ui).toContain('実物にはありません')
  })

  it('採取した画面の下に足す（採取物のDOMは触らない）', () => {
    expect(host).toContain('mountAdCostImport(content)')
    expect(ui).not.toContain('querySelector')
  })

  it('読めなかった行は隠さずに伝える', () => {
    expect(ui).toContain('読めなかった行')
  })

  it('同じ日を入れ直すと上書きになることを書く', () => {
    expect(ui).toContain('上書き')
  })
})
