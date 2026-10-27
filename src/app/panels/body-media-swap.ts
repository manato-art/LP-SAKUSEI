/**
 * Versionの編集画面（通常画面）の本文で、画像⇄動画を入れ替える（2026-10-27 本人「画像を動画に・その逆も」→「全部。通常画面も」）。
 *
 * 本文の画像（image ブロット・行の中の部品）と動画（sbvideo ブロット・ひとかたまりの行）は Quill の部品なので、
 * DOM を直接入れ替えると Quill の中身とずれる。Quill の変更（updateContents）で入れ替える。
 * Widget の中の画像・動画は Quill の部品ではない（Widget はひとかたまり）ので、DOM で入れ替える（media-swap.ts）。
 *
 * 引き継ぐもの: 位置（左・中央・右）・幅。画像→動画は自動で再生・音なし・くり返し（本人の決定）。
 * 画像だけの設定（リンク・計測URL・アニメーション）は、本文の動画には付けられないので外れる（呼ぶ側が知らせる）。
 *
 * Quill を読み込まない（型だけ・node のテストから読めるように）。
 */
import type Quill from 'quill'
import type { Op } from 'quill'
import { imageAlignOf, lineAlignOf, videoAlignOf, type MediaAlign } from './media-align.ts'
import { swapImageForVideo, swapVideoForImage } from './media-swap.ts'
import { notifyEditorChanged } from './editor-change.ts'

/** 本文の画像だけが持てる設定（動画にすると外れる） */
const IMAGE_ONLY_SETTINGS = ['data-link-url', 'data-tracking-urls', 'data-anim'] as const

/** 動画にすると外れる設定が付いているか（リンク・計測URL・アニメーション） */
export function hasImageOnlySettings(img: Element): boolean {
  return IMAGE_ONLY_SETTINGS.some((name) => (img.getAttribute(name) ?? '') !== '')
}

/** 幅の指定（px の数だけ）。指定が無い・% のときは null */
function pxWidthOf(el: HTMLElement): string | null {
  const match = /^(\d+(?:\.\d+)?)px$/.exec(el.style.width)
  return match?.[1] === undefined ? null : String(Math.round(Number(match[1])))
}

/**
 * 画像（index の位置）を動画にする変更。画像だけの行なら行ごと動画にする
 * （動画はひとかたまりの行なので、行の終わりを残すと下に空の行が増える）。文の途中の画像なら、そこで行を分ける
 */
export function imageToVideoOps(index: number, wholeLine: boolean, align: MediaAlign, src: string): Op[] {
  return [
    ...(index > 0 ? [{ retain: index }] : []),
    { insert: { sbvideo: { src, loop: 'on', autoplay: 'on', muted: 'on', align } } },
    { delete: wholeLine ? 2 : 1 },
  ]
}

/** 動画（index の位置）を画像だけの行にする変更。位置は行の寄せで、幅は画像の幅で持つ */
export function videoToImageOps(index: number, align: MediaAlign, src: string, width: string | null): Op[] {
  const lineAlign = lineAlignOf(align)
  return [
    ...(index > 0 ? [{ retain: index }] : []),
    { insert: { image: width === null ? { src } : { src, width } } },
    lineAlign === false ? { insert: '\n' } : { insert: '\n', attributes: { align: lineAlign } },
    { delete: 1 },
  ]
}

/** 幅を px で持たせる（動画の幅の決め方と同じ・properties-video.ts の applyWidth） */
function setVideoWidth(video: HTMLElement, px: string): void {
  video.style.width = `${px}px`
  video.style.height = 'auto'
  video.setAttribute('width', px)
  video.removeAttribute('height')
}

/** 本文の画像を、選んだ動画に入れ替える。新しい動画を返す（入れ替えられなかったら null） */
export function swapBodyImageForVideo(quill: Quill, img: HTMLImageElement, src: string): HTMLVideoElement | null {
  const blot = quill.scroll.find(img)
  if (blot === null) {
    // Widget の中の画像（Quill の部品ではない）
    const video = swapImageForVideo(img, src)
    notifyEditorChanged(quill.root)
    return video instanceof HTMLVideoElement ? video : null
  }
  const index = quill.getIndex(blot)
  const [line] = quill.getLine(index)
  // 画像だけの行で、そのあとにも行があるとき（最後の行の終わりは Quill が消させない）
  const wholeLine = line !== null && line.length() === 2 && index + 2 < quill.getLength()
  const width = pxWidthOf(img)
  quill.updateContents(imageToVideoOps(index, wholeLine, imageAlignOf(img) ?? 'left', src), 'user')
  const [placed] = quill.getLine(index)
  const video = placed?.domNode
  if (!(video instanceof HTMLVideoElement)) return null
  if (width !== null) {
    setVideoWidth(video, width)
    quill.update()
  }
  return video
}

/** 本文の動画を、選んだ画像に入れ替える。新しい画像を返す（入れ替えられなかったら null） */
export function swapBodyVideoForImage(quill: Quill, video: HTMLVideoElement, src: string): HTMLImageElement | null {
  const blot = quill.scroll.find(video)
  if (blot === null) {
    // Widget の中の動画（Quill の部品ではない）
    const img = swapVideoForImage(video, src)
    notifyEditorChanged(quill.root)
    return img instanceof HTMLImageElement ? img : null
  }
  const index = quill.getIndex(blot)
  const fullWidth = video.style.width.endsWith('%') ? video.style.width : null
  quill.updateContents(videoToImageOps(index, videoAlignOf(video), src, pxWidthOf(video)), 'user')
  const [leaf] = quill.getLeaf(index)
  const img = leaf?.domNode
  if (!(img instanceof HTMLImageElement)) return null
  if (fullWidth !== null) {
    // 「幅いっぱい」の動画は、画像も幅いっぱいに（保存は DOM から・自動保存へ合図）
    img.style.width = fullWidth
    img.style.height = 'auto'
    notifyEditorChanged(quill.root)
  }
  return img
}
