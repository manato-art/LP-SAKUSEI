/**
 * 新しい見本「棒グラフで見せる（3本）」（2026-09-23）。
 *
 * アンケートの割合を横棒3本で見せる区画。画像もスクリプトも使わず、CSSの幅だけで描く。
 * 棒は読み上げに乗らないので、同じ数字を必ず文字でも出す。色は1色と、その淡色（棒の地）まで。
 */
import { INK, INK_SUB, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-b0000006'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .bc-list{max-width:620px;margin:0 auto;border-top:1px solid ${LINE_LIGHT}}` +
  `${s} .bc-row{padding:16px 0;border-bottom:1px solid ${LINE_LIGHT}}` +
  `${s} .bc-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin:0 0 10px}` +
  `${s} .bc-label{min-width:0;font-size:14.5px;font-weight:700;line-height:1.6;color:${INK}}` +
  `${s} .bc-value{flex:0 0 auto;font-size:22px;font-weight:800;line-height:1.2;color:${ACCENT};` +
  `font-variant-numeric:tabular-nums;letter-spacing:-.02em}` +
  `${s} .bc-unit{font-size:13px;font-weight:800;letter-spacing:normal}` +
  `${s} .bc-bar{height:10px;border-radius:999px;background:#EAF1FB;overflow:hidden}` +
  `${s} .bc-fill{display:block;height:100%;border-radius:999px;background:${ACCENT}}` +
  `${s} .bc-note{max-width:620px;margin:18px auto 0;font-size:12px;line-height:1.7;color:${INK_SUB};text-align:center}` +
  `@media (max-width:480px){${s} .bc-label{font-size:14px}${s} .bc-value{font-size:19px}` +
  `${s} .bc-bar{height:9px}}`

const bar = (label: string, value: string): string =>
  `<div class="bc-row"><p class="bc-head"><span class="bc-label">${label}</span>` +
  `<span class="bc-value">${value}<span class="bc-unit">%</span></span></p>` +
  `<p class="bc-bar"><span class="bc-fill" style="width:${value}%"></span></p></div>`

export const FEATURE_BAR_CHART_SAMPLE: NewSample = {
  id: 'feature-bar-chart',
  category: '特徴・価値',
  name: '棒グラフで見せる（3本）',
  summary: '横棒3本で割合を見せます。数字は文字でも出すので読み上げにも残ります',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('使っている方に聞きました', 'ご利用中の1,043人にお答えいただいた結果です。') +
      '<div class="bc-list">' +
      bar('操作が分かりやすい', '92') +
      bar('相談への返事が早い', '87') +
      bar('価格に納得している', '78') +
      '</div>' +
      '<p class="bc-note">※2026年3月・当社調べ（回答1,043件）。' +
      '「そう思う」「ややそう思う」と答えた方の合計です。</p>',
  }),
}
