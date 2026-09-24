/**
 * 左の「部品を足す」からドラッグで運んで入れる（2026-09-24 画面の作り直し・本人「ドラッグ&ドロップで追加できるように」。
 * widget-studio-builder.ts から分けた）。
 *
 * - ふつうの部品: 運んでいる間は、入る所に青い線（部品の真ん中より上か下か）。離すとその位置に足して選ぶ。
 *   紙の外（灰色の地）で離しても、高さで入る位置を決める。移行先を被せた部品と、その移行先の間には入れない
 * - 移行先（2026-09-24・本人「ボタンやすでにあるウィジェットに被せて使う」）: 部品の上でだけ落とせる。
 *   運んでいる間は、被せる部品に薄い枠と、入る範囲の点線の影。離すと、落とした所に範囲を置いて、その部品の下に入れる
 * 文字として貼り付かないよう、既定の動きは止める
 */
import { blockElementAt } from './nocode/canvas-sync.ts'
import { HOTSPOT_TYPE, dropRect, groupEndOf, isHotspot } from './nocode/hotspot-model.ts'
import { NC_BLOCK_MIME, NC_HOTSPOT_MIME, type TemplateForm } from './nocode/template-form.ts'
import { items, str, type ItemData, type TemplateData } from './nocode/templates/types.ts'
import type { SelectionLayer } from './selection-layer.ts'

export interface BlockDropDeps {
  readonly editorBody: HTMLElement
  readonly contentDiv: HTMLElement
  readonly selection: SelectionLayer
  readonly form: TemplateForm
  readonly data: () => TemplateData
}

export function attachBlockDrop(deps: BlockDropDeps): void {
  const { editorBody, contentDiv, selection, form } = deps
  let dropAt: number | null = null

  const hasType = (event: DragEvent, mime: string): boolean => event.dataTransfer?.types.includes(mime) === true
  const blocksNow = (): readonly ItemData[] => items(items(deps.data(), 'screens')[form.activeScreen()] ?? {}, 'blocks')
  const elementAt = (index: number): HTMLElement | null => blockElementAt(deps.data(), contentDiv, form.activeScreen(), index)

  /** 入る位置（移行先でない部品の、真ん中より上か下か）。移行先を被せた部品のまとまりは分けない */
  const insertPointAt = (y: number): { index: number; lineY: number } => {
    const blocks = blocksNow()
    const parts = [...blocks.keys()]
      .filter((index) => !isHotspot(blocks[index]))
      .map((index) => ({ index, rect: elementAt(index)?.getBoundingClientRect() ?? null }))
      .filter((p): p is { index: number; rect: DOMRect } => p.rect !== null)
    const at = parts.filter((p) => p.rect.top + p.rect.height / 2 < y).length
    const before = parts[at - 1]
    const after = parts[at]
    const box = contentDiv.getBoundingClientRect()
    const lineY =
      before !== undefined && after !== undefined
        ? (before.rect.bottom + after.rect.top) / 2
        : after !== undefined
          ? after.rect.top - 4
          : before !== undefined
            ? before.rect.bottom + 4
            : box.top + 24
    const index = after !== undefined ? after.index : before !== undefined ? groupEndOf(blocks, before.index) : blocks.length
    return { index, lineY }
  }

  /** 移行先を被せる部品（手の下にある、移行先・区切り線でない部品） */
  const coverAt = (x: number, y: number): { index: number; el: HTMLElement; rect: DOMRect } | null => {
    const blocks = blocksNow()
    for (const [index, block] of blocks.entries()) {
      if (isHotspot(block) || str(block, 'type') === 'divider') continue
      const el = elementAt(index)
      const rect = el?.getBoundingClientRect()
      if (el === null || el === undefined || rect === undefined) continue
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return { index, el, rect }
    }
    return null
  }

  const clear = (): void => {
    dropAt = null
    selection.dropLine(null)
    selection.ghost(null)
    selection.hover(null)
  }

  editorBody.addEventListener('dragover', (event) => {
    if (!hasType(event, NC_BLOCK_MIME)) return
    const transfer = event.dataTransfer
    if (hasType(event, NC_HOTSPOT_MIME)) {
      const cover = coverAt(event.clientX, event.clientY)
      selection.dropLine(null)
      if (cover === null) {
        // 部品の上でないと落とせない（落とせない印のカーソルになる）
        selection.ghost(null)
        selection.hover(null)
        return
      }
      event.preventDefault()
      if (transfer !== null) transfer.dropEffect = 'copy'
      const r = dropRect(cover.rect, { x: event.clientX, y: event.clientY })
      selection.hover(cover.el, 'ここに移行先を被せる')
      selection.ghost({
        left: cover.rect.left + (r.x / 100) * cover.rect.width,
        top: cover.rect.top + (r.y / 100) * cover.rect.height,
        width: (r.w / 100) * cover.rect.width,
        height: (r.h / 100) * cover.rect.height,
      })
      return
    }
    event.preventDefault()
    if (transfer !== null) transfer.dropEffect = 'copy'
    const point = insertPointAt(event.clientY)
    dropAt = point.index
    const box = contentDiv.getBoundingClientRect()
    selection.dropLine({ y: point.lineY, left: box.left + 8, width: box.width - 16 })
  })
  editorBody.addEventListener('dragleave', (event) => {
    if (event.relatedTarget instanceof Node && editorBody.contains(event.relatedTarget)) return
    clear()
  })
  editorBody.addEventListener('drop', (event) => {
    if (!hasType(event, NC_BLOCK_MIME)) return
    event.preventDefault()
    const type = event.dataTransfer?.getData(NC_BLOCK_MIME) ?? ''
    if (type === HOTSPOT_TYPE) {
      const cover = coverAt(event.clientX, event.clientY)
      clear()
      if (cover === null) return
      const r = dropRect(cover.rect, { x: event.clientX, y: event.clientY })
      form.insertBlock(type, groupEndOf(blocksNow(), cover.index), { x: r.x, y: r.y, w: r.w, h: r.h })
      return
    }
    const at = dropAt ?? insertPointAt(event.clientY).index
    clear()
    if (type !== '') form.insertBlock(type, at)
  })
}
