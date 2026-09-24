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

/* ── 補助線と吸い付き（2026-09-24・本人「補助線もやって」） ──
 * 部品をつかんで横に動かすと、手の位置のまま動き、左・中央・右に近づくと吸い付いて補助線が出る。
 * 幅のつまみは、ほかの部品の端に辺がそろう幅と、よく使う幅（25/50/75/100%）に吸い付く。
 * x はどれも画面の座標（getBoundingClientRect と同じ）。 */

/** 吸い付く距離（画面の px） */
export const SNAP_PX = 8

/** 部品を置ける横の範囲（中身の左端・右端） */
export interface Span {
  readonly left: number
  readonly right: number
}

/** 部品を置く位置（builder-blocks.ts の Place と同じ3つ） */
export type Side = 'left' | 'center' | 'right'

/** 同じ近さなら中央を選ぶ（中央が先） */
const SIDES: readonly Side[] = ['center', 'left', 'right']

/** よく使う幅（%） */
const NICE_WIDTHS: readonly number[] = [25, 50, 75, 100]

/** 置く位置ごとの、部品の左端 */
export function placeLeft(side: Side, width: number, box: Span): number {
  if (side === 'left') return box.left
  if (side === 'right') return box.right - width
  return box.left + (box.right - box.left - width) / 2
}

/** 置く位置の補助線（左＝左の端・中央＝まん中・右＝右の端） */
export function placeGuideX(side: Side, box: Span): number {
  if (side === 'left') return box.left
  if (side === 'right') return box.right
  return (box.left + box.right) / 2
}

/**
 * 部品をつかんで横に動かしたとき。手の位置（freeLeft＝部品の左端）のまま動かし、
 * 置く位置のどれかに thresholdPx まで近づいたら吸い付く。side は離したときに収まる位置（一番近いもの）。
 */
export function snapPlace(
  freeLeft: number,
  width: number,
  box: Span,
  thresholdPx = SNAP_PX,
): { side: Side; left: number; snapped: boolean } {
  const left = clamp(freeLeft, box.left, Math.max(box.left, box.right - width))
  let side: Side = 'center'
  let distance = Number.POSITIVE_INFINITY
  for (const candidate of SIDES) {
    const d = Math.abs(placeLeft(candidate, width, box) - left)
    if (d < distance) {
      side = candidate
      distance = d
    }
  }
  const snapped = distance <= thresholdPx
  return { side, left: snapped ? placeLeft(side, width, box) : left, snapped }
}

/** 幅%の部品の、つまみで動かす辺（右に置いた部品は左の辺、ほかは右の辺） */
export function widthEdgeX(value: number, side: Side, box: Span): number {
  const width = ((box.right - box.left) * value) / 100
  if (side === 'left') return box.left + width
  if (side === 'right') return box.right - width
  return (box.left + box.right) / 2 + width / 2
}

/** 辺がその位置に来る幅%（中央に置いた部品は、左右どちらの辺でも同じ幅） */
export function widthAtEdge(x: number, side: Side, box: Span): number {
  const full = box.right - box.left
  if (full <= 0) return 100
  if (side === 'left') return ((x - box.left) / full) * 100
  if (side === 'right') return ((box.right - x) / full) * 100
  return ((Math.abs(x - (box.left + box.right) / 2) * 2) / full) * 100
}

/** 幅がその値のときに補助線を引く位置（中央に置いた部品は両側の辺） */
export function widthGuideXs(value: number, side: Side, box: Span): number[] {
  const edge = widthEdgeX(value, side, box)
  return side === 'center' ? [edge, box.left + box.right - edge] : [edge]
}

/** 幅のつまみの吸い付き先（%・小さい順）。edges はほかの部品の左右の端 */
export function widthSnaps(side: Side, box: Span, edges: readonly number[], range: Pick<NumberRange, 'min' | 'max'>): number[] {
  const values = [...edges.map((x) => Math.round(widthAtEdge(x, side, box))), ...NICE_WIDTHS]
  return [...new Set(values)].filter((v) => v >= range.min && v <= range.max).sort((a, b) => a - b)
}

/** いまの値から、手の動きで thresholdPx の内にある一番近い吸い付き先（無ければ null） */
export function nearestSnap<T extends { readonly value: number }>(
  value: number,
  points: readonly T[],
  pxPerUnit: number,
  thresholdPx = SNAP_PX,
): T | null {
  let best: T | null = null
  let distance = Number.POSITIVE_INFINITY
  for (const point of points) {
    const d = Math.abs(point.value - value) * pxPerUnit
    if (d <= thresholdPx && d < distance) {
      best = point
      distance = d
    }
  }
  return best
}
