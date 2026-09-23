/**
 * 新しい見本「画像1枚（キャプション）」（2026-09-23）。
 *
 * 写真を1枚だけ大きく見せて、下に短い説明を置く区画。飾りを足さず、角丸も控えめにして
 * 写真そのものを見せる（枠線や影で囲まない）。
 */
import { IMAGE_PLACEHOLDER, INK_SUB, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-c0000007'
const s = `.${UID}`

const CSS =
  `${s} .e-figure{max-width:760px;margin:0 auto}` +
  `${s} .e-figure img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:4px}` +
  `${s} .e-cap{margin:12px 0 0;font-size:14.5px;line-height:1.85}` +
  `${s} .e-note{display:block;margin-top:6px;font-size:12px;line-height:1.8;color:${INK_SUB}}` +
  `@media (max-width:480px){${s} .e-figure img{aspect-ratio:4/3}${s} .e-cap{font-size:14px}}`

export const IMAGE_FULL_SAMPLE: NewSample = {
  id: 'image-full',
  category: '画像・動画',
  name: '画像1枚（キャプション）',
  summary: '写真を1枚だけ大きく。下に短い説明と注記を置く、飾りのない形です',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      '<figure class="e-figure">' +
      `<img src="${IMAGE_PLACEHOLDER}" alt="テーブルの上に置いて使っているところの写真">` +
      '<figcaption class="e-cap">朝の支度のあいだに、洗面台のとなりで使っているところです。' +
      '置き場所をとらない大きさなので、出しっぱなしにしておけます。' +
      '<span class="e-note">写真はイメージです。色や大きさは、実物と異なって見える場合があります。</span>' +
      '</figcaption>' +
      '</figure>',
  }),
}
