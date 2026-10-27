/**
 * リンク置換の一覧の、画像・動画の行の小さなサムネ（2026-10-27 指示㉗ 本人「画像と動画は小さくサムネを載せて欲しい・容量食うならやめる」）。
 *
 * 容量を食わないように、新しく読み込まない: 編集画面にもう出ている画像・動画（同じ要素）から、小さな canvas に描き写す
 * （1枚 88×88 の絵＝約30KB の作業用の場所だけ。画像・動画をもう一度読み込んだり、ほどき直したりしない）。
 * 動画は、今出ている場面を写す。まだ読み込み中なら、読み込めたときに写す。
 */
import type { LpLink } from '../../shared/link-html.ts'

/** 見た目の大きさ（px）。実際の絵は画面の細かさに合わせて最大2倍 */
const THUMB_SIZE = 44

type Media = HTMLImageElement | HTMLVideoElement

/**
 * 一覧の行（リンクの番号）と、本文の画像・動画の要素を結ぶ。
 * リンクの付いた画像・動画の「何番目か」で結ぶ（本文の文字から数えた番号と、要素の並びは同じ順）
 */
export function mediaElementsByIndex(body: ParentNode, allLinks: readonly LpLink[]): ReadonlyMap<number, Media> {
  const images = [...body.querySelectorAll<HTMLImageElement>('img[data-link-url]:not([data-link-url=""])')]
  const videos = [...body.querySelectorAll<HTMLVideoElement>('video[data-link-url]:not([data-link-url=""])')]
  const out = new Map<number, Media>()
  let image = 0
  let video = 0
  for (const link of allLinks) {
    const el = link.kind === 'image' ? images[image++] : link.kind === 'video' ? videos[video++] : undefined
    if (el !== undefined) out.set(link.index, el)
  }
  return out
}

/** 画像・動画の今の絵を、小さな canvas に描き写す（中を切り抜いて四角に収める） */
export function mediaThumb(el: Media): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.className = 'lr-thumb'
  canvas.setAttribute('data-link-thumb', '')
  canvas.setAttribute('aria-hidden', 'true')
  const scale = Math.min(2, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1)
  canvas.width = THUMB_SIZE * scale
  canvas.height = THUMB_SIZE * scale
  const isVideo = el.tagName === 'VIDEO'
  const draw = (): boolean => {
    const w = isVideo ? (el as HTMLVideoElement).videoWidth : (el as HTMLImageElement).naturalWidth
    const h = isVideo ? (el as HTMLVideoElement).videoHeight : (el as HTMLImageElement).naturalHeight
    const ctx = typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null
    if (ctx === null || !w || !h) return false
    const fit = Math.max(canvas.width / w, canvas.height / h)
    try {
      ctx.drawImage(el, (canvas.width - w * fit) / 2, (canvas.height - h * fit) / 2, w * fit, h * fit)
      return true
    } catch {
      // 描けない（壊れた画像など）ときは、灰色の四角のまま
      return false
    }
  }
  if (!draw()) el.addEventListener(isVideo ? 'loadeddata' : 'load', () => draw(), { once: true })
  return canvas
}
