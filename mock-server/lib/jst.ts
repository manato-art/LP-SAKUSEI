/**
 * 日本時間（JST）で「今」を読む。
 *
 * このシステムは日本向けなので、日付も時刻も**必ずJSTで判定する**。
 * 本番(Railway)のTZはUTCなので `new Date().getHours()` を使うと、
 * 日本の朝はまだ前日扱いになり、時間帯の出し分けも定期実行も1日ずれる。
 * サーバーのTZ設定に結果が左右されないよう、ここで固定する。
 */
export interface JstNow {
  /** YYYY-MM-DD */
  date: string
  /** HH:MM */
  hhmm: string
  /** 00-23 */
  hour: string
  /** 00-59 */
  minute: string
  /** 0=日曜 … 6=土曜 */
  weekday: number
  /** 月の何日目か（1-31） */
  day: number
  /** その月の最終日か */
  isLastDayOfMonth: boolean
}

const WEEKDAY_INDEX: Readonly<Record<string, number>> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

export function jstNow(now: Date = new Date()): JstNow {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  }).formatToParts(now)
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? ''
  // 一部環境が 24:xx を返すので 00 に丸める
  const hour = get('hour') === '24' ? '00' : get('hour')
  const year = Number(get('year'))
  const month = Number(get('month'))
  const day = Number(get('day'))
  // 翌月0日 ＝ 今月の最終日
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()

  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hhmm: `${hour}:${get('minute')}`,
    hour,
    minute: get('minute'),
    weekday: WEEKDAY_INDEX[get('weekday')] ?? 0,
    day,
    isLastDayOfMonth: day === lastDay,
  }
}
