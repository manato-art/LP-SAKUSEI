/**
 * クリエイティブレポートの絞り込み（2026-09-24 点検19）。
 *
 * 「配信中 / 停止中 / ALL」「平均 / 合計」は押せるのに何も変わらず、「Parameter検索」は
 * 「集計していないので絞れない」という誤った理由で使えなかった。
 *
 *  - 配信中＝実際に配信している Version（アーカイブしておらず配信割合が1%以上。配信の抽選と同じ条件）。
 *    Version の状態ラベル（公開中・準備中）では決めない（本番は準備中のまま配信しているため）
 *  - 平均＝1日あたり（回数・金額を期間の日数で割る。率はもともと割り算なので変わらない）／合計＝期間の合計
 *  - Parameter検索＝広告の名前（utm_source=fb など）に含まれる文字で絞る
 */
import { describe, expect, it } from 'vitest'
import {
  filterVersionsByAdStatus,
  isDeliveringVersion,
  perDayRow,
  searchCreativeRows,
  summarizeDaily,
  versionDailySeries,
} from '../src/app/pages/report-creative-rows.ts'
import type { ReportDailyRow, ReportVersionRow } from '../src/app/api.ts'

function kpi(): Omit<ReportVersionRow, 'scope' | 'entity_uid' | 'name' | 'status' | 'distribution_ratio'> {
  return {
    pv: 0, click: 0, cv: 0, ad_cost: 0, imp: 0, media_click: 0, media_cv: 0,
    sales: 0, gross_profit: 0, roas: null, roi: null, cvr: null, cpa: null,
    ctr: null, ctvr: null, media_ctr: null, mcpa: null,
    fver: null, sver: null, fsver: null, oar: null,
  }
}

function version(name: string, patch: Partial<ReportVersionRow> = {}): ReportVersionRow {
  return { ...kpi(), scope: 'version', entity_uid: name, name, status: '準備中', distribution_ratio: 50, ...patch }
}

describe('配信中 / 停止中', () => {
  it('配信中＝アーカイブしておらず配信割合が1%以上（状態ラベルが準備中でも配信中）', () => {
    expect(isDeliveringVersion(version('A', { status: '準備中', distribution_ratio: 50 }))).toBe(true)
    expect(isDeliveringVersion(version('B', { distribution_ratio: 0 }))).toBe(false)
    expect(isDeliveringVersion(version('C', { archived: true }))).toBe(false)
  })

  it('配信中 / 停止中 / ALL で Version を分ける', () => {
    const rows = [version('A'), version('B', { distribution_ratio: 0 })]
    expect(filterVersionsByAdStatus(rows, '配信中').map((r) => r.name)).toEqual(['A'])
    expect(filterVersionsByAdStatus(rows, '停止中').map((r) => r.name)).toEqual(['B'])
    expect(filterVersionsByAdStatus(rows, 'ALL').map((r) => r.name)).toEqual(['A', 'B'])
  })

  it('グラフは選んだ Version の日別を足し直す（配信金額はページ単位なので分からない）', () => {
    const rows = [
      version('A', { daily_lp: [{ date: '2026-09-23', pv: 10, click: 2, cv: 1, sales: 0 }] }),
      version('B', { daily_lp: [{ date: '2026-09-23', pv: 5, click: 3, cv: 0, sales: 0 }] }),
    ]
    const series = versionDailySeries(rows, ['2026-09-23', '2026-09-24'])
    expect(series.map((d) => d.pv)).toEqual([15, 0])
    expect(series[0]?.ctr).toBeCloseTo(5 / 15)
    expect(series[0]?.cost_known).toBe(false)
    expect(series[0]?.cpa).toBeNull()
  })
})

describe('平均 / 合計', () => {
  const daily = [
    { ...kpi(), date: '2026-09-23', pv: 10, click: 2, cv: 1, ad_cost: 3000 },
    { ...kpi(), date: '2026-09-24', pv: 20, click: 4, cv: 1, ad_cost: 1000 },
  ] as ReportDailyRow[]

  it('合計は期間の合計、平均は1日あたり', () => {
    expect(summarizeDaily(daily, 'pv', '合計')).toBe(30)
    expect(summarizeDaily(daily, 'pv', '平均')).toBe(15)
    expect(summarizeDaily(daily, 'ad_cost', '平均')).toBe(2000)
  })

  it('率は期間の合計から出す（平均でも同じ）', () => {
    expect(summarizeDaily(daily, 'ctr', '合計')).toBeCloseTo(6 / 30)
    expect(summarizeDaily(daily, 'ctr', '平均')).toBeCloseTo(6 / 30)
    expect(summarizeDaily(daily, 'cpa', '平均')).toBe(2000)
  })

  it('広告の行を1日あたりにする（回数と金額だけ割る）', () => {
    const row = perDayRow({ ...version('utm_source=fb'), pv: 30, click: 6, cv: 2, ctr: 0.2 }, 3)
    expect(row.pv).toBe(10)
    expect(row.click).toBe(2)
    expect(row.ctr).toBe(0.2)
  })
})

describe('Parameter検索', () => {
  it('広告の名前に含まれる文字で絞る（大文字小文字は区別しない）', () => {
    const rows = [version('utm_source=fb'), version('utm_source=ig'), version('utm_medium=FB_paid')]
    expect(searchCreativeRows(rows, 'fb').map((r) => r.name)).toEqual(['utm_source=fb', 'utm_medium=FB_paid'])
    expect(searchCreativeRows(rows, '').map((r) => r.name)).toHaveLength(3)
  })
})
