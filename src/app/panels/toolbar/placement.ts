/**
 * ツールバーの位置決め（企画書 §9-1）。
 * 実物は `_editorToolbarWrapper_` に `left` / `top` を直接書き込み、
 * 矢印（`_editorToolbarArrow_`）に `left` を書き込んでいた（採取物の inline style）。
 */
import type Quill from 'quill'
import { CLS, HOOK } from './hooks.ts'

/** Quill の選択範囲（Range を値として import しないための最小形） */
export interface QuillRange {
  readonly index: number
  readonly length: number
}

export interface Box {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

export interface ToolbarPlacement {
  readonly left: number
  readonly top: number
  readonly arrowLeft: number
  readonly placement: 'above' | 'below'
}

/** 矢印が角に寄りすぎないための余白（実物の `left: 20px` / `left: 7px` から） */
const ARROW_EDGE = 12

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * ツールバーの表示位置。
 * 座標はすべて「位置決めの基準になる箱（offsetParent）」の左上を原点とする。
 */
export function computeToolbarPosition(
  selection: Box,
  toolbar: { readonly width: number; readonly height: number },
  host: { readonly width: number; readonly height: number },
  gap = 10,
): ToolbarPlacement {
  const centerX = selection.left + selection.width / 2
  const left = clamp(centerX - toolbar.width / 2, 0, Math.max(0, host.width - toolbar.width))

  const aboveTop = selection.top - toolbar.height - gap
  const belowTop = selection.top + selection.height + gap
  const fitsAbove = aboveTop >= 0
  const fitsBelow = belowTop + toolbar.height <= host.height
  const placement: 'above' | 'below' = fitsAbove || !fitsBelow ? 'above' : 'below'

  const top = placement === 'above' ? Math.max(0, aboveTop) : belowTop
  const arrowLeft = clamp(centerX - left, ARROW_EDGE, Math.max(ARROW_EDGE, toolbar.width - ARROW_EDGE))
  return { left, top, arrowLeft, placement }
}

/** 実物と同じく、ツールバー本体に `left` / `top` を直接書き込む */
export function positionToolbar(wrapper: HTMLElement, quill: Quill, range: QuillRange): void {
  const bounds = quill.getBounds(range.index, range.length)
  if (bounds === null) return

  const host = (wrapper.offsetParent ?? wrapper.parentElement) as HTMLElement | null
  if (host === null) return
  const hostRect = host.getBoundingClientRect()
  const editorRect = quill.container.getBoundingClientRect()

  const selection: Box = {
    left: editorRect.left + bounds.left - hostRect.left,
    top: editorRect.top + bounds.top - hostRect.top,
    width: bounds.width,
    height: bounds.height,
  }
  const placement = computeToolbarPosition(
    selection,
    { width: wrapper.offsetWidth, height: wrapper.offsetHeight },
    { width: hostRect.width, height: hostRect.height },
  )

  wrapper.style.setProperty('left', `${placement.left}px`)
  wrapper.style.setProperty('top', `${placement.top}px`)

  const arrow = wrapper.querySelector<HTMLElement>(HOOK.arrow)
  if (arrow === null) return
  arrow.classList.remove(CLS.arrowTop, CLS.arrowBottom)
  arrow.classList.add(placement.placement === 'above' ? CLS.arrowBottom : CLS.arrowTop)
  // 実物も矢印には `left` だけを inline で書いていた（中央寄せの margin-left は実CSS側にある）
  arrow.style.setProperty('left', `${placement.arrowLeft}px`)
}
