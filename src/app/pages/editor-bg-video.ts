/**
 * 記事設定の背景が動画のとき、編集画面のキャンバスにも動画を敷く（2026-10-27 本人「記事設定の背景も動画OKにする」）。
 *
 * 画像の背景は CSS の変数で効かせている（editor-layout.ts の applyCanvasBackground・指示179）が、動画は CSS の背景にできない。
 *   全体背景      … 土台（`.quillEditorContentWrapper`）のいちばん後ろに動画を敷く
 *   Version背景   … 本文（`.ql-editor`）と同じ場所・大きさに、スクロールの中で動画を敷き、本文の白い地を外す
 * 動画は Quill の外（本文の中には入れない＝保存する中身に混ざらない）。設定が動画でなくなったら外す。
 */
import { isVideoBackground, type MasterStyleSheet } from '../master-style.ts'
import { pageLife } from '../page-life.ts'

const MARK = 'data-lp-bgv'
const LAYER = 'position:absolute;object-fit:cover;z-index:-1;pointer-events:none;margin:0;max-width:none'

/** 本文の大きさを追いかける見張り（Version背景の動画の大きさを合わせる） */
let innerObserver: ResizeObserver | null = null

/** parent の直下に、kind の動画を src で置く（無ければ作る） */
function ensureVideo(parent: HTMLElement, kind: 'outer' | 'inner', src: string): HTMLVideoElement {
  const found = parent.querySelector<HTMLVideoElement>(`:scope > video[${MARK}="${kind}"]`)
  const video = found ?? document.createElement('video')
  if (found === null) {
    video.setAttribute(MARK, kind)
    video.setAttribute('aria-hidden', 'true')
    video.muted = true
    video.loop = true
    video.autoplay = true
    video.playsInline = true
    parent.prepend(video)
  }
  if (video.getAttribute('src') !== src) video.setAttribute('src', src)
  return video
}

function removeVideo(parent: HTMLElement | null, kind: 'outer' | 'inner'): void {
  parent?.querySelector(`:scope > video[${MARK}="${kind}"]`)?.remove()
}

/** 記事設定の背景の動画を、編集画面のキャンバスへ（動画でなければ外す） */
export function applyEditorBgVideos(quillRoot: HTMLElement, sheet: MasterStyleSheet): void {
  const base = quillRoot.closest<HTMLElement>('.quillEditorContentWrapper')
  const scroller = quillRoot.parentElement
  if (base === null || scroller === null) return

  if (isVideoBackground(sheet.outer_background_image)) {
    // 土台の重なりを閉じ、動画を土台の色の上・中身の下に置く
    base.style.isolation = 'isolate'
    ensureVideo(base, 'outer', sheet.outer_background_image).style.cssText = `${LAYER};inset:0;width:100%;height:100%`
  } else {
    removeVideo(base, 'outer')
  }

  innerObserver?.disconnect()
  innerObserver = null
  if (isVideoBackground(sheet.inner_background_image)) {
    scroller.style.isolation = 'isolate'
    // 本文の白い地（--lp-page-bg）を外して、後ろの動画が見えるように
    base.style.setProperty('--lp-page-bg', 'transparent')
    const video = ensureVideo(scroller, 'inner', sheet.inner_background_image)
    const fit = (): void => {
      video.style.cssText =
        `${LAYER};left:${quillRoot.offsetLeft}px;top:${quillRoot.offsetTop}px;` +
        `width:${quillRoot.offsetWidth}px;height:${quillRoot.offsetHeight}px`
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(quillRoot)
    innerObserver = observer
    // 画面を移ったら見張りを外す（前の編集画面をつかみ続けないように・page-life.ts）
    pageLife().addEventListener('abort', () => observer.disconnect(), { once: true })
  } else {
    removeVideo(scroller, 'inner')
  }
}
