/**
 * 新しい見本「よくある失敗3つ」（2026-09-23）。
 *
 * 「やりがちなこと」と「そのままにすると起きること」を左右に並べ、細い線で区切る区画。
 * 箱を3つ反復させず、行だけで見せる。印は画像を使わず記号の「×」1文字。
 * 狭い画面では2列をやめて縦積みにし、結果の行を少し下げて続きだと分かるようにする。
 */
import { INK_SUB, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-a0000009'
const ACCENT = '#1F2A37'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .i-list{max-width:640px;margin:0 auto;border-top:1px solid ${LINE_LIGHT}}` +
  `${s} .i-head{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0 24px;` +
  `padding:10px 2px;border-bottom:1px solid ${LINE_LIGHT};font-size:12px;font-weight:800;` +
  `letter-spacing:.04em;color:${INK_SUB}}` +
  `${s} .i-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px 24px;` +
  `padding:16px 2px;border-bottom:1px solid ${LINE_LIGHT}}` +
  `${s} .i-bad{display:flex;gap:9px;min-width:0;font-size:15.5px;font-weight:800;line-height:1.7}` +
  `${s} .i-x{flex:0 0 auto;color:${ACCENT};font-size:17px;line-height:1.6}` +
  `${s} .i-res{min-width:0;font-size:14px;line-height:1.85;color:${INK_SUB}}` +
  `${s} .i-res b{color:${ACCENT};font-weight:800;font-variant-numeric:tabular-nums}` +
  `${s} .i-close{max-width:640px;margin:22px auto 0;font-size:15px;line-height:1.9;text-align:center}` +
  `@media (max-width:560px){${s} .i-head{display:none}` +
  `${s} .i-row{grid-template-columns:minmax(0,1fr);gap:5px;padding:15px 2px}` +
  `${s} .i-bad{font-size:15px}${s} .i-res{padding-left:26px;font-size:13.5px}}`

const fail = (bad: string, result: string): string =>
  `<div class="i-row"><p class="i-bad"><span class="i-x" aria-hidden="true">×</span><span>${bad}</span></p>` +
  `<p class="i-res">${result}</p></div>`

export const WORRY_FAIL_SAMPLE: NewSample = {
  id: 'worry-fail',
  category: '悩み・共感',
  name: 'よくある失敗3つ',
  summary: 'やりがちなことと、そのままにすると起きることを左右に並べます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('やりがちなこと、ありませんか', '3つとも、やり方を少し変えるだけで減らせます。') +
      '<div class="i-list">' +
      '<div class="i-head"><span>やりがちなこと</span><span>そのままにすると</span></div>' +
      fail(
        '毎月ゼロから作り直している',
        '前の月と同じ内容を打ち直すだけで、1件あたり5分、30件で<b>2時間30分</b>かかります。',
      ) +
      fail(
        '担当者ごとに書式がちがう',
        '引き継ぎのたびに確認が必要になり、社内の問い合わせが月に<b>10件</b>ほど増えます。',
      ) +
      fail(
        '入金の確認を月末にまとめている',
        '未入金に気づくのが遅れ、お客さまへのご連絡が翌月にずれ込みます。',
      ) +
      '</div>' +
      '<p class="i-close">どれも、月に30分の見直しで減らせます。まずは1つめからご覧ください。</p>',
  }),
}
