/**
 * Versionの編集画面の画像・動画の位置（左・中央・右・2026-10-18 本人「動画や画像の位置も左右で選びたい」）。
 *
 * 位置の決まり方は2通りある:
 * - 要素自身の左右の余白（塊の要素＋margin auto）… 動画、と大きさをつまんで変えた画像（image-resize.ts が
 *   `display:block` にする）。この余白があると、行の寄せ（text-align）は効かない。
 *   以前は大きさを変えると必ず真ん中の余白を付けていて、行を寄せても動かなかった（本人「配置変わらない」）。
 * - 行の寄せ（Quill の行の align＝`ql-align-center` / `ql-align-right`）… 大きさを変えていない画像（行の中の部品）。
 *   配信の土台CSS（lp-base-css.ts）に `.ql-align-*` がある。
 *
 * 動画は寄せ方を `data-sb-align` にも持たせ、Quill が動画を作り直しても（戻す・貼り付け）付け直せるようにする。
 *
 * Quill を読み込まない（node のテストから読めるように）。
 */

export type MediaAlign = 'left' | 'center' | 'right'

export const VIDEO_ALIGN_ATTR = 'data-sb-align'

/** 画像の位置を、Quill の行の寄せ（formatLine の 'align' の値）にする */
export function lineAlignOf(align: MediaAlign): false | 'center' | 'right' {
  return align === 'left' ? false : align
}

/** 編集画面の本文（.ql-editor）の直下の要素＝画像のある行。本文の外なら null */
function lineElementOf(el: Element): Element | null {
  let cur: Element | null = el
  while (cur !== null && cur.parentElement !== null && !cur.parentElement.classList.contains('ql-editor')) {
    cur = cur.parentElement
  }
  return cur?.parentElement?.classList.contains('ql-editor') === true ? cur : null
}

/** 要素自身の左右の余白から位置を読む（余白で寄せていなければ null） */
function alignOfOwnMargins(el: HTMLElement): MediaAlign | null {
  const left = el.style.marginLeft
  const right = el.style.marginRight
  if (left === 'auto' && right === 'auto') return 'center'
  if (left === 'auto') return 'right'
  if (right === 'auto') return 'left'
  return null
}

/** 要素自身を塊にして、左右の余白で寄せる */
function setOwnMargins(el: HTMLElement, align: MediaAlign): void {
  el.style.setProperty('display', 'block')
  el.style.setProperty('margin-left', align === 'left' ? '0px' : 'auto')
  el.style.setProperty('margin-right', align === 'right' ? '0px' : 'auto')
}

/** 大きさをつまんで変えた画像（塊の要素になっている）か */
const isBlockImage = (img: HTMLElement): boolean => img.style.display === 'block'

/** 画像の今の位置。Widget の中など、ここで寄せられない画像は null */
export function imageAlignOf(img: HTMLElement): MediaAlign | null {
  const line = lineElementOf(img)
  if (line === null || line.classList.contains('sb-widget-block')) return null
  if (isBlockImage(img)) {
    const own = alignOfOwnMargins(img)
    if (own !== null) return own
  }
  if (line.classList.contains('ql-align-center')) return 'center'
  if (line.classList.contains('ql-align-right')) return 'right'
  return 'left'
}

/**
 * 画像を寄せる（画像自身のぶん）。大きさを変えた画像は余白で寄せる。
 * 行の寄せは Quill で付ける（呼ぶ側が formatLine。大きさを変えていない画像はそれで動く）
 */
export function applyImageAlign(img: HTMLElement, align: MediaAlign): void {
  if (isBlockImage(img)) setOwnMargins(img, align)
}

/** 動画の今の位置 */
export function videoAlignOf(video: HTMLElement): MediaAlign {
  const value = video.getAttribute(VIDEO_ALIGN_ATTR)
  if (value === 'center' || value === 'right') return value
  // 印の無い動画でも、大きさを変えたときの真ん中の余白が付いていることがある
  return alignOfOwnMargins(video) ?? 'left'
}

/** 動画を寄せる（幅など、ほかの指定はそのまま） */
export function applyVideoAlign(video: HTMLElement, align: MediaAlign): void {
  if (align === 'left') {
    video.removeAttribute(VIDEO_ALIGN_ATTR)
    video.style.removeProperty('margin-left')
    video.style.removeProperty('margin-right')
    return
  }
  video.setAttribute(VIDEO_ALIGN_ATTR, align)
  setOwnMargins(video, align)
}

/**
 * 大きさをつまんで変えるとき、今の位置を保つ（image-resize.ts）。
 * 画像は塊にする前に今の位置（行の寄せ）を読み、その位置の余白を付ける。Widget の中の画像は以前どおり真ん中。
 */
export function keepAlignOnResize(el: HTMLElement): void {
  if (el.tagName === 'VIDEO') {
    applyVideoAlign(el, videoAlignOf(el))
    return
  }
  setOwnMargins(el, imageAlignOf(el) ?? 'center')
}
