/**
 * 新しい見本「1日の使い方（時刻つき）」（2026-09-23）。
 *
 * 朝・昼・夜の3場面で、生活のどこに入れるかを見せる区画。時刻を左、内容を右に置き、
 * 縦の細い線と小さな丸だけでつなぐ（同じ箱を3つ並べない）。
 */
import { INK_SUB, LINE, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-c0000002'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .d-list{max-width:560px;margin:0 auto}` +
  `${s} .d-row{display:grid;grid-template-columns:66px minmax(0,1fr);gap:16px}` +
  `${s} .d-time{padding-top:2px;text-align:right;font-size:14.5px;font-weight:800;line-height:1.6;` +
  `color:${ACCENT};font-variant-numeric:tabular-nums}` +
  `${s} .d-when{display:block;margin-top:2px;font-size:11.5px;font-weight:700;letter-spacing:.06em;color:${INK_SUB}}` +
  // 時刻と内容のあいだの細い線と、行の先頭の小さな丸
  `${s} .d-body{position:relative;padding:0 0 26px 20px;border-left:1px solid ${LINE}}` +
  `${s} .d-row:last-child .d-body{padding-bottom:0}` +
  `${s} .d-body::before{content:"";position:absolute;left:-5px;top:8px;width:9px;height:9px;` +
  `border-radius:50%;background:${ACCENT}}` +
  `${s} .d-head{font-size:16.5px;font-weight:800;line-height:1.55;margin:0 0 6px}` +
  `${s} .d-text{font-size:14.5px;line-height:1.9;color:${INK_SUB}}` +
  `@media (max-width:480px){${s} .d-row{grid-template-columns:52px minmax(0,1fr);gap:12px}` +
  `${s} .d-time{font-size:13.5px}${s} .d-body{padding-left:16px}${s} .d-head{font-size:15.5px}}`

const row = (time: string, when: string, title: string, text: string): string =>
  `<div class="d-row"><p class="d-time">${time}<span class="d-when">${when}</span></p>` +
  `<div class="d-body"><h3 class="d-head">${title}</h3><p class="d-text">${text}</p></div></div>`

export const HOWTO_TIMELINE_SAMPLE: NewSample = {
  id: 'howto-timeline',
  category: '説明・使い方',
  name: '1日の使い方（時刻つき）',
  summary: '朝・昼・夜の3場面で、生活のどこに入れるかを時刻つきで見せます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('1日の使い方', '決まった時間はありません。いつもの習慣にくっつけると続けやすくなります。') +
      '<div class="d-list">' +
      row('7:30', '朝', '顔を洗ったあとに', '洗面台に置いておき、タオルで水気をふいたあと30秒だけ使います。出かける支度のあいだに終わります。') +
      row('12:30', '昼', '昼休みの終わりに', '外出先では持ち歩き用の小さいほうを使います。デスクに戻る前の30秒で十分です。') +
      row('22:00', '夜', '歯をみがいたあとに', '寝る前のいちばん忘れにくい時間です。疲れている日は飛ばして、翌朝から戻してかまいません。') +
      '</div>',
  }),
}
