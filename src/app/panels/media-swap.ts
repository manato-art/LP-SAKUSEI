/**
 * 画像⇄動画の入れ替え（2026-10-27 本人「widgetで画像を動画に変えれないからできるようにして。その逆も同じ」）。
 *
 * 本人の決定: 入れ替えられる場所は全部（部品・見本の中・コードのWidget・通常画面）／画像→動画は自動で再生・音なし・くり返し。
 * 見た目のクラス・幅（style）・押したとき（data-nc-go 等）など、その場所の設定は引き継ぐ。
 * 画像だけ・動画だけの設定（画像の説明・遅れて読む印・再生の設定・最初の絵・<source> など）は持ち越さない。
 * 元の大きさの width/height 属性も持ち越さない（画像と動画で縦横の比が違うと、つぶれて見える）。
 *
 * 使う所: Widget編集の画像・動画を押した小窓（widget-media-control.ts）・見本の中の画像・動画（sample-dom.ts）・通常画面の Widget の中（body-media-swap.ts）。
 */

/** 画像だけの属性（動画へは持ち越さない） */
const IMAGE_ONLY: ReadonlySet<string> = new Set([
  'src', 'srcset', 'sizes', 'alt', 'loading', 'decoding', 'fetchpriority', 'usemap', 'ismap',
  'data-src', 'data-srcset', 'data-ll-status', 'width', 'height',
])

/** 動画だけの属性（画像へは持ち越さない）。data-sb-* は編集画面で切った再生の設定の印（lp-video.ts） */
const VIDEO_ONLY: ReadonlySet<string> = new Set([
  'src', 'autoplay', 'muted', 'loop', 'playsinline', 'webkit-playsinline', 'controls', 'controlslist', 'preload', 'poster',
  'disablepictureinpicture', 'disableremoteplayback', 'data-sb-autoplay', 'data-sb-loop', 'data-sb-muted', 'width', 'height',
])

/** 遅れて読む仕組み（LazyLoad）が付ける印。入れ替えた先では意味がない */
const LAZY_CLASSES: ReadonlySet<string> = new Set(['lazyload', 'lazyloaded', 'entered', 'loaded', 'loading'])

/** from の属性のうち、drop に無いものを to へ写す（class は遅れて読む印を外し、extraClass を前に足す） */
function carryAttributes(from: Element, to: Element, drop: ReadonlySet<string>, extraClass = ''): void {
  const classes = [...extraClass.split(/\s+/), ...(from.getAttribute('class') ?? '').split(/\s+/)].filter(
    (name) => name !== '' && !LAZY_CLASSES.has(name),
  )
  if (classes.length > 0) to.setAttribute('class', classes.join(' '))
  for (const attr of Array.from(from.attributes)) {
    if (attr.name !== 'class' && !drop.has(attr.name)) to.setAttribute(attr.name, attr.value)
  }
}

/** 画像を、選んだ動画に入れ替える（自動で再生・音なし・くり返し）。<picture> の中なら <picture> ごと。新しい動画を返す */
export function swapImageForVideo(img: Element, src: string): Element {
  const picture = img.parentElement?.tagName.toUpperCase() === 'PICTURE' ? img.parentElement : null
  const video = img.ownerDocument.createElement('video')
  carryAttributes(img, video, IMAGE_ONLY, picture?.getAttribute('class') ?? '')
  video.setAttribute('src', src)
  for (const flag of ['autoplay', 'muted', 'loop', 'playsinline']) video.setAttribute(flag, '')
  video.setAttribute('preload', 'metadata')
  // 属性だけでは音なしにならない（作ったあとに付けた muted は最初の状態にしか効かない）ので、ブラウザでは値もそろえる
  if ('muted' in video) (video as HTMLVideoElement).muted = true
  ;(picture ?? img).replaceWith(video)
  return video
}

/** 動画を、選んだ画像に入れ替える（<source>・再生の設定・最初の絵は外す）。新しい画像を返す */
export function swapVideoForImage(video: Element, src: string): Element {
  const img = video.ownerDocument.createElement('img')
  carryAttributes(video, img, VIDEO_ONLY)
  img.setAttribute('src', src)
  img.setAttribute('alt', '')
  video.replaceWith(img)
  return img
}
