/**
 * レポート画面の「日付別の行」を作る（企画書 §10-5 の恒等式に従う）。
 *
 * 既存の `/ab_tests/:uid/reports` は **Versionごとの行** しか返しておらず、
 * 採取したレポートタブの「デイリーレポート」表は **日付ごとの行** を必要とする。
 * ここは足りなかった分の集計だけを担う純粋関数（I/Oなし・テスト可能）。
 */
import { dateRange, deriveKpi, isWithin, sumPrimary, type DerivedKpi, type PrimaryKpi } from './metrics.ts'
import type { DailyMetric } from './types.ts'

/** その日のスクロールの記録（FVER/SVER/FSVER/OAR の材料・store/scroll-counts.ts） */
export type DailyScroll = (date: string) => Pick<PrimaryKpi, 'hm_pv' | 'fv_exit' | 'sv_exit' | 'offer_reach'>

export interface DailyKpiRow extends DerivedKpi {
  date: string
}

/**
 * [startDate, endDate] の各日について1行返す（両端含む）。
 * その日にメトリクスが無くても行は出す（表の行が消えると期間が読めないため）。
 * 派生KPIは metrics.ts の恒等式のみで算出する（ゼロ除算は null）。
 * `scrollOf` を渡すと、その日のスクロールの記録も足して FVER/SVER/FSVER/OAR を出す
 * （以前は渡す口が無く、日ごとの行はこの4列が常に「-」だった・2026-09-24）。
 */
export function dailyKpiSeries(
  metrics: readonly DailyMetric[],
  startDate: string,
  endDate: string,
  scrollOf?: DailyScroll,
): DailyKpiRow[] {
  const inRange = metrics.filter((metric) => isWithin(metric.date, startDate, endDate))
  return dateRange(startDate, endDate).map((date) => ({
    date,
    ...deriveKpi({
      ...sumPrimary(inRange.filter((metric) => metric.date === date)),
      ...(scrollOf === undefined ? {} : scrollOf(date)),
    }),
  }))
}
