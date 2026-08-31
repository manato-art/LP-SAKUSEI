/**
 * KPI恒等式（企画書 §10-5）の単体テスト。
 * 「サーバー集計は再現しないが、表示が矛盾しない擬似生成規則は持つ」の中核。
 */
import { describe, expect, it } from 'vitest'
import { AVERAGE_UNIT_PRICE, aggregate, dateRange, deriveKpi, sumKpi } from '../mock-server/store/metrics.ts'
import { checkRatioTotal } from '../mock-server/lib/validate.ts'
import { createRng, rngForKey } from '../mock-server/store/rng.ts'

describe('deriveKpi の恒等式（§10-5）', () => {
  it('sales は cv × 平均単価、gross_profit は sales - ad_cost', () => {
    const kpi = deriveKpi({ pv: 1000, click: 200, cv: 10, ad_cost: 30000 })
    expect(kpi.sales).toBe(10 * AVERAGE_UNIT_PRICE)
    expect(kpi.gross_profit).toBe(kpi.sales - 30000)
  })

  it('roas = sales/ad_cost, roi = gross_profit/ad_cost, cvr = cv/click, cpa = ad_cost/cv', () => {
    const kpi = deriveKpi({ pv: 1000, click: 200, cv: 10, ad_cost: 40000 })
    expect(kpi.roas).toBeCloseTo(kpi.sales / 40000)
    expect(kpi.roi).toBeCloseTo(kpi.gross_profit / 40000)
    expect(kpi.cvr).toBeCloseTo(10 / 200)
    expect(kpi.cpa).toBeCloseTo(40000 / 10)
  })

  it('ゼロ除算は null（UIで「-」表示）', () => {
    const kpi = deriveKpi({ pv: 0, click: 0, cv: 0, ad_cost: 0 })
    expect(kpi.roas).toBeNull()
    expect(kpi.roi).toBeNull()
    expect(kpi.cvr).toBeNull()
    expect(kpi.cpa).toBeNull()
  })

  it('sales を明示した場合はそちらを使う（CV速報が積んだ実額）', () => {
    const kpi = deriveKpi({ pv: 100, click: 20, cv: 2, ad_cost: 1000, sales: 12345 })
    expect(kpi.sales).toBe(12345)
    expect(kpi.gross_profit).toBe(11345)
  })
})

describe('合計行（§10-5「各列合算。roas/roi/cvr/cpa は合算後に再計算」）', () => {
  it('比率は行ごとの平均ではなく、合算後に再計算される', () => {
    const a = deriveKpi({ pv: 100, click: 50, cv: 5, ad_cost: 10000 })
    const b = deriveKpi({ pv: 900, click: 150, cv: 15, ad_cost: 90000 })
    const total = sumKpi([a, b])

    expect(total.pv).toBe(1000)
    expect(total.click).toBe(200)
    expect(total.cv).toBe(20)
    expect(total.ad_cost).toBe(100000)
    // 合算後に再計算 → 単純平均((a.roas+b.roas)/2)とは一致しない
    expect(total.roas).toBeCloseTo(total.sales / 100000)
    expect(total.roas).not.toBeCloseTo(((a.roas ?? 0) + (b.roas ?? 0)) / 2)
  })

  it('空配列の合算は全て0でゼロ除算は null', () => {
    const total = aggregate([])
    expect(total.sales).toBe(0)
    expect(total.roas).toBeNull()
  })
})

describe('決定論（§10-5「再起動しても同一データを再生」）', () => {
  it('同じseedからは同じ列が出る', () => {
    const a = Array.from({ length: 5 }, () => createRng(42).int(0, 1000))
    const b = Array.from({ length: 5 }, () => createRng(42).int(0, 1000))
    expect(a).toEqual(b)
  })

  it('同じキーからは同じ値が出て、違うキーでは変わる', () => {
    expect(rngForKey('ABTEST_0001|2026-08-31').int(0, 1e6)).toBe(
      rngForKey('ABTEST_0001|2026-08-31').int(0, 1e6),
    )
    expect(rngForKey('ABTEST_0001|2026-08-31').int(0, 1e6)).not.toBe(
      rngForKey('ABTEST_0002|2026-08-31').int(0, 1e6),
    )
  })
})

describe('日付レンジ', () => {
  it('両端を含む日付キー列を返す', () => {
    expect(dateRange('2026-08-29', '2026-08-31')).toEqual(['2026-08-29', '2026-08-30', '2026-08-31'])
  })

  it('月をまたいでも連続する', () => {
    expect(dateRange('2026-08-30', '2026-09-01')).toEqual(['2026-08-30', '2026-08-31', '2026-09-01'])
  })
})

describe('配信割合の合計チェック（§9-1[2]・§9-5）', () => {
  it('合計100%なら警告なし', () => {
    expect(checkRatioTotal([60, 40])).toEqual({ total: 100, isValid: true, warning: null })
  })

  it('100%でなければ警告文を返す（エラーではない）', () => {
    const result = checkRatioTotal([60, 30])
    expect(result.isValid).toBe(false)
    expect(result.warning).toContain('90%')
  })
})
