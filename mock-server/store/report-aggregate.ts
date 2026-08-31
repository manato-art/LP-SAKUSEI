/**
 * レポート画面の「日付別の行」を作る（企画書 §10-5 の恒等式に従う）。
 *
 * 既存の `/ab_tests/:uid/reports` は **Versionごとの行** しか返しておらず、
 * 採取したレポートタブの「デイリーレポート」表は **日付ごとの行** を必要とする。
 * ここは足りなかった分の集計だけを担う純粋関数（I/Oなし・テスト可能）。
 */
import { aggregate, dateRange, isWithin, type DerivedKpi } from './metrics.ts'
import type { DailyMetric } from './types.ts'

export interface DailyKpiRow extends DerivedKpi {
  date: string
}

/**
 * [startDate, endDate] の各日について1行返す（両端含む）。
 * その日にメトリクスが無くても行は出す（表の行が消えると期間が読めないため）。
 * 派生KPIは metrics.ts の恒等式のみで算出する（ゼロ除算は null）。
 */
export function dailyKpiSeries(
  metrics: readonly DailyMetric[],
  startDate: string,
  endDate: string,
): DailyKpiRow[] {
  const inRange = metrics.filter((metric) => isWithin(metric.date, startDate, endDate))
  return dateRange(startDate, endDate).map((date) => ({
    date,
    ...aggregate(inRange.filter((metric) => metric.date === date)),
  }))
}
