/**
 * Canva のように「数字をドラッグで変える」ための計算（2026-09-23・Widget編集 第2弾）。
 *
 *  - 数字の欄は、名前や単位を左右にドラッグすると増減する（scrubValue）
 *  - 数字の欄の下にスライダーを出す。単位ごとの範囲は sliderRange
 *  - 左の見たまま画面の選択枠のハンドルで、幅・高さ・文字の大きさ・余白を直接ドラッグする
 *    （dragValue: マウスの動き(px) → 値。CSSの設定のどれをどのハンドルにするかは handleKindOf）
 * DOM を使わない（テストは tests/drag-math.test.ts）。
 */
import type { Setting } from './widget-settings.ts'

export interface NumberRange {
  readonly min: number
  readonly max: number
  readonly step: number
}

/** 小数の刻みで足し引きしたときの誤差（0.1+0.2）を落とす */
export function snapToStep(value: number, step: number): number {
  const decimals = Math.max(0, (String(step).split('.')[1] ?? '').length)
  return Number((Math.round(value / step) * step).toFixed(decimals))
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * 数字の欄を左右にドラッグしたときの値。pxPerStep 動くごとに step だけ増減する。
 * 範囲があれば中に収める。
 */
export function scrubValue(
  start: number,
  deltaPx: number,
  step: number,
  range?: Pick<NumberRange, 'min' | 'max'>,
  pxPerStep = 4,
): number {
  const steps = Math.round(deltaPx / pxPerStep)
  const raw = snapToStep(start + steps * step, step)
  return range === undefined ? raw : clamp(raw, range.min, range.max)
}

/**
 * 選択枠のハンドルをドラッグしたときの値。マウスの動き(px) を pxPerUnit で割って値の単位にする
 * （幅% なら 1% あたりの px、px ならそのまま 1、文字の大きさは 3px 動かして 1px）。
 */
export function dragValue(start: number, deltaPx: number, pxPerUnit: number, range: NumberRange): number {
  const units = pxPerUnit > 0 ? deltaPx / pxPerUnit : 0
  return clamp(snapToStep(start + units, range.step), range.min, range.max)
}

/** 単位のない数値のうち、範囲がはっきり決まっているもの */
const UNITLESS_RANGES: Readonly<Record<string, NumberRange>> = {
  opacity: { min: 0, max: 1, step: 0.05 },
  'line-height': { min: 0.8, max: 3, step: 0.05 },
  'font-weight': { min: 100, max: 900, step: 100 },
}

/** 上限は「今の値の2倍」と決まった値の大きい方（今の値がスライダーの端に来ないように） */
const wide = (value: number, base: number): number => Math.max(base, Math.ceil(Math.abs(value) * 2))

/**
 * 数字の欄に付けるスライダーの範囲。決められない単位（ch・vmin など）は null（スライダーを出さない）。
 * 負の値（外側の余白のマイナスなど）は下限を今の値まで広げる。
 */
export function sliderRange(unit: string, property: string, value: number): NumberRange | null {
  const fine = !Number.isInteger(value)
  const lower = Math.min(0, Math.floor(value))
  switch (unit) {
    case '%':
    case 'vw':
    case 'vh':
      return { min: lower, max: 100, step: fine ? 0.1 : 1 }
    case 'px':
      return { min: lower, max: wide(value, 200), step: fine ? 0.5 : 1 }
    case 'em':
    case 'rem':
      return { min: lower, max: wide(value, 5), step: 0.1 }
    case 's':
      return { min: 0, max: wide(value, 5), step: 0.1 }
    case 'ms':
      return { min: 0, max: wide(value, 5000), step: 50 }
    case 'deg':
      return { min: -360, max: 360, step: 1 }
    case '':
      return UNITLESS_RANGES[property] ?? null
    default:
      return null
  }
}

export type HandleKind = 'width' | 'height' | 'font'

/**
 * CSSの設定を、選択枠のどのハンドルで動かすか。
 * 幅・高さ・文字の大きさの宣言はそのまま。CSS変数は名前（行末のコメント）か変数名で見分ける
 * （本人の矢印Widget: `--arrow-w /* 1本の幅 *\/` → 幅、`--arrow-h /* 1本の高さ *\/` → 高さ）。
 * 動かせないもの（色・時間・余白など）は null。
 */
export function handleKindOf(setting: Pick<Setting, 'kind' | 'property' | 'label' | 'isVariable' | 'unit'>): HandleKind | null {
  if (setting.kind !== 'number') return null
  if (setting.unit !== '' && !['px', '%', 'em', 'rem', 'vw'].includes(setting.unit)) return null
  if (!setting.isVariable) {
    if (setting.property === 'width' || setting.property === 'max-width') return 'width'
    if (setting.property === 'height' || setting.property === 'min-height') return 'height'
    if (setting.property === 'font-size') return 'font'
    return null
  }
  const name = `${setting.label} ${setting.property}`
  if (/文字|font|size/i.test(name)) return 'font'
  if (/幅|width|-w$|-w-|-w /i.test(name)) return 'width'
  if (/高さ|height|-h$|-h-|-h /i.test(name)) return 'height'
  return null
}
