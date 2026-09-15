/**
 * クリエイティブレポートに並べる「広告パラメータの行」と、その並べ替え（2026-09-15）。
 *
 * 実物（capture/clean/ab_tests__UID__reports/report-settings-modal の
 * `_reportWrapper_1fhbq_152`）は、列のチップ（配信金額 / CV / CPA / CTR / CVR）ごとに
 * 「並び替え」→「A-Zで並べ替え」「Z-Aで並べ替え」を持ち、その下に
 * `utm_source=ig` のような行が並ぶ。最後に「もっと表示」（`_readMore_1fhbq_440`）。
 *
 * 材料は Branch Operation と同じ「Version×広告パラメータ」の集計。
 * クリエイティブは Version をまたいだ広告そのものの成績なので、ここで足し合わせる。
 */
import type { ReportKpi, ReportVersionRow } from '../api.ts'

/** 「もっと表示」を押すまでに出す件数 */
export const CREATIVE_PAGE_SIZE = 5

/** 並べ替えできる列（採取物のチップと同じ5つ） */
export type CreativeSortKey = 'ad_cost' | 'cv' | 'cpa' | 'ctr' | 'cvr' | 'pv' | 'click'
export type SortDirection = 'asc' | 'desc'

/** 割り算で出す値は足せない。合計から出し直す（§10-5の恒等式と同じ向き）。 */
function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator
}

/**
 * Version ごとにぶら下がっている広告パラメータの行を、広告ごとに足し合わせる。
 * 並びはPVの多い順（実物の一覧も多い順だった）。
 */
export function creativeParameterRows(
  versions: readonly ReportVersionRow[],
): ReportVersionRow[] {
  const sums = new Map<string, ReportVersionRow>()
  for (const version of versions) {
    for (const child of version.children ?? []) {
      const base = sums.get(child.name)
      if (base === undefined) {
        sums.set(child.name, { ...child, entity_uid: child.name })
        continue
      }
      sums.set(child.name, {
        ...base,
        pv: base.pv + child.pv,
        click: base.click + child.click,
        cv: base.cv + child.cv,
        ad_cost: base.ad_cost + child.ad_cost,
        imp: base.imp + child.imp,
        media_click: base.media_click + child.media_click,
        media_cv: base.media_cv + child.media_cv,
        sales: base.sales + child.sales,
        gross_profit: base.gross_profit + child.gross_profit,
      })
    }
  }
  return [...sums.values()]
    .map((row) => ({ ...row, ...recalcRatios(row) }))
    .sort((a, b) => b.pv - a.pv || a.name.localeCompare(b.name))
}

/** 足したあとに率をもう一度出す（率を足すと壊れる） */
function recalcRatios(row: ReportVersionRow): Partial<ReportKpi> {
  return {
    ctr: ratio(row.click, row.pv),
    cvr: ratio(row.cv, row.click),
    ctvr: ratio(row.cv, row.pv),
    cpa: ratio(row.ad_cost, row.cv),
    mcpa: ratio(row.ad_cost, row.click),
    media_ctr: ratio(row.media_click, row.imp),
    roas: ratio(row.sales, row.ad_cost),
  }
}

/**
 * 列のチップの「A-Zで並べ替え」＝小さい順 /「Z-Aで並べ替え」＝大きい順。
 * 値が無い行（-）はどちら向きでも後ろへ回す（前に出ると「0より小さい」ように見える）。
 */
export function sortCreativeRows(
  rows: readonly ReportVersionRow[],
  key: CreativeSortKey,
  direction: SortDirection,
): ReportVersionRow[] {
  return [...rows].sort((a, b) => {
    const left = a[key]
    const right = b[key]
    if (left === null && right === null) return a.name.localeCompare(b.name)
    if (left === null) return 1
    if (right === null) return -1
    if (left === right) return a.name.localeCompare(b.name)
    return direction === 'asc' ? left - right : right - left
  })
}
