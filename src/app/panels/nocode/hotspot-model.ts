/**
 * 部品「移行先」（押せる透明な範囲）の並びの決まり（2026-09-24・本人「ボタンやすでにあるウィジェットに被せて使う。
 * 移行先の画面やURLを設定できる」。被せ方は「範囲を自由に置く」＝本人の選択）。
 *
 * - 移行先は、並びの中で「すぐ上の部品（移行先でないもの）」に被さる。位置と大きさはその部品に対する %（x・y・w・h）
 * - 部品と、その下に続く移行先を「まとまり」と呼ぶ。部品を動かす・複製する・消すときはまとまりごと
 *   （被せたボタンを動かしたら、移行先も付いていく。別の部品に被さり直さない）
 * - 移行先そのものを動かしたときは1つだけ動き、動かした先の上の部品に被さり直す
 */
import { newUid } from './templates/kit.ts'
import type { ItemData } from './templates/types.ts'

export const HOTSPOT_TYPE = 'hotspot'

/** 押せる範囲（被せた部品に対する %。左上が 0,0） */
export interface HotspotRect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** 小さすぎて押せない範囲にしない（%） */
export const HOTSPOT_MIN = 5

export function isHotspot(block: ItemData | undefined): boolean {
  return block?.['type'] === HOTSPOT_TYPE
}

/** 移行先が被さる部品（すぐ上の、移行先でない部品）。無ければ null */
export function coveredIndexOf(blocks: readonly ItemData[], index: number): number | null {
  for (let j = index - 1; j >= 0; j -= 1) if (!isHotspot(blocks[j])) return j
  return null
}

/** まとまりの終わり（その次の番号）。部品ならその下に続く移行先まで、移行先なら自分だけ */
export function groupEndOf(blocks: readonly ItemData[], index: number): number {
  if (isHotspot(blocks[index])) return index + 1
  let end = index + 1
  while (end < blocks.length && isHotspot(blocks[end])) end += 1
  return end
}

/**
 * from のまとまりを、元の並びの before 番目の前へ動かす。部品のまとまりは、ほかの部品と移行先の間には入れない
 * （before が移行先を指していたら、そのまとまりの後ろへ）。動かない場所なら null。index は動かした先の番号
 */
export function moveGroupBefore(
  blocks: readonly ItemData[],
  from: number,
  before: number,
): { list: readonly ItemData[]; index: number } | null {
  if (blocks[from] === undefined) return null
  const end = groupEndOf(blocks, from)
  let at = Math.max(0, Math.min(blocks.length, before))
  if (!isHotspot(blocks[from])) while (at < blocks.length && isHotspot(blocks[at])) at += 1
  if (at >= from && at <= end) return null
  const group = blocks.slice(from, end)
  const without = [...blocks.slice(0, from), ...blocks.slice(end)]
  const index = at > from ? at - group.length : at
  return { list: [...without.slice(0, index), ...group, ...without.slice(index)], index }
}

/** 上へ・下へ。部品はとなりのまとまりを1つ越える。移行先は1つずつ */
export function groupStep(
  blocks: readonly ItemData[],
  index: number,
  direction: -1 | 1,
): { list: readonly ItemData[]; index: number } | null {
  if (blocks[index] === undefined) return null
  if (isHotspot(blocks[index])) {
    const target = index + direction
    if (target < 0 || target >= blocks.length) return null
    return moveGroupBefore(blocks, index, direction < 0 ? target : target + 1)
  }
  if (direction < 0) {
    const previous = coveredIndexOf(blocks, index)
    return previous === null ? null : moveGroupBefore(blocks, index, previous)
  }
  const next = groupEndOf(blocks, index)
  return next >= blocks.length ? null : moveGroupBefore(blocks, index, groupEndOf(blocks, next))
}

/**
 * 複製した部品（型の部品は、部品の名前＝uid を付け直す。同じ名前のままだと、CSS がまざって色などが元の部品にも効く）
 */
export function freshCopy(item: ItemData): ItemData {
  const uid = item['uid']
  return typeof uid === 'string' && /^nc-[a-z0-9]{8}$/.test(uid) ? { ...item, uid: newUid() } : item
}

/** まとまりを、そのすぐ下に複製する（入りきらなければ null）。index は複製した方の番号 */
export function duplicateGroup(
  blocks: readonly ItemData[],
  index: number,
  max: number,
): { list: readonly ItemData[]; index: number } | null {
  if (blocks[index] === undefined) return null
  const end = groupEndOf(blocks, index)
  const group = blocks.slice(index, end).map(freshCopy)
  if (blocks.length + group.length > max) return null
  return { list: [...blocks.slice(0, end), ...group, ...blocks.slice(end)], index: end }
}

/** まとまりを消す（部品を消すと、その移行先も消える） */
export function removeGroup(blocks: readonly ItemData[], index: number): readonly ItemData[] {
  if (blocks[index] === undefined) return blocks
  const end = groupEndOf(blocks, index)
  return [...blocks.slice(0, index), ...blocks.slice(end)]
}

const half = (n: number): number => Math.round(n * 2) / 2
const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n))
const numberOf = (value: unknown, fallback: number): number => {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN
  return Number.isFinite(n) ? n : fallback
}

/** 範囲を部品の中に収める（0.5% 刻み） */
export function clampRect(rect: HotspotRect): HotspotRect {
  const w = half(clamp(rect.w, HOTSPOT_MIN, 100))
  const h = half(clamp(rect.h, HOTSPOT_MIN, 100))
  return { x: half(clamp(rect.x, 0, 100 - w)), y: half(clamp(rect.y, 0, 100 - h)), w, h }
}

/** 移行先の範囲（読めない値は、部品まるごと） */
export function hotspotRect(item: ItemData): HotspotRect {
  return clampRect({
    x: numberOf(item['x'], 0),
    y: numberOf(item['y'], 0),
    w: numberOf(item['w'], 100),
    h: numberOf(item['h'], 100),
  })
}

/** これより低い部品（ボタン・見出し）に落としたら、部品まるごとを押せる範囲にする（px） */
const LOW_BLOCK = 96
/** 高い部品（画像・見本）に落としたときの範囲の大きさ（px）。落とした所がまん中 */
const DROP_SIZE = { width: 200, height: 64 }

/** 見たまま画面で部品の上に落としたときの範囲（cover は被せる部品の四角、point は落とした所。どちらも画面の座標） */
export function dropRect(
  cover: { readonly left: number; readonly top: number; readonly width: number; readonly height: number },
  point: { readonly x: number; readonly y: number },
): HotspotRect {
  if (cover.height <= LOW_BLOCK || cover.width <= 0) return { x: 0, y: 0, w: 100, h: 100 }
  const w = clamp(Math.round((DROP_SIZE.width / cover.width) * 100), 20, 100)
  const h = clamp((DROP_SIZE.height / cover.height) * 100, HOTSPOT_MIN, 100)
  return clampRect({
    x: ((point.x - cover.left) / cover.width) * 100 - w / 2,
    y: ((point.y - cover.top) / cover.height) * 100 - h / 2,
    w,
    h,
  })
}
