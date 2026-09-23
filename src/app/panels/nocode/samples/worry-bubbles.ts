/**
 * 新しい見本「吹き出しで悩み3つ」（2026-09-23）。
 *
 * 実際にうかがった声のように、左右交互の吹き出しで悩みを3つ並べる区画。
 * しっぽは画像を使わずCSSの三角（border）で作る。最後に受けの一言を細い線の下に置く。
 */
import { INK_SUB, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-a0000008'
const ACCENT = '#1F7AE0'
const BUBBLE = '#F1F4F8'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .h-list{max-width:600px;margin:0 auto}` +
  `${s} .h-item{display:flex;margin:0 0 18px}` +
  `${s} .h-item--r{justify-content:flex-end}` +
  `${s} .h-body{max-width:84%}` +
  `${s} .h-item--l .h-body{margin-left:12px}` +
  `${s} .h-item--r .h-body{margin-right:12px;text-align:right}` +
  `${s} .h-bubble{position:relative;padding:14px 18px;background:${BUBBLE};border-radius:14px;` +
  `font-size:15px;font-weight:700;line-height:1.8;text-align:left}` +
  `${s} .h-bubble::after{content:"";position:absolute;top:18px;border-style:solid;border-color:transparent}` +
  `${s} .h-item--l .h-bubble::after{left:-10px;border-width:8px 10px 8px 0;border-right-color:${BUBBLE}}` +
  `${s} .h-item--r .h-bubble::after{right:-10px;border-width:8px 0 8px 10px;border-left-color:${BUBBLE}}` +
  `${s} .h-who{display:block;margin-top:6px;font-size:12px;line-height:1.7;color:${INK_SUB}}` +
  `${s} .h-close{max-width:600px;margin:24px auto 0;padding-top:18px;border-top:1px solid ${LINE_LIGHT};` +
  `font-size:15px;line-height:1.9;text-align:center;color:${INK_SUB}}` +
  `${s} .h-close b{color:${ACCENT};font-weight:800;font-variant-numeric:tabular-nums}` +
  `@media (max-width:480px){${s} .h-body{max-width:90%}${s} .h-bubble{font-size:14px;padding:13px 15px}}`

const bubble = (side: 'l' | 'r', text: string, who: string): string =>
  `<li class="h-item h-item--${side}"><div class="h-body"><p class="h-bubble">${text}</p>` +
  `<span class="h-who">${who}</span></div></li>`

export const WORRY_BUBBLES_SAMPLE: NewSample = {
  id: 'worry-bubbles',
  category: '悩み・共感',
  name: '吹き出しで悩み3つ',
  summary: '左右交互の吹き出しで、よくうかがう悩みを3つ並べます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('こんな声を、よくうかがいます', '当てはまるものがありましたら、このまま読み進めてください。') +
      '<ul class="h-list">' +
      bubble('l', '月末になると、請求書づくりで22時まで残っています。', '経理ご担当・30代') +
      bubble('r', '取引先ごとに書式がちがうので、直すたびに数字を打ち間違えます。', '総務・ひとりでご担当') +
      bubble('l', '入金の確認が追いつかず、お客さまへのご連絡が翌月にずれてしまいます。', '代表・従業員12名の会社') +
      '</ul>' +
      '<p class="h-close">これまでに<b>1,200社</b>から、同じお悩みをうかがってきました。</p>',
  }),
}
