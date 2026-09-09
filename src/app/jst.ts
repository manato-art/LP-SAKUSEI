/**
 * 画面に出す日時は日本時間（JST）で組み立てる。
 *
 * このシステムは日本向けで、サーバーは記録も集計もJSTで日付を切っている
 * （mock-server/store/metrics.ts の toDateKey・mock-server/lib/jst.ts）。
 * 画面側が `date.getHours()` のようなブラウザのローカル時刻を使うと、
 * 本番(Railway=UTC)でサーバーレンダリングされた場合や、
 * 日本の外から開いた場合に、表示される時刻が最大で9時間ずれる。
 *
 * 「見ている場所に関係なく同じ日時が出る」ようにここへ一本化する。
 */

interface JstParts {
  year: number
  /** 1-12 */
  month: number
  /** 1-31 */
  day: number
  /** 0-23 */
  hour: number
  minute: number
  second: number
}

const FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

/** その瞬間を日本時間で見たときの各要素 */
export function jstParts(date: Date): JstParts {
  const parts = FORMATTER.formatToParts(date)
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? '0')
  const hour = get('hour')
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    // 一部環境が 24 時を返すので 0 に丸める
    hour: hour === 24 ? 0 : hour,
    minute: get('minute'),
    second: get('second'),
  }
}

const pad = (n: number): string => String(n).padStart(2, '0')

/** YYYY-MM-DD（日本時間）。サーバーの toDateKey と同じ書式・同じ基準。 */
export function jstDateKey(date: Date): string {
  const p = jstParts(date)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

/** HH:MM（日本時間） */
export function jstHhmm(date: Date): string {
  const p = jstParts(date)
  return `${pad(p.hour)}:${pad(p.minute)}`
}
