/**
 * KPI恒等式（企画書 §10-5）と日次メトリクスの決定論生成。
 *
 * - 一次生成: pv / click / cv / ad_cost
 * - 派生は必ず恒等式で算出（保存しない）:
 *     sales = cv × 平均単価 / gross_profit = sales - ad_cost
 *     roas = sales / ad_cost / roi = gross_profit / ad_cost
 *     cvr = cv / click / cpa = ad_cost / cv
 * - ゼロ除算は null（UI側で「-」表示・§10-5）
 */
import type { DailyMetric } from './types.ts'

/** CV1件あたりの平均単価（合成・円） */
export const AVERAGE_UNIT_PRICE = 8000

export interface DerivedKpi {
  pv: number
  click: number
  cv: number
  ad_cost: number
  sales: number
  gross_profit: number
  roas: number | null
  roi: number | null
  cvr: number | null
  cpa: number | null
}

function divide(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null
  return numerator / denominator
}

/** 一次値から派生KPIを恒等式で算出する。唯一の算出経路（DRY） */
export function deriveKpi(primary: {
  pv: number
  click: number
  cv: number
  ad_cost: number
  sales?: number
}): DerivedKpi {
  const sales = primary.sales ?? primary.cv * AVERAGE_UNIT_PRICE
  const grossProfit = sales - primary.ad_cost
  return {
    pv: primary.pv,
    click: primary.click,
    cv: primary.cv,
    ad_cost: primary.ad_cost,
    sales,
    gross_profit: grossProfit,
    roas: divide(sales, primary.ad_cost),
    roi: divide(grossProfit, primary.ad_cost),
    cvr: divide(primary.cv, primary.click),
    cpa: divide(primary.ad_cost, primary.cv),
  }
}

export const ZERO_KPI: DerivedKpi = deriveKpi({ pv: 0, click: 0, cv: 0, ad_cost: 0 })

/**
 * 合計行（企画書 §10-5「合計行は各列合算。roas/roi/cvr/cpaは合算後に再計算」）
 */
export function sumKpi(rows: readonly DerivedKpi[]): DerivedKpi {
  const totals = rows.reduce(
    (acc, row) => ({
      pv: acc.pv + row.pv,
      click: acc.click + row.click,
      cv: acc.cv + row.cv,
      ad_cost: acc.ad_cost + row.ad_cost,
      sales: acc.sales + row.sales,
    }),
    { pv: 0, click: 0, cv: 0, ad_cost: 0, sales: 0 },
  )
  return deriveKpi(totals)
}

/** 日次メトリクス配列を1つのKPIへ畳む */
export function aggregate(metrics: readonly DailyMetric[]): DerivedKpi {
  return sumKpi(metrics.map((m) => deriveKpi(m)))
}

/** YYYY-MM-DD */
export function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

/** [start,end] の日付キー列（両端含む） */
export function dateRange(start: string, end: string): string[] {
  const out: string[] = []
  const endDate = parseDateKey(end)
  const cursor = parseDateKey(start)
  while (cursor.getTime() <= endDate.getTime()) {
    out.push(toDateKey(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

export function isWithin(date: string, start: string, end: string): boolean {
  return date >= start && date <= end
}
