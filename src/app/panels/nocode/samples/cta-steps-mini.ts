/**
 * 新しい見本「申し込みは3ステップ＋ボタン」（2026-09-23）。
 *
 * ボタンのすぐ上に置く、短い流れ。番号の丸を横に3つ並べ、あいだを細い線でつなぐ。
 * 縦に長い「ご利用の流れ」とは別物で、押す直前に「これだけで終わる」と見せるためのもの。
 * 狭い画面でも横並びのまま（言葉を短くして、375pxで溢れないようにした）。
 */
import { ARROW_RIGHT_LABEL, INK, INK_SUB, LINE, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-e0000013'
const ACCENT = '#1F7AE0'
const ACCENT_EDGE = '#14549B'
const s = `.${UID}`

const CSS =
  `${s} .j-lead{max-width:560px;margin:0 auto 18px;font-size:16px;font-weight:800;line-height:1.6;` +
  `color:${INK};text-align:center}` +
  `${s} .j-row{display:flex;align-items:flex-start;max-width:560px;margin:0 auto}` +
  `${s} .j-step{flex:1 1 0;min-width:0;text-align:center}` +
  `${s} .j-no{display:flex;width:34px;height:34px;margin:0 auto 7px;align-items:center;justify-content:center;` +
  `border-radius:50%;background:${ACCENT};color:#FFFFFF;font-size:15px;font-weight:800;line-height:1;` +
  `font-variant-numeric:tabular-nums}` +
  `${s} .j-name{font-size:13.5px;font-weight:800;line-height:1.55;color:${INK}}` +
  `${s} .j-when{margin-top:2px;font-size:11.5px;line-height:1.6;color:${INK_SUB}}` +
  // 丸と丸をつなぐ線（丸の中心の高さに合わせる）
  `${s} .j-line{flex:0 0 18px;height:2px;margin-top:16px;background:${LINE}}` +
  `${s} .j-btn{display:flex;width:100%;max-width:520px;margin:22px auto 0;align-items:center;` +
  `justify-content:center;gap:10px;min-height:64px;padding:17px 22px;border-radius:12px;background:${ACCENT};` +
  `color:#FFFFFF;font-weight:800;font-size:18px;line-height:1.4;font-family:inherit;text-decoration:none;text-shadow:0 1px 2px rgba(0,0,0,.2);` +
  `box-shadow:0 5px 0 ${ACCENT_EDGE},0 12px 20px rgba(0,0,0,.12);` +
  `transition:transform .14s ease,box-shadow .14s ease;-webkit-tap-highlight-color:transparent}` +
  `${s} .j-btn:active{transform:translateY(4px);box-shadow:0 1px 0 ${ACCENT_EDGE},0 5px 10px rgba(0,0,0,.1)}` +
  `${s} .j-btn:focus-visible{outline:3px solid ${ACCENT_EDGE};outline-offset:4px}` +
  `${s} .j-btn svg{flex:0 0 19px;width:19px;height:19px}` +
  `${s} .j-note{max-width:520px;margin:10px auto 0;font-size:12px;line-height:1.8;color:${INK_SUB};` +
  `text-align:center}` +
  `@media (max-width:480px){${s} .j-lead{font-size:15px}${s} .j-no{width:30px;height:30px;font-size:14px}` +
  `${s} .j-line{flex:0 0 10px;margin-top:14px}${s} .j-name{font-size:12.5px}${s} .j-when{font-size:11px}` +
  `${s} .j-btn{font-size:16.5px;min-height:60px}}` +
  `@media (prefers-reduced-motion:reduce){${s} .j-btn{transition:none}}`

const step = (no: number, name: string, when: string): string =>
  `<div class="j-step"><p class="j-no">${no}</p><p class="j-name">${name}</p><p class="j-when">${when}</p></div>`

export const CTA_STEPS_MINI_SAMPLE: NewSample = {
  id: 'cta-steps-mini',
  category: '申し込み・CTA',
  name: '申し込みは3ステップ（ボタンつき）',
  summary: '番号の丸を横に3つ並べ、その下にボタン。押す直前の背中を押します',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      '<p class="j-lead">お申し込みは、3つのステップで終わります</p>' +
      '<div class="j-row">' +
      step(1, 'フォームに入力', '約1分') +
      '<div class="j-line"></div>' +
      step(2, '内容のご確認', '当日中にご連絡') +
      '<div class="j-line"></div>' +
      step(3, 'お申し込み完了', 'その日から使えます') +
      '</div>' +
      `<a class="j-btn" href="ooooo"><span>フォームへ進む</span>${ARROW_RIGHT_LABEL}</a>` +
      '<p class="j-note">※ご入力いただいた内容は、ご連絡のためだけに使います。※2026年3月時点の対応です。</p>',
  }),
}
