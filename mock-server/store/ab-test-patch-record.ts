/**
 * 基本情報の「記録するだけ」の項目の境界バリデーション（2026-09-24）。
 *
 * 開始/締切/終了・コンバージョン期限・スーパーリロード回数・メディア掲載・成果測定方法。
 * 画面で入力でき「更新しました」と出るのに、保存していなかった項目。
 * どれも**配信には使わない**（出す・止める・出し分けは変えない）。値を覚えて返すだけ。
 *
 * ab-test-patch.ts と同じく、body に無いキーは patch に入れない（部分更新で消さない）。
 */
import type { AbTest, MeasurementMethod } from './types.ts'
import type { ValidationResult } from '../lib/validate.ts'

export type RecordOnlyPatch = Partial<
  Pick<
    AbTest,
    | 'start_date'
    | 'deadline_date'
    | 'end_date'
    | 'conversion_limit_days'
    | 'super_reload_count'
    | 'media_listing'
    | 'measurement_method'
  >
>

const DATE_FIELDS: readonly { key: 'start_date' | 'deadline_date' | 'end_date'; label: string }[] = [
  { key: 'start_date', label: '開始' },
  { key: 'deadline_date', label: '締切' },
  { key: 'end_date', label: '終了' },
]

const COUNT_FIELDS: readonly { key: 'conversion_limit_days' | 'super_reload_count'; label: string }[] = [
  { key: 'conversion_limit_days', label: 'コンバージョン期限' },
  { key: 'super_reload_count', label: 'スーパーリロード回数' },
]

const MEASUREMENT_METHODS: readonly MeasurementMethod[] = ['none', 'strict']

function has(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key)
}

/** `YYYY-MM-DD` で、暦に在る日付か（2026-02-30 のような日は通さない） */
export function isCalendarDate(raw: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  if (match === null) return false
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

/** 空文字・null は未設定＝null。0以上の整数でなければ undefined（エラー） */
function toCount(raw: unknown): number | null | undefined {
  if (raw === null || raw === '') return null
  const value = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN
  return Number.isInteger(value) && value >= 0 ? value : undefined
}

export function parseRecordOnlyFields(body: Record<string, unknown>): ValidationResult<RecordOnlyPatch> {
  let patch: RecordOnlyPatch = {}

  for (const { key, label } of DATE_FIELDS) {
    if (!has(body, key)) continue
    const raw = body[key]
    if (raw === null || raw === '') {
      patch = { ...patch, [key]: null }
      continue
    }
    if (typeof raw !== 'string' || !isCalendarDate(raw)) {
      return { ok: false, message: `${label}は YYYY-MM-DD の日付で指定してください。` }
    }
    patch = { ...patch, [key]: raw }
  }

  for (const { key, label } of COUNT_FIELDS) {
    if (!has(body, key)) continue
    const value = toCount(body[key])
    if (value === undefined) return { ok: false, message: `${label}は0以上の整数で入力してください。` }
    patch = { ...patch, [key]: value }
  }

  if (has(body, 'media_listing')) {
    const raw = body['media_listing']
    if (typeof raw !== 'boolean') return { ok: false, message: 'メディア掲載は true / false で指定してください。' }
    patch = { ...patch, media_listing: raw }
  }

  if (has(body, 'measurement_method')) {
    const raw = body['measurement_method']
    if (!MEASUREMENT_METHODS.includes(raw as MeasurementMethod)) {
      return { ok: false, message: '成果測定方法は none（無効）か strict（厳格モード）を指定してください。' }
    }
    patch = { ...patch, measurement_method: raw as MeasurementMethod }
  }

  return { ok: true, value: patch }
}
