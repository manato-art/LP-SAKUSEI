/**
 * KPI恒等式（企画書 §10-5）と日次メトリクスの決定論生成。
 *
 * - 一次生成（LP側・実測）: pv / click / cv
 * - 一次生成（媒体側・取り込み）: ad_cost / imp / media_click / media_cv / sales
 * - 派生は必ず恒等式で算出（保存しない）:
 *     sales = cv × 平均単価（未取得時のみ） / gross_profit = sales - ad_cost
 *     roas = sales / ad_cost / roi = gross_profit / ad_cost
 *     cvr = cv / click / cpa = ad_cost / cv
 *     ctr = click / pv / ctvr = cv / pv
 *     media_ctr = media_click / imp / mcpa = ad_cost / media_cv
 * - ゼロ除算は null（UI側で「-」表示・§10-5）
 *
 * 【定義の出所】ctr / ctvr / media_ctr / mcpa は採取物にも企画書にも計算式が無く、
 * SquadBeyond の正確な定義は復元できなかった。広告運用の標準的な解釈で定義している
 * （実物とズレていたらこの4本を直せば全画面に反映される）。
 */
import type { DailyMetric } from './types.ts'

/** CV1件あたりの平均単価（売上が取得できていないときのフォールバック・円） */
export const AVERAGE_UNIT_PRICE = 8000

export interface DerivedKpi {
  pv: number
  click: number
  cv: number
  ad_cost: number
  /** 媒体の表示回数（インプレッション） */
  imp: number
  /** 媒体が計測したクリック */
  media_click: number
  /** 媒体が計測したCV */
  media_cv: number
  sales: number
  gross_profit: number
  roas: number | null
  roi: number | null
  cvr: number | null
  cpa: number | null
  /** クリック率（LP内リンク） = click / pv */
  ctr: number | null
  /** PV基準のCV率 = cv / pv */
  ctvr: number | null
  /** 媒体のクリック率 = media_click / imp */
  media_ctr: number | null
  /** 媒体CV基準のCPA = ad_cost / media_cv */
  mcpa: number | null
}

/** 一次値（保存する値）。媒体側は未取得なら0。 */
export interface PrimaryKpi {
  pv: number
  click: number
  cv: number
  ad_cost: number
  imp?: number
  media_click?: number
  media_cv?: number
  sales?: number
}

function divide(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null
  return numerator / denominator
}

/** 一次値から派生KPIを恒等式で算出する。唯一の算出経路（DRY） */
export function deriveKpi(primary: PrimaryKpi): DerivedKpi {
  const sales = primary.sales ?? primary.cv * AVERAGE_UNIT_PRICE
  const grossProfit = sales - primary.ad_cost
  const imp = primary.imp ?? 0
  const mediaClick = primary.media_click ?? 0
  const mediaCv = primary.media_cv ?? 0
  return {
    pv: primary.pv,
    click: primary.click,
    cv: primary.cv,
    ad_cost: primary.ad_cost,
    imp,
    media_click: mediaClick,
    media_cv: mediaCv,
    sales,
    gross_profit: grossProfit,
    roas: divide(sales, primary.ad_cost),
    roi: divide(grossProfit, primary.ad_cost),
    cvr: divide(primary.cv, primary.click),
    cpa: divide(primary.ad_cost, primary.cv),
    ctr: divide(primary.click, primary.pv),
    ctvr: divide(primary.cv, primary.pv),
    media_ctr: divide(mediaClick, imp),
    mcpa: divide(primary.ad_cost, mediaCv),
  }
}

export const ZERO_KPI: DerivedKpi = deriveKpi({ pv: 0, click: 0, cv: 0, ad_cost: 0 })

/**
 * 合計行（企画書 §10-5「合計行は各列合算。roas/roi/cvr/cpaは合算後に再計算」）
 * 比率は合算後に再計算する（比率の平均を取らない）。
 */
export function sumKpi(rows: readonly DerivedKpi[]): DerivedKpi {
  const totals = rows.reduce<Required<PrimaryKpi>>(
    (acc, row) => ({
      pv: acc.pv + row.pv,
      click: acc.click + row.click,
      cv: acc.cv + row.cv,
      ad_cost: acc.ad_cost + row.ad_cost,
      imp: acc.imp + row.imp,
      media_click: acc.media_click + row.media_click,
      media_cv: acc.media_cv + row.media_cv,
      sales: acc.sales + row.sales,
    }),
    { pv: 0, click: 0, cv: 0, ad_cost: 0, imp: 0, media_click: 0, media_cv: 0, sales: 0 },
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
