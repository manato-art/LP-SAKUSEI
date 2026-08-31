/**
 * 境界バリデーション（企画書 §12「外部データを信用しない。処理前に検証。明確なメッセージで fail fast」）。
 * 失敗は例外ではなく Result で返し、呼び出し側が 422 + エラー封筒にする。
 */

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; message: string }

export function requireString(
  body: unknown,
  field: string,
  { maxLength = 255 }: { maxLength?: number } = {},
): ValidationResult<string> {
  const record = body as Record<string, unknown> | null
  const raw = record?.[field]
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { ok: false, message: `${field}を入力してください。` }
  }
  if (raw.length > maxLength) {
    return { ok: false, message: `${field}は${maxLength}文字以内で入力してください。` }
  }
  return { ok: true, value: raw }
}

export function optionalString(body: unknown, field: string): string {
  const record = body as Record<string, unknown> | null
  const raw = record?.[field]
  return typeof raw === 'string' ? raw : ''
}

export function optionalNumber(body: unknown, field: string): number | undefined {
  const record = body as Record<string, unknown> | null
  const raw = record?.[field]
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim() !== '' && Number.isFinite(Number(raw))) {
    return Number(raw)
  }
  return undefined
}

export function optionalBoolean(body: unknown, field: string): boolean | undefined {
  const record = body as Record<string, unknown> | null
  const raw = record?.[field]
  if (typeof raw === 'boolean') return raw
  if (raw === 'true') return true
  if (raw === 'false') return false
  return undefined
}

/** 配信割合は 0-100（企画書 §9-1[2]・§10-2 Version.distribution_ratio） */
export function validateRatio(value: number | undefined): ValidationResult<number> {
  if (value === undefined) return { ok: false, message: '配信割合を入力してください。' }
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    return { ok: false, message: '配信割合は0〜100の範囲で入力してください。' }
  }
  return { ok: true, value }
}

/**
 * 合計100%チェック（企画書 §9-1[2]・§9-5）。
 * 100でない場合は「警告」であってエラーではない（保存自体は通す）。
 */
export interface RatioTotal {
  total: number
  isValid: boolean
  warning: string | null
}

export function checkRatioTotal(ratios: readonly number[]): RatioTotal {
  const total = ratios.reduce((sum, r) => sum + r, 0)
  const isValid = total === 100
  return {
    total,
    isValid,
    warning: isValid ? null : `配信割合の合計が${total}%です。100%になるよう調整してください。`,
  }
}
