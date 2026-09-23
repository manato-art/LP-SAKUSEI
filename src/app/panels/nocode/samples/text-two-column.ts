/**
 * 新しい見本「2段組の文章」（2026-09-23）。
 *
 * 性質のちがう2つの話を横に並べる区画。囲みは作らず、上に細い線を1本引いて区切るだけにする。
 * 狭い画面（560px以下）では1列に積み替える。
 */
import { INK_SUB, LINE_LIGHT, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-h0000005'
const s = `.${UID}`

const CSS =
  `${s} .c-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:26px 32px;` +
  `max-width:620px;margin:0 auto}` +
  `${s} .c-col{min-width:0;border-top:1px solid ${LINE_LIGHT};padding-top:14px}` +
  `${s} .c-head{font-size:16.5px;font-weight:800;line-height:1.6;margin:0 0 8px}` +
  `${s} .c-text{font-size:14.5px;line-height:1.9;color:${INK_SUB}}` +
  `@media (max-width:560px){${s} .c-grid{grid-template-columns:minmax(0,1fr);gap:22px}}`

const column = (title: string, text: string): string =>
  `<div class="c-col"><h3 class="c-head">${title}</h3><p class="c-text">${text}</p></div>`

export const TEXT_TWO_COLUMN_SAMPLE: NewSample = {
  id: 'text-two-column',
  category: '文章・区切り',
  name: '2段組の文章',
  summary: '2つの話を横に並べます。狭い画面では縦に積み替わります',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      '<div class="c-grid">' +
      column(
        'はじめての方へ',
        '最初に読んでいただきたいことをまとめています。使い方はひとつだけ覚えれば十分で、' +
          '順番どおりに進めれば10分ほどで終わります。',
      ) +
      column(
        '前に試したことがある方へ',
        '以前うまくいかなかった方は、続け方だけを見直してみてください。' +
          '道具をそろえ直す必要はありません。',
      ) +
      '</div>',
  }),
}
