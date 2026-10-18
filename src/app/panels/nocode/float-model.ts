/**
 * 部品を「重ねる」（2026-10-18 本人「複製できるようにしたい。重ねたり左右上下に配置できるようにして」。
 * 本人の選択＝好きな所に自由に置く）。
 *
 * - 重ねた部品（`float: true`）は、すぐ上の部品（土台）の上に浮かぶ。土台との並びの決まりは hotspot-model.ts（乗る部品）
 * - 位置（`floatX`・`floatY`）は、土台のふつうの並びの位置からのずれ。左右は土台の幅に対する %、上下は土台の高さに対する %。
 *   0・0 で土台にぴったり重なる。部品の幅・置く位置（左・中央・右）は、ずらした先でもそのまま効く
 * - 書き出しは templates/builder.ts（土台と重ねた部品を .nc-stack で包む）
 */
import { coveredIndexOf, groupEndOf, isFloating } from './hotspot-model.ts'
import type { ItemData } from './templates/types.ts'

/** 左右のずれ（土台の幅に対する %）。土台の外へ出してもよいが、見失わない所まで */
export const FLOAT_X_RANGE = { min: -100, max: 100 } as const
/** 上下のずれ（土台の高さに対する %）。低い土台（見出し1行）の上でも大きく動かせるよう広めに */
export const FLOAT_Y_RANGE = { min: -1000, max: 1000 } as const

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n))
const tenth = (n: number): number => Math.round(n * 10) / 10
const numberOf = (value: unknown): number => {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN
  return Number.isFinite(n) ? n : 0
}

/** 重ねた部品のずれ（読めない値は 0。範囲の中に収め、0.1% 刻み） */
export function floatOffset(item: ItemData): { x: number; y: number } {
  return {
    x: tenth(clamp(numberOf(item['floatX']), FLOAT_X_RANGE.min, FLOAT_X_RANGE.max)),
    y: tenth(clamp(numberOf(item['floatY']), FLOAT_Y_RANGE.min, FLOAT_Y_RANGE.max)),
  }
}

/**
 * 「重ねる」を付ける・外す。index は変えたあとのその部品の番号。できなければ null
 * - 付ける: すぐ上に土台が要る（いちばん上の部品は重ねられない）。前に動かした位置があればそのまま使う
 * - 外す: 土台のまとまり（ほかの重ねた部品・移行先）の後ろへふつうに並べる。ほかの重ねた部品は土台に残る
 */
export function setFloating(
  blocks: readonly ItemData[],
  index: number,
  on: boolean,
): { list: readonly ItemData[]; index: number } | null {
  const item = blocks[index]
  if (item === undefined) return null
  if (on) {
    if (isFloating(item)) return { list: blocks, index }
    if (coveredIndexOf(blocks, index) === null) return null
    const { x, y } = floatOffset(item)
    const next: ItemData = { ...item, float: true, floatX: x, floatY: y }
    return { list: blocks.map((b, i) => (i === index ? next : b)), index }
  }
  if (!isFloating(item)) return { list: blocks, index }
  const base = coveredIndexOf(blocks, index)
  const end = base === null ? index + 1 : groupEndOf(blocks, base)
  const next: ItemData = { ...item, float: false }
  const without = [...blocks.slice(0, index), ...blocks.slice(index + 1)]
  const at = end - 1
  return { list: [...without.slice(0, at), next, ...without.slice(at)], index: at }
}
