/**
 * 記事設定の背景の画像・動画を、編集画面のキャンバスのいちばん後ろに敷く（配信と同じく、画面に固定した壁紙）。
 * 2026-10-27 本人「記事設定の背景も動画OKにする」→「背景の画像は画面に固定した壁紙に（最背面に）」。
 *
 *   全体背景      … 土台（`.quillEditorContentWrapper`）の見えている所いっぱい
 *   Version背景   … 本文（`.ql-editor`）の左右の幅で、スクロールする所（`.ql-container`）の見えている上から下まで。
 *                   本文の白い地を外して見せる
 * 層は土台（スクロールしない）に置くので、本文をスクロールしても動かない。Quill の外（保存する中身に混ざらない）。
 * 色は今までどおり CSS の変数（editor-layout.ts の applyCanvasBackground）。設定が画像・動画でなくなったら層を外す。
 */
import { cssUrl, isVideoBackground, type MasterStyleSheet } from '../master-style.ts'
import { pageLife } from '../page-life.ts'

const MARK = 'data-lp-bg'
const LAYER =
  'position:absolute;z-index:-1;pointer-events:none;margin:0;padding:0;border:0;max-width:none;object-fit:cover;' +
  'background-position:center;background-size:cover;background-repeat:no-repeat'

type Kind = 'outer' | 'inner'

/** Version背景の層の場所を、本文・スクロールする所の大きさに合わせ続ける見張り */
let innerObserver: ResizeObserver | null = null

/** 土台の直下に、kind の層を置く（画像なら div・動画なら video。今の物が合っていればそれを使う） */
function ensureLayer(base: HTMLElement, kind: Kind, src: string): HTMLElement {
  const isVideo = isVideoBackground(src)
  const found = base.querySelector<HTMLElement>(`:scope > [${MARK}="${kind}"]`)
  const layer = found !== null && found.tagName === (isVideo ? 'VIDEO' : 'DIV') ? found : createLayer(base, kind, isVideo, found)
  if (isVideo && layer.getAttribute('src') !== src) layer.setAttribute('src', src)
  return layer
}

function createLayer(base: HTMLElement, kind: Kind, isVideo: boolean, old: HTMLElement | null): HTMLElement {
  old?.remove()
  const layer = document.createElement(isVideo ? 'video' : 'div')
  layer.setAttribute(MARK, kind)
  layer.setAttribute('aria-hidden', 'true')
  if (layer instanceof HTMLVideoElement) {
    layer.muted = true
    layer.loop = true
    layer.autoplay = true
    layer.playsInline = true
  }
  // 全体背景の層を先（下）に、Version背景の層をその上に
  const outer = kind === 'inner' ? base.querySelector(`:scope > [${MARK}="outer"]`) : null
  if (outer === null) base.prepend(layer)
  else outer.after(layer)
  return layer
}

/** 層の場所・大きさ（box）。画像なら背景の画像も */
function place(layer: HTMLElement, src: string, box: string): void {
  layer.setAttribute('style', `${LAYER};${box}${layer.tagName === 'DIV' ? `;background-image:url("${cssUrl(src)}")` : ''}`)
}

function removeLayer(base: HTMLElement, kind: Kind): void {
  base.querySelector(`:scope > [${MARK}="${kind}"]`)?.remove()
}

/** 記事設定の背景の画像・動画を、編集画面のキャンバスへ（画像・動画でなければ外す） */
export function applyEditorBgLayers(quillRoot: HTMLElement, sheet: MasterStyleSheet): void {
  const base = quillRoot.closest<HTMLElement>('.quillEditorContentWrapper')
  const scroller = quillRoot.parentElement
  if (base === null || scroller === null) return
  // 土台の重なりを閉じ、層を土台の色の上・中身の下に置く
  base.style.isolation = 'isolate'

  if (sheet.outer_background_image !== '') {
    place(ensureLayer(base, 'outer', sheet.outer_background_image), sheet.outer_background_image, 'inset:0;width:100%;height:100%')
  } else {
    removeLayer(base, 'outer')
  }

  innerObserver?.disconnect()
  innerObserver = null
  if (sheet.inner_background_image === '') {
    removeLayer(base, 'inner')
    base.style.removeProperty('--lp-page-frame')
    base.style.removeProperty('--lp-page-shadow')
    return
  }
  // 本文の白い地（--lp-page-bg）を外して、後ろの層が見えるように
  base.style.setProperty('--lp-page-bg', 'transparent')
  // 本文の箱の枠線と影も消す。画像は本文の幅で画面いっぱいに敷くので、箱の上下の線が画像の上に
  // 白い線として浮いていた（2026-10-27 指示⑯）
  base.style.setProperty('--lp-page-frame', 'transparent')
  base.style.setProperty('--lp-page-shadow', 'none')
  const src = sheet.inner_background_image
  const layer = ensureLayer(base, 'inner', src)
  const fit = (): void => {
    const baseBox = base.getBoundingClientRect()
    const pageBox = quillRoot.getBoundingClientRect()
    const viewBox = scroller.getBoundingClientRect()
    place(
      layer,
      src,
      `left:${pageBox.left - baseBox.left}px;top:${viewBox.top - baseBox.top}px;width:${pageBox.width}px;height:${scroller.clientHeight}px`,
    )
  }
  fit()
  const observer = new ResizeObserver(fit)
  for (const el of [quillRoot, scroller, base]) observer.observe(el)
  innerObserver = observer
  // 画面を移ったら見張りを外す（前の編集画面をつかみ続けないように・page-life.ts）
  pageLife().addEventListener('abort', () => observer.disconnect(), { once: true })
}
