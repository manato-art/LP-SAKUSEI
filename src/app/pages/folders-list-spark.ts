/**
 * ページ一覧の数字の下の小さい棒グラフ（2026-10-27 本人「こんな感じにリデザインしたい」＋見本の画像）。
 * 本人の決定: 直近7日の日ごと＝集計期間の最後の日までの7日間を、1日1本の棒で出す（上の数字は今までどおり集計期間の合計）。
 *
 * 数字を発明しない: 割合が出せない日（ゼロ割り）・配信金額が分からない日は「値なし」の空の棒にする（0 の棒と分ける）。
 * 棒の色は列（指標）ごと（folders-redesign-style.ts）。数字の文字は色を付けない。
 */
import type { ReportDailyRow } from '../api.ts'
import { EMPTY_CELL, formatCell, readMetric, type ReportColumn } from './report-columns.ts'
import { lastDaysRange, toDateKey, type DateRange } from './report-period.ts'

export const SPARK_DAYS = 7

/** 日本時間の暦日のお昼（日付のずれを起こさない基準） */
const jstNoon = (dateKey: string): Date => new Date(`${dateKey}T12:00:00+09:00`)

/** 棒グラフの期間＝集計期間の最後の日までの7日間 */
export function sparkRange(range: DateRange): DateRange {
  return lastDaysRange(SPARK_DAYS, jstNoon(range.endDate))
}

/** 配信金額を使う指標（その日の配信金額が分からなければ値なし） */
const COST_METRICS: ReadonlySet<string> = new Set(['ad_cost', 'cpa', 'mcpa', 'roas'])

export interface SparkPoint {
  readonly date: string
  /** その日の値。値なし（ゼロ割り・配信金額が分からない・行が無い）は null */
  readonly value: number | null
  /** 棒に乗せたときの説明（例: 10/21 PV 1,234） */
  readonly label: string
}

/** 一覧のセルと同じ見せ方（¥・%） */
function formatted(row: ReportDailyRow, column: ReportColumn): string {
  const text = formatCell(row, column)
  if (text === EMPTY_CELL) return EMPTY_CELL
  if (column.format === 'yen') return `¥${text}`
  if (column.format === 'percent') return `${text}%`
  return text
}

/** 7日ぶんの点（日付の順） */
export function sparkPoints(daily: readonly ReportDailyRow[], range: DateRange, column: ReportColumn): SparkPoint[] {
  const start = jstNoon(range.startDate).getTime()
  return Array.from({ length: SPARK_DAYS }, (_, i) => {
    const date = toDateKey(new Date(start + i * 86_400_000))
    const [, month, dayOfMonth] = date.split('-')
    const head = `${Number(month)}/${Number(dayOfMonth)} ${column.label}`
    const row = daily.find((d) => d.date === date)
    const metric = column.metric
    if (row === undefined || metric === null || (COST_METRICS.has(metric) && row.cost_known === false)) {
      return { date, value: null, label: `${head} ${EMPTY_CELL}` }
    }
    const value = readMetric(row, metric)
    return { date, value: value !== null && Number.isFinite(value) ? value : null, label: `${head} ${formatted(row, column)}` }
  })
}

/** 小さい棒グラフ（いちばん大きい日を100%の高さに） */
export function renderSpark(points: readonly SparkPoint[], metric: string): HTMLElement {
  const spark = document.createElement('span')
  spark.className = 'pl-spark'
  spark.setAttribute('data-metric', metric)
  spark.setAttribute('aria-hidden', 'true')
  const max = Math.max(0, ...points.map((p) => p.value ?? 0))
  for (const point of points) {
    const bar = document.createElement('span')
    bar.className = 'pl-spark__bar'
    bar.title = point.label
    if (point.value === null) bar.classList.add('pl-spark__bar--none')
    else if (point.value <= 0 || max <= 0) bar.classList.add('pl-spark__bar--zero')
    else bar.style.height = `${Math.round((point.value / max) * 100)}%`
    spark.append(bar)
  }
  return spark
}
