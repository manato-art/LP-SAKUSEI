/**
 * 新しい見本「画像3枚並べ」（2026-09-23）。
 *
 * 色違い・場面違いの写真を3枚並べる区画。PCは横3列、狭い画面は2列にして、
 * 1枚ずつに短い説明を付ける。写真を箱で囲まず、文字だけを下に置く。
 */
import { IMAGE_PLACEHOLDER, INK_SUB, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-c0000008'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .g-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;max-width:720px;margin:0 auto}` +
  `${s} .g-item img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:4px}` +
  `${s} .g-name{display:block;margin:10px 0 2px;font-size:14.5px;font-weight:800;line-height:1.6}` +
  `${s} .g-text{font-size:13px;line-height:1.8;color:${INK_SUB}}` +
  `@media (max-width:560px){${s} .g-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 12px}` +
  `${s} .g-name{font-size:14px;margin-top:8px}${s} .g-text{font-size:12.5px}}`

const shot = (name: string, text: string, alt: string): string =>
  `<figure class="g-item"><img src="${IMAGE_PLACEHOLDER}" alt="${alt}">` +
  `<figcaption><span class="g-name">${name}</span><span class="g-text">${text}</span></figcaption></figure>`

export const IMAGE_GALLERY3_SAMPLE: NewSample = {
  id: 'image-gallery3',
  category: '画像・動画',
  name: '画像3枚並べ',
  summary: '写真を3枚。PCは横3列、狭い画面は2列。1枚ずつに短い説明を付けます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('3つの色からお選びいただけます', '写真はすべて同じ大きさのものです。届いてから色を交換することもできます。') +
      '<div class="g-grid">' +
      shot('ホワイト', '明るい洗面台になじむ色です。いちばん多く選ばれています。', 'ホワイトの本体の写真') +
      shot('グレー', '机の上に置いても目立ちにくい色です。', 'グレーの本体の写真') +
      shot('ネイビー', '落ち着いた色で、汚れが目立ちにくいのが特徴です。', 'ネイビーの本体の写真') +
      '</div>',
  }),
}
