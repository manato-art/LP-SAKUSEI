/**
 * 新しい見本「画像と文章（左右交互・2件）」（2026-09-23）。
 *
 * 使い方や中身を、写真と短い文章で説明する区画。狭い画面では画像が上、文章が下に縦積み。
 */
import { IMAGE_PLACEHOLDER, INK_SUB, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-imtx0001'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .i-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:20px;align-items:center;` +
  `max-width:620px;margin:0 auto}` +
  `${s} .i-row+.i-row{margin-top:32px}` +
  `${s} .i-row--right .i-img{order:2}` +
  `${s} .i-img img{width:100%;border-radius:12px}` +
  `${s} .i-step{display:block;margin:0 0 6px;font-size:12.5px;font-weight:800;letter-spacing:.06em;color:${ACCENT}}` +
  `${s} .i-head{font-size:17.5px;font-weight:800;line-height:1.55;margin:0 0 8px}` +
  `${s} .i-text{font-size:14.5px;line-height:1.9;color:${INK_SUB}}` +
  `@media (max-width:560px){${s} .i-row{grid-template-columns:minmax(0,1fr);gap:14px}` +
  `${s} .i-row--right .i-img{order:0}${s} .i-row+.i-row{margin-top:28px}}`

const row = (side: 'left' | 'right', step: string, title: string, text: string, alt: string): string =>
  `<div class="i-row i-row--${side}">` +
  `<figure class="i-img"><img src="${IMAGE_PLACEHOLDER}" alt="${alt}"></figure>` +
  `<div class="i-body"><span class="i-step">${step}</span><h3 class="i-head">${title}</h3><p class="i-text">${text}</p></div>` +
  '</div>'

export const IMAGE_TEXT_SAMPLE: NewSample = {
  id: 'image-text',
  category: '説明・使い方',
  name: '画像と文章（左右交互・2件）',
  summary: '写真と短い説明を左右交互に。狭い画面では画像が上、文章が下になります',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('使い方は、かんたんです', '道具も準備もいりません。届いたその日から始められます。') +
      row('left', 'STEP 1', '袋から出して、置くだけ', '工具は使いません。箱から出して、いつもの場所に置けば準備は終わりです。', '箱から出したところの写真') +
      row('right', 'STEP 2', '1日30秒、続けるだけ', '朝でも夜でもかまいません。忙しい日は飛ばしても、翌日から戻れます。', '使っているところの写真'),
  }),
}
