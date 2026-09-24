/**
 * 新しい見本「残りわずかの知らせ」（2026-09-23）。
 *
 * 残りの数を大きく置き、その横に「なぜ締め切るのか」を静かに添える区画。
 * 煽らない言い方にする（「急がないと損」ではなく「定員になり次第、受付を終了します」）。
 * 残数はスクリプトで動かさない。手で書き換える前提なので、いつ時点の数かを必ず添える。
 */
import { INK, INK_SUB, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-f0000007'
const ACCENT = '#C2462C'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .n-row{display:flex;align-items:center;gap:28px;max-width:620px;margin:0 auto;` +
  `padding:0 0 20px;border-bottom:1px solid ${LINE_LIGHT}}` +
  `${s} .n-count{flex:0 0 auto;text-align:center}` +
  `${s} .n-label{font-size:12.5px;font-weight:800;letter-spacing:.06em;line-height:1.6;color:${INK_SUB}}` +
  `${s} .n-num{display:flex;align-items:baseline;justify-content:center;gap:3px;margin:2px 0 0;` +
  `font-size:54px;font-weight:800;line-height:1.05;color:${ACCENT};` +
  `font-variant-numeric:tabular-nums;letter-spacing:-.02em}` +
  `${s} .n-unit{font-size:20px;font-weight:800;letter-spacing:normal}` +
  `${s} .n-body{flex:1;min-width:0}` +
  `${s} .n-head{font-size:17px;font-weight:800;line-height:1.6;margin:0 0 6px;color:${INK}}` +
  `${s} .n-text{font-size:14px;line-height:1.9;color:${INK_SUB}}` +
  `${s} .n-foot{max-width:620px;margin:20px auto 0;text-align:center}` +
  `${s} .n-btn{display:inline-flex;align-items:center;justify-content:center;min-height:54px;` +
  `padding:14px 34px;border-radius:10px;background:${ACCENT};color:#FFFFFF;font-weight:800;font-size:16px;line-height:1.4;font-family:inherit;` +
  `text-decoration:none;transition:opacity .14s ease}` +
  `${s} .n-btn:hover{opacity:.88}` +
  `${s} .n-btn:focus-visible{outline:3px solid ${ACCENT};outline-offset:4px}` +
  `${s} .n-note{margin:12px 0 0;font-size:12px;line-height:1.8;color:${INK_SUB}}` +
  `@media (max-width:560px){${s} .n-row{flex-direction:column;gap:14px;text-align:center}` +
  `${s} .n-num{font-size:46px}${s} .n-head{font-size:16px}${s} .n-text{font-size:13.5px}` +
  `${s} .n-btn{display:flex;width:100%;padding:14px 18px}}` +
  `@media (prefers-reduced-motion:reduce){${s} .n-btn{transition:none}}`

export const LIMITED_STOCK_SAMPLE: NewSample = {
  id: 'limited-stock',
  category: '限定・急ぎ',
  name: '残りわずかの知らせ',
  summary: '残りの数を大きく見せます。煽らずに、締め切る理由を添えます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('4月開始分の残りについて') +
      '<div class="n-row">' +
      '<div class="n-count"><p class="n-label">残りのお席</p>' +
      '<p class="n-num">12<span class="n-unit">名</span></p></div>' +
      '<div class="n-body"><p class="n-head">定員に近づいています</p>' +
      '<p class="n-text">4月にお使いいただける分は30名までとさせていただいています。' +
      'ご案内の質を保つため、定員になり次第、期間の途中でも受付を終了します。</p></div>' +
      '</div>' +
      '<div class="n-foot">' +
      '<a class="n-btn" href="ooooo">空き状況を確認する</a>' +
      '<p class="n-note">※2026年3月10日15時時点の残数です。お申し込みの状況により変わります。</p>' +
      '</div>',
  }),
}
