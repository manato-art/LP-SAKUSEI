/**
 * 新しい見本「帯のボタン（横長・濃い地）」（2026-09-23）。
 *
 * LPの途中に挟む、左右いっぱいの濃い帯。前後の白い区画と地の色が変わるので、
 * 読んでいる途中でも目に入る。背は低く保ち、文章の流れを止めない
 *（淡い地の「途中のひと押し」とは逆の見え方で、使い分けられるようにした）。
 */
import { ARROW_RIGHT_LABEL, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-e0000010'
const ACCENT = '#123A63'
const s = `.${UID}`

const CSS =
  // 帯そのものがWidget（左右の余白を取らず、画面の端まで色を敷く）
  `${s}{padding:0;background:${ACCENT};color:#FFFFFF}` +
  `${s} .y-inner{display:flex;align-items:center;gap:20px;max-width:760px;margin:0 auto;padding:18px 16px}` +
  `${s} .y-text{flex:1 1 auto;min-width:0}` +
  `${s} .y-head{font-size:17px;font-weight:800;line-height:1.55}` +
  `${s} .y-sub{margin-top:3px;font-size:12.5px;line-height:1.7;color:rgba(255,255,255,.8)}` +
  `${s} .y-btn{flex:0 0 auto;display:flex;align-items:center;justify-content:center;gap:8px;min-height:52px;` +
  `padding:14px 24px;border-radius:10px;background:#FFFFFF;color:${ACCENT};font-weight:800;font-size:16px;line-height:1.4;font-family:inherit;` +
  `text-decoration:none;box-shadow:0 4px 0 rgba(0,0,0,.3);` +
  `transition:transform .12s ease,box-shadow .12s ease;-webkit-tap-highlight-color:transparent}` +
  `${s} .y-btn:active{transform:translateY(3px);box-shadow:0 1px 0 rgba(0,0,0,.3)}` +
  `${s} .y-btn:focus-visible{outline:3px solid #FFFFFF;outline-offset:3px}` +
  `${s} .y-btn svg{flex:0 0 17px;width:17px;height:17px}` +
  `@media (max-width:600px){${s} .y-inner{flex-direction:column;align-items:stretch;gap:14px;` +
  `padding:20px 16px;text-align:center}${s} .y-head{font-size:16px}${s} .y-btn{width:100%}}` +
  `@media (prefers-reduced-motion:reduce){${s} .y-btn{transition:none}}`

export const CTA_BAR_LOOK_SAMPLE: NewSample = {
  id: 'cta-bar-look',
  category: '申し込み・CTA',
  name: '帯のボタン（横長・濃い地）',
  summary: '左右いっぱいの濃い帯に一言とボタン。途中に挟んでも流れを止めません',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      '<div class="y-inner"><div class="y-text">' +
      '<p class="y-head">3月31日まで、最初の30日間は0円です</p>' +
      '<p class="y-sub">入力は約1分。解約の費用はかかりません（※価格は税込み・2026年3月時点）。</p>' +
      '</div>' +
      `<a class="y-btn" href="ooooo"><span>申し込む</span>${ARROW_RIGHT_LABEL}</a></div>`,
  }),
}
