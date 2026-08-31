/**
 * レポート／ヒートマップの期間指定。
 *
 * プリセットの値は**採取した実 `<select>` の option value** そのまま。
 * 数え方が採取物から判別できないものは解決せず `null` を返す（推測で埋めない）。
 */

/** 採取物にある option value（`日付` は value 無し＝プリセット解除） */
export const DATE_PRESET_VALUES = [
  'today',
  'yesterday',
  /** 「7日間」。今日を含むのか、直近7日の別の数え方なのかが採取物から判別できない */
  'seven_days',
  'last_three_days',
  'last_seven_days',
] as const

export type DatePreset = (typeof DATE_PRESET_VALUES)[number]

export interface DateRange {
  startDate: string
  endDate: string
}

/** YYYY-MM-DD（mock-server/store/metrics.ts の toDateKey と同じ書式） */
export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function shiftDays(base: Date, days: number): Date {
  const next = new Date(base)
  next.setDate(next.getDate() + days)
  return next
}

/**
 * プリセットを実際の日付範囲へ。
 *
 * 「過去N日間」は **今日を含むN日**（`mock-server/lib/query.ts` の既定期間
 * `start = today - (DEFAULT_RANGE_DAYS - 1)` と同じ数え方に揃えた）。
 */
export function resolvePreset(preset: string, today: Date = new Date()): DateRange | null {
  const endToday = toDateKey(today)
  switch (preset) {
    case 'today':
      return { startDate: endToday, endDate: endToday }
    case 'yesterday': {
      const yesterday = toDateKey(shiftDays(today, -1))
      return { startDate: yesterday, endDate: yesterday }
    }
    case 'last_three_days':
      return { startDate: toDateKey(shiftDays(today, -2)), endDate: endToday }
    case 'last_seven_days':
      return { startDate: toDateKey(shiftDays(today, -6)), endDate: endToday }
    default:
      // 'seven_days' を含む。数え方が確認できていないので解決しない。
      return null
  }
}

/** 期間を API のクエリ文字列にする（空の値は送らない） */
export function toRangeQuery(range: DateRange): string {
  const params = new URLSearchParams()
  params.set('start_date', range.startDate)
  params.set('end_date', range.endDate)
  return params.toString()
}

/** 既定期間: 今日1日（採取物の初期状態が `start_date=end_date=採取日` だった） */
export function defaultRange(today: Date = new Date()): DateRange {
  const key = toDateKey(today)
  return { startDate: key, endDate: key }
}
