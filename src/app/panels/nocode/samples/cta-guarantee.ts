/**
 * 新しい見本「返金保証つきボタン」（2026-09-23）。
 *
 * 押す前の「もし合わなかったら」を先に消す区画。保証の印は画像を使わず、
 * 二重の丸に文字を入れて作る。条件を3つとも書き、いつまでに何をすれば良いのかまで示す。
 */
import { CHECK, INK, INK_SUB, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-e0000012'
const ACCENT = '#2E7D5B'
const ACCENT_EDGE = '#1E5940'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .x-row{display:flex;align-items:center;gap:22px;max-width:560px;margin:0 auto}` +
  // 保証の印（二重の丸＋文字。画像も絵文字も使わない）
  `${s} .x-seal{position:relative;flex:0 0 116px;width:116px;height:116px;display:flex;flex-direction:column;` +
  `align-items:center;justify-content:center;border-radius:50%;border:2.5px solid ${ACCENT};color:${ACCENT};` +
  `text-align:center;line-height:1.25}` +
  `${s} .x-seal::after{content:"";position:absolute;left:5px;right:5px;top:5px;bottom:5px;border-radius:50%;` +
  `border:1px solid ${ACCENT};opacity:.55}` +
  `${s} .x-seal__top{font-size:13px;font-weight:800;letter-spacing:.02em}` +
  `${s} .x-seal__main{font-size:21px;font-weight:800;letter-spacing:.02em;margin-top:1px}` +
  `${s} .x-points{flex:1 1 auto;min-width:0}` +
  `${s} .x-point{display:flex;align-items:flex-start;gap:9px;padding:8px 0;font-size:14.5px;line-height:1.75;` +
  `color:${INK}}` +
  `${s} .x-point+.x-point{border-top:1px solid ${LINE_LIGHT}}` +
  `${s} .x-point svg{flex:0 0 16px;width:16px;height:16px;margin-top:5px;color:${ACCENT}}` +
  `${s} .x-btn{display:flex;width:100%;max-width:560px;margin:24px auto 0;align-items:center;` +
  `justify-content:center;min-height:64px;padding:17px 22px;border-radius:12px;background:${ACCENT};` +
  `color:#FFFFFF;font:800 18px/1.4 inherit;text-decoration:none;text-shadow:0 1px 2px rgba(0,0,0,.2);` +
  `box-shadow:0 5px 0 ${ACCENT_EDGE},0 12px 20px rgba(0,0,0,.12);` +
  `transition:transform .14s ease,box-shadow .14s ease;-webkit-tap-highlight-color:transparent}` +
  `${s} .x-btn:active{transform:translateY(4px);box-shadow:0 1px 0 ${ACCENT_EDGE},0 5px 10px rgba(0,0,0,.1)}` +
  `${s} .x-btn:focus-visible{outline:3px solid ${ACCENT_EDGE};outline-offset:4px}` +
  `${s} .x-note{max-width:560px;margin:12px auto 0;font-size:12px;line-height:1.8;color:${INK_SUB}}` +
  `@media (max-width:520px){${s} .x-row{flex-direction:column;gap:16px}` +
  `${s} .x-seal{flex:0 0 104px;width:104px;height:104px}${s} .x-seal__main{font-size:19px}` +
  `${s} .x-points{width:100%}${s} .x-point{font-size:13.5px}${s} .x-btn{font-size:16.5px;min-height:60px}}` +
  `@media (prefers-reduced-motion:reduce){${s} .x-btn{transition:none}}`

const point = (text: string): string => `<li class="x-point">${CHECK}<span>${text}</span></li>`

export const CTA_GUARANTEE_SAMPLE: NewSample = {
  id: 'cta-guarantee',
  category: '申し込み・CTA',
  name: '返金保証つきのボタン',
  summary: '保証の条件を3つ書いてからボタンへ。保証の印は文字だけで作ります',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('合わなければ、お返しします', '30日間の返金保証をお付けしています。') +
      '<div class="x-row">' +
      '<div class="x-seal"><span class="x-seal__top">30日間</span>' +
      '<span class="x-seal__main">返金保証</span></div>' +
      '<ul class="x-points">' +
      point('お届けから30日以内に、メールかお電話でご連絡ください。') +
      point('開けてお使いになったあとでもお受けします。理由はうかがいません。') +
      point('返送の送料は当社が負担します。着払いでお送りください。') +
      '</ul></div>' +
      '<a class="x-btn" href="ooooo">返金保証つきで申し込む</a>' +
      '<p class="x-note">※返金は1世帯につき1回までです。※ご連絡から10営業日ほどで、ご指定の口座へお振り込みします。' +
      '※2026年3月時点の内容です。</p>',
  }),
}
