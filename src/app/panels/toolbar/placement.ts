/**
 * ツールバーの位置決め（企画書 §9-1）。
 * 実物は `_editorToolbarWrapper_` に `left` / `top` を直接書き込み、
 * 矢印（`_editorToolbarArrow_`）に `left` を書き込んでいた（採取物の inline style）。
 */
import type Quill from 'quill'
import { HOOK } from './hooks.ts'
import { SCROLLBAR_BAR_WIDTH } from '../editor-scrollbar.ts'

/** 指示135: ツールバーはスクロールバーの左横に置く。スクロールバー幅＋余白の分だけ右端から空ける。 */
const SCROLLBAR_GUTTER = SCROLLBAR_BAR_WIDTH + 6

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

  // 指示135: 横位置は選択範囲の中央ではなく「スクロールバーの左横」に固定する。
  // 縦位置(top)は選択範囲に追従させたまま、横はスクロールバーの左端の少し内側へ寄せる。
  // スクロールバーとツールバーの offsetParent が異なる場合があるので、
  // スクロールバーの実位置(viewport)を host 座標へ変換してから左に置く。
  const scrollbar = findScrollbar(quill)
  const toolbarW = wrapper.offsetWidth
  let leftPx: number
  if (scrollbar !== null) {
    const sbLeftInHost = scrollbar.getBoundingClientRect().left - hostRect.left
    leftPx = clamp(sbLeftInHost - toolbarW - 6, 0, Math.max(0, hostRect.width - toolbarW))
  } else {
    leftPx = clamp(hostRect.width - toolbarW - SCROLLBAR_GUTTER, 0, Math.max(0, hostRect.width - toolbarW))
  }
  wrapper.style.setProperty('left', `${leftPx}px`)
  wrapper.style.setProperty('top', `${placement.top}px`)

  const arrow = wrapper.querySelector<HTMLElement>(HOOK.arrow)
  if (arrow === null) return
  // 右寄せ固定なので選択範囲を指す矢印は意味を持たない → 隠す
  arrow.style.setProperty('display', 'none', 'important')
}

/** エディタ内のカスタムスクロールバー要素を探す（指示135のツールバー配置基準） */
function findScrollbar(quill: Quill): HTMLElement | null {
  const scope = quill.container.closest<HTMLElement>('.quillEditorContentWrapper') ?? document
  return scope.querySelector<HTMLElement>('[data-clone-scrollbar]')
}
