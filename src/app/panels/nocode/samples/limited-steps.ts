/**
 * 新しい見本「締切までの流れ」（2026-09-23）。
 *
 * 締切があるときに「あと何をすれば間に合うのか」を3段で見せる区画。
 * PCは横に3つ並べ、点と細い線でつなぐ。狭い画面では縦線にして上から下へ読ませる。
 * 「ご利用の流れ（3ステップ）」より背を低くして、締切の一言を最後に置く。
 */
import { INK, INK_SUB, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-f0000009'
const ACCENT = '#C2462C'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .q-flow{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));max-width:620px;margin:0 auto}` +
  `${s} .q-step{position:relative;min-width:0;padding:30px 10px 0;text-align:center}` +
  // 点と点をつなぐ横線（最初と最後は半分だけ）
  `${s} .q-step::before{content:"";position:absolute;left:0;right:0;top:9px;height:2px;background:${LINE_LIGHT}}` +
  `${s} .q-step:first-child::before{left:50%}` +
  `${s} .q-step:last-child::before{right:50%}` +
  `${s} .q-dot{position:absolute;left:50%;top:1px;width:18px;height:18px;margin-left:-9px;` +
  `border-radius:50%;background:${ACCENT};box-shadow:0 0 0 5px #FFFFFF}` +
  `${s} .q-t{font-size:16px;font-weight:800;line-height:1.6;margin:0 0 4px;color:${INK}}` +
  `${s} .q-d{font-size:13.5px;line-height:1.85;color:${INK_SUB}}` +
  `${s} .q-close{max-width:620px;margin:26px auto 0;padding-top:16px;` +
  `border-top:1px solid ${LINE_LIGHT};font-size:13.5px;line-height:1.9;color:${INK_SUB};text-align:center}` +
  `${s} .q-close b{color:${ACCENT};font-weight:800;font-variant-numeric:tabular-nums}` +
  // 狭い画面: 縦線にして左に点を置く
  `@media (max-width:560px){${s} .q-flow{grid-template-columns:minmax(0,1fr)}` +
  `${s} .q-step{padding:0 0 22px 34px;text-align:left}` +
  `${s} .q-step:last-child{padding-bottom:0}` +
  `${s} .q-step::before{left:8px;right:auto;top:22px;bottom:0;width:2px;height:auto}` +
  `${s} .q-step:first-child::before{left:8px}` +
  `${s} .q-step:last-child::before{display:none}` +
  `${s} .q-dot{left:0;top:4px;margin-left:0;box-shadow:none}` +
  `${s} .q-t{font-size:15.5px}${s} .q-d{font-size:13px}}`

const step = (title: string, text: string): string =>
  `<div class="q-step"><span class="q-dot"></span>` +
  `<p class="q-t">${title}</p><p class="q-d">${text}</p></div>`

export const LIMITED_STEPS_SAMPLE: NewSample = {
  id: 'limited-steps',
  category: '限定・急ぎ',
  name: '締切までの流れ',
  summary: '申し込みから開始までを3段で。締切までにやることが分かります',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('締切までの流れ', '締切までにしていただくことは、3つだけです。') +
      '<div class="q-flow">' +
      step('お申し込み', 'フォームに入力して送信します。入力は3分ほどで終わります。') +
      step('確認メール', '5分以内に受付番号をお送りします。届かないときはご連絡ください。') +
      step('ご利用開始', '翌営業日から使いはじめられます。開始日のご指定もできます。') +
      '</div>' +
      '<p class="q-close">お申し込みの受付は<b>2026年3月31日（火）23:59</b>までです。' +
      '期限を過ぎた場合は、次回のご案内をお待ちください。</p>',
  }),
}
