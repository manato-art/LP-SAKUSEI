/**
 * Versionの編集画面の画像・動画の位置（左・中央・右・2026-10-18 本人「動画や画像の位置も左右で選びたい」）。
 *
 * - 画像は行の中の部品なので、画像のある行を寄せる（Quill の行の align。`<p class="ql-align-right"><img></p>`）。
 *   今のLPの中央の画像もこの形。配信の土台CSS（lp-base-css.ts）に `.ql-align-*` がある。
 * - 動画は1行まるごとの部品（`<video>` がそのまま並ぶ）なので、動画自身の左右の余白で寄せる。
 *   寄せ方は `data-sb-align` に持たせ、Quill が動画を作り直しても（戻す・貼り付け）付け直せるようにする。
 *   左は今までどおり（印も余白も付けない）。
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

/** 画像の今の位置（画像のある行の寄せ）。Widget の中など、ここで寄せられない画像は null */
export function imageAlignOf(img: Element): MediaAlign | null {
  const line = lineElementOf(img)
  if (line === null || line.classList.contains('sb-widget-block')) return null
  if (line.classList.contains('ql-align-center')) return 'center'
  if (line.classList.contains('ql-align-right')) return 'right'
  return 'left'
}

/** 動画の今の位置 */
export function videoAlignOf(video: Element): MediaAlign {
  const value = video.getAttribute(VIDEO_ALIGN_ATTR)
  return value === 'center' || value === 'right' ? value : 'left'
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
  // 余白で寄せるには塊の要素である必要がある（配信の土台CSSも video は block）
  video.style.setProperty('display', 'block')
  video.style.setProperty('margin-left', 'auto')
  video.style.setProperty('margin-right', align === 'center' ? 'auto' : '0px')
}
