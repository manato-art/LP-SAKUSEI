/**
 * 新しい見本「数字で見せる実績（3つ）」（2026-09-23・本人の依頼で0から作り直した3本目）。
 *
 * 満足度・導入数・評価のような「効く数字」を3つ並べる見せ場。
 * 同じ箱を3つ反復させない（ui-forge anti-ai-look）ため、箱も枠も使わず、数字の大きさと色だけで見せ、
 * 区切りは細い線1本にする。スマホでは縦積み＋区切り線。
 *
 * 数字・単位・言葉はそれぞれ別の文字なので、入力欄で1つずつ直せる。
 */
import { INK, INK_SUB, LINE_LIGHT, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-stat0001'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  `${s} .s-title{font-size:20px;font-weight:800;line-height:1.5;text-align:center;margin:0 0 4px}` +
  `${s} .s-lead{font-size:14px;line-height:1.8;color:${INK_SUB};text-align:center;margin:0 0 26px}` +
  `${s} .s-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}` +
  `${s} .s-item{min-width:0;padding:4px 6px;text-align:center}` +
  `${s} .s-num{display:flex;align-items:baseline;justify-content:center;gap:2px;` +
  `font-size:40px;font-weight:800;line-height:1.15;color:${ACCENT};font-variant-numeric:tabular-nums;` +
  `letter-spacing:-.02em;margin:0 0 6px}` +
  `${s} .s-unit{font-size:18px;font-weight:800;letter-spacing:normal}` +
  `${s} .s-label{font-size:13px;line-height:1.7;color:${INK_SUB}}` +
  `${s} .s-note{margin:22px 0 0;font-size:12px;line-height:1.7;color:${INK_SUB};text-align:center}` +
  // 狭い画面では縦積み。数字と言葉を左右に並べ、間は細い線1本で区切る
  `@media (max-width:480px){` +
  `${s} .s-grid{grid-template-columns:minmax(0,1fr);gap:0;border-top:1px solid ${LINE_LIGHT}}` +
  `${s} .s-item{display:flex;align-items:center;justify-content:space-between;gap:14px;text-align:left;` +
  `padding:14px 2px;border-bottom:1px solid ${LINE_LIGHT}}` +
  `${s} .s-num{margin:0;font-size:32px}` +
  `${s} .s-label{flex:1;min-width:0;color:${INK}}}`

const item = (value: string, unit: string, label: string): string =>
  `<div class="s-item"><p class="s-num">${value}<span class="s-unit">${unit}</span></p>` +
  `<p class="s-label">${label}</p></div>`

export const STATS_NUMBERS_SAMPLE: NewSample = {
  id: 'stats-numbers',
  category: '信頼・実績',
  name: '数字で見せる実績（3つ）',
  summary: '満足度・導入数・評価などを3つ並べます。箱で囲まず、数字の大きさだけで見せます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      '<h2 class="s-title">数字で見る、選ばれている理由</h2>' +
      '<p class="s-lead">はじめての方にも、続けている方にも選ばれています。</p>' +
      '<div class="s-grid">' +
      item('98', '%', 'また使いたいと答えた方') +
      item('1,200', '社', 'ご利用いただいている会社') +
      item('4.8', '点', '利用者の平均評価（5点満点）') +
      '</div>' +
      '<p class="s-note">※2026年3月時点・自社調べ（回答数1,043件）</p>',
  }),
}
