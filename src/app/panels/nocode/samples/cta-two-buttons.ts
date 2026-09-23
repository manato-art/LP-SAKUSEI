/**
 * 新しい見本「2つのボタン（資料請求／申し込み）」（2026-09-23）。
 *
 * まだ決めきれない方の逃げ道を作りつつ、押してほしい方を迷わせない。
 * 主役は濃い地で大きく、控えめな方は白地に細い枠で。PCは横、狭い画面では主役を上にして縦に積む。
 */
import { ARROW_RIGHT_LABEL, INK, INK_SUB, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-e0000009'
const ACCENT = '#E5573F'
const ACCENT_EDGE = '#B83A26'
const ACCENT_SOFT = '#F5CFC7'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .w-row{display:flex;align-items:stretch;gap:12px;max-width:620px;margin:0 auto}` +
  `${s} .w-btn{flex:1.3 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;` +
  `justify-content:center;gap:2px;min-height:70px;padding:14px 18px;border-radius:12px;background:${ACCENT};` +
  `color:#FFFFFF;text-decoration:none;text-shadow:0 1px 2px rgba(0,0,0,.2);` +
  `box-shadow:0 5px 0 ${ACCENT_EDGE},0 12px 20px rgba(0,0,0,.12);` +
  `transition:transform .14s ease,box-shadow .14s ease;-webkit-tap-highlight-color:transparent}` +
  `${s} .w-btn:active{transform:translateY(4px);box-shadow:0 1px 0 ${ACCENT_EDGE},0 5px 10px rgba(0,0,0,.1)}` +
  `${s} .w-btn:focus-visible{outline:3px solid ${ACCENT_EDGE};outline-offset:4px}` +
  `${s} .w-label{display:flex;align-items:center;gap:8px;font-size:18px;font-weight:800;line-height:1.35}` +
  `${s} .w-btn svg{flex:0 0 18px;width:18px;height:18px}` +
  `${s} .w-small{font-size:11.5px;line-height:1.6;opacity:.9}` +
  // 控えめな方（白地・細い枠。厚みは淡い色で出す）
  `${s} .w-btn--quiet{flex:1 1 0;background:#FFFFFF;color:${ACCENT};border:1.5px solid ${ACCENT};` +
  `text-shadow:none;box-shadow:0 4px 0 ${ACCENT_SOFT}}` +
  `${s} .w-btn--quiet:active{box-shadow:0 1px 0 ${ACCENT_SOFT}}` +
  `${s} .w-btn--quiet .w-label{font-size:16px}` +
  `${s} .w-btn--quiet .w-small{color:${INK_SUB};opacity:1}` +
  `${s} .w-note{max-width:620px;margin:14px auto 0;font-size:12.5px;line-height:1.8;color:${INK};text-align:center}` +
  `${s} .w-note span{color:${INK_SUB}}` +
  `@media (max-width:560px){${s} .w-row{flex-direction:column;max-width:420px;gap:10px}` +
  `${s} .w-btn{min-height:64px}${s} .w-label{font-size:17px}${s} .w-btn--quiet .w-label{font-size:15.5px}}` +
  `@media (prefers-reduced-motion:reduce){${s} .w-btn{transition:none}}`

export const CTA_TWO_BUTTONS_SAMPLE: NewSample = {
  id: 'cta-two-buttons',
  category: '申し込み・CTA',
  name: '2つのボタン（資料請求と申し込み）',
  summary: '主役のボタンを大きく、控えめな方を白地に。PCは横、スマホは縦に並びます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('まずは、どちらからでも', 'いますぐ決めなくても大丈夫です。資料だけのご請求でもかまいません。') +
      '<div class="w-row">' +
      '<a class="w-btn" href="ooooo">' +
      `<span class="w-label"><span>お申し込みへ進む</span>${ARROW_RIGHT_LABEL}</span>` +
      '<span class="w-small">入力は約1分・最初の30日間は0円</span></a>' +
      '<a class="w-btn w-btn--quiet" href="ooooo">' +
      '<span class="w-label">資料をもらう（無料）</span>' +
      '<span class="w-small">全12ページ・その場で届きます</span></a>' +
      '</div>' +
      '<p class="w-note">資料をご請求いただいた方に、お電話することはありません。' +
      '<span>※2026年3月時点の対応です。</span></p>',
  }),
}
