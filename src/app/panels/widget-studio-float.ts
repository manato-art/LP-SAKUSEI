/**
 * 見たまま画面で「重ねた部品」をつかんで動かす（2026-10-18 本人「重ねたり左右上下に配置できるようにして」。
 * 本人の選択＝好きな所に自由に置く）。
 *
 * - 部品は手について上下左右どこへでも動く（土台の外へ出してもよい。重なってもよい）
 * - 土台のふつうの並びの位置（左右・上下のずれ 0）に近づくと吸い付いて、ピンクの線を出す（Alt・option で吸い付かない）
 * - 位置は土台（外枠 .nc-stack）に対する %（float-model.ts）。動かしている間は見た目だけ、離したら設定データへ
 */
import { dragValue, nearestSnap, snapThreshold } from './drag-math.ts'
import { FLOAT_X_RANGE, FLOAT_Y_RANGE } from './nocode/float-model.ts'
import type { GuideLine, SelectionLayer, SelectionMove } from './selection-layer.ts'

export interface FloatOffset {
  readonly x: number
  readonly y: number
}

export interface FloatEditDeps {
  readonly selection: SelectionLayer
  /** 動かしている間だけ直に当てた見た目（描き直すときに外す） */
  readonly previewed: Set<HTMLElement>
  /** 今のずれ */
  readonly offset: () => FloatOffset
  /** 離したとき（確定） */
  readonly commit: (next: FloatOffset) => void
}

/** 土台の四角（重ねた部品の % の基準＝土台と重ねた部品を包む外枠） */
const baseBox = (el: HTMLElement): DOMRect => (el.parentElement ?? el).getBoundingClientRect()

/** ずれを言葉にする（「右へ 30%・上へ 10%」。0・0 は土台に重なる位置） */
export function floatWords({ x, y }: FloatOffset): string {
  if (x === 0 && y === 0) return '土台にぴったり重ねる'
  const words: string[] = []
  if (x !== 0) words.push(`${x > 0 ? '右' : '左'}へ ${Math.abs(x)}%`)
  if (y !== 0) words.push(`${y > 0 ? '下' : '上'}へ ${Math.abs(y)}%`)
  return words.join('・')
}

/** 重ねた部品そのもの（つかみ所・本体）をつかんで動かす */
export function floatMove(floatEl: HTMLElement, deps: FloatEditDeps): SelectionMove {
  const el = floatEl // eslint-safe alias（no-param-reassign 回避。動かしている間は style を直に書く）
  let from: { offset: FloatOffset; box: DOMRect } | null = null
  let next: FloatOffset | null = null
  const finish = (): void => {
    from = null
    deps.selection.guides([])
  }
  return {
    update: ({ x, y, startX, startY, isFree }) => {
      if (from === null) from = { offset: deps.offset(), box: baseBox(el) }
      const { offset, box } = from
      const perX = box.width / 100 || 1
      const perY = box.height / 100 || 1
      const rawX = dragValue(offset.x, x - startX, perX, { ...FLOAT_X_RANGE, step: 0.5 })
      const rawY = dragValue(offset.y, y - startY, perY, { ...FLOAT_Y_RANGE, step: 0.5 })
      const threshold = snapThreshold(isFree)
      const hitX = nearestSnap(rawX, [{ value: 0 }], perX, threshold)
      const hitY = nearestSnap(rawY, [{ value: 0 }], perY, threshold)
      next = { x: hitX?.value ?? rawX, y: hitY?.value ?? rawY }
      deps.previewed.add(el)
      el.style.left = `${next.x}%`
      el.style.right = `${-next.x}%`
      el.style.top = `${next.y}%`
      // 土台の位置にそろったら、そろえた線（左右＝土台の左右のまん中の縦線）をピンクで見せる
      const lines: GuideLine[] = hitX === null ? [] : [{ x: box.left + box.width / 2, top: box.top, bottom: box.bottom }]
      deps.selection.guides(lines)
      return floatWords(next)
    },
    commit: () => {
      if (from === null || next === null) return
      finish()
      deps.commit(next)
    },
    cancel: () => {
      if (from === null) return
      finish()
    },
  }
}
