/**
 * 広告費の取り込み口（2026-09-24 点検7）。
 *
 *  - CSV は出どころ csv として入る（Meta の値を消さない）
 *  - CSV に無い列は送られてこない＝前の値のまま
 *  - 出どころ不明の古い値は、本人が選べば置き換える（legacy:'replace'）。既定は残して足す
 *  - いつ取り込んだかを覚えておき、レポートの「広告データ取得日時」に出す
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { getJson, postJson, resetStore, startTestServer, type TestServer } from './helpers/server.ts'
import { getState, setState } from '../mock-server/store/store.ts'
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
    title: '出どころの確認用',
    media_id: 1,
  })
  return created.json.ab_test.uid
}

interface Report {
  totals: { ad_cost: number; imp: number }
}

describe('CSVの読み取り（無い列は送らない）', () => {
  it('見出しに無い列は行に入れない（0で上書きしない）', () => {
    const out = parseAdCostCsv('日付,配信金額\n2026-09-15,500\n')
    expect(out.rows[0]).toEqual({ date: '2026-09-15', ad_cost: 500 })
  })
})

describe('CSVの取り込み口', () => {
  it('Meta で入った値に CSV を足す（Meta の配信金額・表示回数を消さない）', async () => {
    const uid = await createPage()
    // Meta の取り込みは外へ取りに行くので、同じ置き場所へ直接入れておく
    setState((s) => ({
      ...s,
      metrics: [
        ...s.metrics,
        {
          entity_uid: uid,
          scope: 'ab_test',
          date: '2026-09-15',
          pv: 0,
          click: 0,
          cv: 0,
          sales: 0,
          ad_cost: 5000,
          imp: 900,
          media_sources: { meta: { ad_cost: 5000, imp: 900, media_click: 0, media_cv: 0 } },
        },
      ],
    }))
    await postJson(`${server.api}/ab_tests/${uid}/ad_costs`, { rows: [{ date: '2026-09-15', ad_cost: 3000 }] })
    const report = await getJson<Report>(`${server.api}/ab_tests/${uid}/reports?${RANGE}`)
    expect(report.totals.ad_cost).toBe(8000)
    expect(report.totals.imp).toBe(900)
  })

  it('出どころ不明の古い値は、legacy:replace のときだけ置き換える', async () => {
    const uid = await createPage()
    const legacyRow = {
      entity_uid: uid,
      scope: 'ab_test' as const,
      date: '2026-09-15',
      pv: 0,
      click: 0,
      cv: 0,
      sales: 0,
      ad_cost: 7000,
    }
    setState((s) => ({ ...s, metrics: [...s.metrics, legacyRow] }))
    const sources = await getJson<{ days: { date: string; sources: Record<string, { ad_cost: number }> }[] }>(
      `${server.api}/ab_tests/${uid}/media_sources?start_date=2026-09-15&end_date=2026-09-15`,
    )
    expect(sources.days[0]?.sources['legacy']?.ad_cost).toBe(7000)

    await postJson(`${server.api}/ab_tests/${uid}/ad_costs`, {
      rows: [{ date: '2026-09-15', ad_cost: 1000 }],
      legacy: 'replace',
    })
    const report = await getJson<Report>(`${server.api}/ab_tests/${uid}/reports?${RANGE}`)
    expect(report.totals.ad_cost).toBe(1000)
  })

  it('legacy の指定が無ければ古い値を残して足す', async () => {
    const uid = await createPage()
    setState((s) => ({
      ...s,
      metrics: [
        ...s.metrics,
        { entity_uid: uid, scope: 'ab_test', date: '2026-09-15', pv: 0, click: 0, cv: 0, sales: 0, ad_cost: 7000 },
      ],
    }))
    await postJson(`${server.api}/ab_tests/${uid}/ad_costs`, { rows: [{ date: '2026-09-15', ad_cost: 1000 }] })
    const report = await getJson<Report>(`${server.api}/ab_tests/${uid}/reports?${RANGE}`)
    expect(report.totals.ad_cost).toBe(8000)
  })

  it('取り込んだ時刻を覚えていて、読める', async () => {
    const uid = await createPage()
    await postJson(`${server.api}/ab_tests/${uid}/ad_costs`, { rows: [{ date: '2026-09-15', ad_cost: 1000 }] })
    const out = await getJson<{ imports: { source: string; last_success_at: number | null; last_days: number }[] }>(
      `${server.api}/ab_tests/${uid}/media_imports`,
    )
    const csv = out.imports.find((i) => i.source === 'csv')
    expect(csv?.last_days).toBe(1)
    expect(typeof csv?.last_success_at).toBe('number')
    expect(getState().mediaImports.length).toBe(1)
  })
})

describe('取り込む日付の書き方（確認カード用）', () => {
  it('続いた日は「9/15〜9/17（3日分）」', async () => {
    const { describeImportDates } = await import('../src/app/pages/ad-cost-csv.ts')
    expect(describeImportDates(['2026-09-16', '2026-09-15', '2026-09-17'])).toBe('9/15〜9/17（3日分）')
  })

  it('飛び飛びの日は並べる（多ければ「ほかN日」）', async () => {
    const { describeImportDates } = await import('../src/app/pages/ad-cost-csv.ts')
    expect(describeImportDates(['2026-09-15', '2026-09-20'])).toBe('9/15、9/20（2日分）')
    expect(
      describeImportDates(['2026-09-01', '2026-09-03', '2026-09-05', '2026-09-07', '2026-09-09', '2026-09-11', '2026-09-13']),
    ).toBe('9/1、9/3、9/5、9/7、9/9 ほか2日（7日分）')
  })

  it('1日だけなら「9/15（1日分）」', async () => {
    const { describeImportDates } = await import('../src/app/pages/ad-cost-csv.ts')
    expect(describeImportDates(['2026-09-15', '2026-09-15'])).toBe('9/15（1日分）')
  })
})

describe('取り込み画面の配線', () => {
  it('入れ先は本人が選ぶ（先頭のページを黙って使わない）・書く前に確認カードを出す', async () => {
    const { readFileSync } = await import('node:fs')
    const ui = readFileSync('src/app/pages/ad-cost-import.ts', 'utf8')
    expect(ui).toContain('入れ先のページを選んでください')
    expect(ui).toContain('confirmCard(')
    expect(ui).toContain('chooseCard(')
    expect(ui).not.toMatch(/\bconfirm\(/)
  })
})
