/**
 * 新しい見本「3つの特徴（番号つき）」（2026-09-23）。
 *
 * 選ばれる理由を3つ。番号を大きく薄く敷き、見出しと説明を重ねる（同じ箱の反復にしない）。
 */
import { INK_SUB, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-pont0001'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .p-list{max-width:620px;margin:0 auto}` +
  `${s} .p-item{position:relative;padding:22px 0 22px 62px;border-bottom:1px solid ${LINE_LIGHT}}` +
  `${s} .p-item:first-child{border-top:1px solid ${LINE_LIGHT}}` +
  `${s} .p-no{position:absolute;left:0;top:18px;width:46px;font-size:34px;font-weight:800;line-height:1;` +
  `color:${ACCENT};opacity:.35;font-variant-numeric:tabular-nums;letter-spacing:-.03em}` +
  `${s} .p-head{font-size:17.5px;font-weight:800;line-height:1.55;margin:0 0 6px}` +
  `${s} .p-text{font-size:14.5px;line-height:1.9;color:${INK_SUB}}` +
  `@media (max-width:480px){${s} .p-item{padding-left:52px}${s} .p-no{font-size:28px;width:40px;top:20px}` +
  `${s} .p-head{font-size:16.5px}}`

const point = (no: string, title: string, text: string): string =>
  `<div class="p-item"><p class="p-no">${no}</p><h3 class="p-head">${title}</h3><p class="p-text">${text}</p></div>`

export const THREE_POINTS_SAMPLE: NewSample = {
  id: 'three-points',
  category: '特徴・価値',
  name: '3つの特徴（番号つき）',
  summary: '選ばれる理由を3つ。番号を薄く大きく敷いて、見出しと説明を読ませます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('選ばれている3つの理由') +
      '<div class="p-list">' +
      point('01', '準備がいらない', '届いたその日から使えます。道具をそろえたり、設定をしたりする必要はありません。') +
      point('02', '1日30秒でいい', '生活を変えずに続けられます。忙しい日は飛ばしても、翌日から戻れます。') +
      point('03', '合わなければ返せる', '30日間は理由を問わず返品できます。まず試してから決められます。') +
      '</div>',
  }),
}
