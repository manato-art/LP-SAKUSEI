/**
 * スマホのページカードに出す中身（2026-09-13）。
 *
 * PCの一覧は13列あるが、スマホで13列は読めない。出すのは3つだけにして、
 * 「どのページが回っていて、どれが取れているか」が一目で分かるようにする。
 * 残りの指標はカードを開いたときに出す（縦スクロールを増やさないため）。
 */
import type { ReportKpi } from '../api.ts'

export interface CardMetric {
  label: string
  value: string
}

/** 整数（3桁区切り）。数字でなければ「-」 */
function integer(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString() : '-'
}

/** 百分率。割り算のもとが0なら「-」（0%と区別する） */
function percent(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : '-'
}

/** カードの表に出す3つ */
export function cardMetrics(totals: ReportKpi | null): readonly CardMetric[] {
  return [
    { label: 'PV', value: integer(totals?.pv) },
    { label: 'CV', value: integer(totals?.cv) },
    { label: 'CVR', value: percent(totals?.cvr) },
  ]
}

/** 開いたときに出す残り */
export function cardDetailMetrics(totals: ReportKpi | null): readonly CardMetric[] {
  return [
    { label: 'Click', value: integer(totals?.click) },
    { label: 'CTR', value: percent(totals?.ctr) },
    { label: 'CTVR', value: percent(totals?.ctvr) },
    { label: '配信金額', value: totals === null ? '-' : `¥${integer(totals.ad_cost)}` },
    { label: 'CPA', value: totals === null || totals.cpa === null ? '-' : `¥${integer(totals.cpa)}` },
    { label: 'ROAS', value: percent(totals?.roas) },
  ]
}
