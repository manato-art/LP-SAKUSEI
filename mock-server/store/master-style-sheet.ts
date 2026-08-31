/**
 * Version設定（MasterStyleSheet）＝ 右レール5番目のダークモーダルが編集する記事単位のスタイル。
 * 実物の項目は `docs/findings-live-observation.md`（「記事設定」節）と
 * `capture/clean/ab_tests__UID__articles/tool-version-settings/dom.html` の input/select から確定させた。
 *
 * 既存の `store/types.ts` は編集しない（他担当と衝突するため）。
 * State への追加は **モジュール拡張** で行い、型定義はこのファイルに閉じる。
 * 値の更新は常に新しいオブジェクトを返す（§12 イミュータブル）。
 */
import type { ValidationResult } from '../lib/validate.ts'
import type { State } from './types.ts'

declare module './types.ts' {
  interface State {
    /** 記事uid → Version設定。未保存の記事は既定値として扱う（entry を持たない） */
    readonly masterStyleSheets?: readonly MasterStyleSheetEntry[]
  }
}

/** 単位・タイプの選択肢は採取した `<option value>` と完全一致させる（空文字＝「選択してください」） */
export const IFRAME_HEIGHT_UNITS = ['', 'px', 'vh', '%'] as const
export const DELIVERY_WIDTH_UNITS = ['', 'px', '%'] as const
export const BORDER_TYPES = ['', 'solid', 'double', 'dashed', 'dotted'] as const

export interface MasterStyleSheet {
  readonly font_size: number | null
  readonly font_family: string
  readonly color: string
  readonly line_height: number | null
  readonly letter_spacing: number | null
  readonly img_margin_top: number | null
  readonly img_margin_bottom: number | null
  readonly padding_top: number | null
  readonly padding_bottom: number | null
  readonly padding_right: number | null
  readonly padding_left: number | null
  readonly iframe_height: number | null
  readonly iframe_height_unit: string
  readonly delivery_version_width: number | null
  readonly delivery_version_width_unit: string
  readonly border_size: number | null
  readonly border_type: string
  readonly border_color: string
  readonly outer_background_color: string
  readonly outer_background_image: string
  readonly inner_background_color: string
  readonly inner_background_image: string
}

export interface MasterStyleSheetEntry {
  readonly article_uid: string
  readonly sheet: MasterStyleSheet
}

/**
 * 既定値は実機の初期表示そのまま（採取DOMの value 属性）。
 * 文字色は `#` なしの6桁（input の maxlength=6）。
 * 配信Version幅が空のときの実効値は620px（実物の注記）だが、保存値は空のままにする。
 */
export const DEFAULT_MASTER_STYLE_SHEET: MasterStyleSheet = {
  font_size: 17,
  font_family: 'Hiragino Sans, Arial, sans-serif',
  color: '000000',
  line_height: 1.8,
  letter_spacing: null,
  img_margin_top: 0,
  img_margin_bottom: 0,
  padding_top: 15,
  padding_bottom: 15,
  padding_right: 20,
  padding_left: 20,
  iframe_height: null,
  iframe_height_unit: '',
  delivery_version_width: null,
  delivery_version_width_unit: '',
  border_size: null,
  border_type: '',
  border_color: '',
  outer_background_color: '',
  outer_background_image: '',
  inner_background_color: '',
  inner_background_image: '',
}

/** 数値項目 → 実物のラベル（エラーメッセージに実物の言葉を出す） */
const NUMBER_LABELS: Readonly<Record<string, string>> = {
  font_size: '文字サイズ',
  line_height: '行間',
  letter_spacing: '文字間',
  img_margin_top: '画像上',
  img_margin_bottom: '画像下',
  padding_top: '余白上',
  padding_bottom: '余白下',
  padding_right: '余白右',
  padding_left: '余白左',
  iframe_height: 'iframeの高さ',
  delivery_version_width: '配信Versionの幅',
  border_size: 'Version枠線の太さ',
}

const NUMBER_FIELDS = Object.keys(NUMBER_LABELS) as readonly (keyof MasterStyleSheet)[]

/** 数値の上限。実物のバリデーションは未採取なので、明らかな異常値だけを弾く保守的な範囲 */
const NUMBER_MAX = 9999

const HEX6 = /^[0-9a-fA-F]{6}$/

export function getMasterStyleSheet(state: State, articleUid: string): MasterStyleSheet {
  const entry = (state.masterStyleSheets ?? []).find((e) => e.article_uid === articleUid)
  return entry?.sheet ?? DEFAULT_MASTER_STYLE_SHEET
}

/** 既存Stateを破壊せず、新しいStateを返す（§12） */
export function putMasterStyleSheet(
  state: State,
  articleUid: string,
  sheet: MasterStyleSheet,
): State {
  const entries = state.masterStyleSheets ?? []
  const next: MasterStyleSheetEntry = { article_uid: articleUid, sheet }
  return {
    ...state,
    masterStyleSheets: entries.some((e) => e.article_uid === articleUid)
      ? entries.map((e) => (e.article_uid === articleUid ? next : e))
      : [...entries, next],
  }
}

function readRaw(body: unknown, field: string): unknown {
  return (body as Record<string, unknown> | null)?.[field]
}

/** 空文字・null は「指定しない」＝ null。未指定（キー無し）は現在値を維持する。 */
function parseNumberField(
  body: unknown,
  field: keyof MasterStyleSheet,
  current: number | null,
): ValidationResult<number | null> {
  const raw = readRaw(body, field)
  if (raw === undefined) return { ok: true, value: current }
  if (raw === null || raw === '') return { ok: true, value: null }
  const label = NUMBER_LABELS[field] ?? field
  const value = typeof raw === 'number' ? raw : Number(String(raw).trim())
  if (!Number.isFinite(value)) {
    return { ok: false, message: `${label}は数値で入力してください。` }
  }
  if (value < 0 || value > NUMBER_MAX) {
    return { ok: false, message: `${label}は0〜${NUMBER_MAX}の範囲で入力してください。` }
  }
  return { ok: true, value }
}

function parseChoiceField(
  body: unknown,
  field: keyof MasterStyleSheet,
  choices: readonly string[],
  current: string,
  label: string,
): ValidationResult<string> {
  const raw = readRaw(body, field)
  if (raw === undefined) return { ok: true, value: current }
  const value = typeof raw === 'string' ? raw : ''
  if (!choices.includes(value)) {
    return { ok: false, message: `${label}に選べない値が指定されました。` }
  }
  return { ok: true, value }
}

function parseColorField(
  body: unknown,
  field: keyof MasterStyleSheet,
  current: string,
  label: string,
): ValidationResult<string> {
  const raw = readRaw(body, field)
  if (raw === undefined) return { ok: true, value: current }
  if (raw === null) return { ok: true, value: '' }
  const value = String(raw).trim().replace(/^#/, '')
  if (value === '') return { ok: true, value: '' }
  if (!HEX6.test(value)) {
    return { ok: false, message: `${label}は16進6桁（例: 000000）で入力してください。` }
  }
  return { ok: true, value }
}

function parseTextField(
  body: unknown,
  field: keyof MasterStyleSheet,
  current: string,
  label: string,
  maxLength: number,
): ValidationResult<string> {
  const raw = readRaw(body, field)
  if (raw === undefined) return { ok: true, value: current }
  if (raw === null) return { ok: true, value: '' }
  if (typeof raw !== 'string') {
    return { ok: false, message: `${label}は文字列で入力してください。` }
  }
  if (raw.length > maxLength) {
    return { ok: false, message: `${label}は${maxLength}文字以内で入力してください。` }
  }
  return { ok: true, value: raw }
}

/**
 * 保存リクエストの検証（境界で検証・fail fast・§12）。
 * 送られてこなかった項目は `base`（現在値）を維持する。
 */
export function parseMasterStyleSheet(
  body: unknown,
  base: MasterStyleSheet,
): ValidationResult<MasterStyleSheet> {
  const numbers: Record<string, number | null> = {}
  for (const field of NUMBER_FIELDS) {
    const parsed = parseNumberField(body, field, base[field] as number | null)
    if (!parsed.ok) return parsed
    numbers[field] = parsed.value
  }

  const fontFamily = parseTextField(body, 'font_family', base.font_family, 'フォント', 255)
  if (!fontFamily.ok) return fontFamily
  const color = parseColorField(body, 'color', base.color, '文字色')
  if (!color.ok) return color
  const borderColor = parseColorField(body, 'border_color', base.border_color, 'Version枠線の色')
  if (!borderColor.ok) return borderColor
  const iframeUnit = parseChoiceField(
    body,
    'iframe_height_unit',
    IFRAME_HEIGHT_UNITS,
    base.iframe_height_unit,
    'iframeの単位',
  )
  if (!iframeUnit.ok) return iframeUnit
  const widthUnit = parseChoiceField(
    body,
    'delivery_version_width_unit',
    DELIVERY_WIDTH_UNITS,
    base.delivery_version_width_unit,
    '配信Version幅の単位',
  )
  if (!widthUnit.ok) return widthUnit
  const borderType = parseChoiceField(
    body,
    'border_type',
    BORDER_TYPES,
    base.border_type,
    'Version枠線のタイプ',
  )
  if (!borderType.ok) return borderType

  const outerColor = parseColorField(
    body,
    'outer_background_color',
    base.outer_background_color,
    '全体背景の色',
  )
  if (!outerColor.ok) return outerColor
  const innerColor = parseColorField(
    body,
    'inner_background_color',
    base.inner_background_color,
    'Version背景の色',
  )
  if (!innerColor.ok) return innerColor
  const outerImage = parseTextField(
    body,
    'outer_background_image',
    base.outer_background_image,
    '全体背景の画像',
    500,
  )
  if (!outerImage.ok) return outerImage
  const innerImage = parseTextField(
    body,
    'inner_background_image',
    base.inner_background_image,
    'Version背景の画像',
    500,
  )
  if (!innerImage.ok) return innerImage

  return {
    ok: true,
    value: {
      font_size: numbers['font_size'] ?? null,
      font_family: fontFamily.value,
      color: color.value,
      line_height: numbers['line_height'] ?? null,
      letter_spacing: numbers['letter_spacing'] ?? null,
      img_margin_top: numbers['img_margin_top'] ?? null,
      img_margin_bottom: numbers['img_margin_bottom'] ?? null,
      padding_top: numbers['padding_top'] ?? null,
      padding_bottom: numbers['padding_bottom'] ?? null,
      padding_right: numbers['padding_right'] ?? null,
      padding_left: numbers['padding_left'] ?? null,
      iframe_height: numbers['iframe_height'] ?? null,
      iframe_height_unit: iframeUnit.value,
      delivery_version_width: numbers['delivery_version_width'] ?? null,
      delivery_version_width_unit: widthUnit.value,
      border_size: numbers['border_size'] ?? null,
      border_type: borderType.value,
      border_color: borderColor.value,
      outer_background_color: outerColor.value,
      outer_background_image: outerImage.value,
      inner_background_color: innerColor.value,
      inner_background_image: innerImage.value,
    },
  }
}
