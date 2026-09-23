/**
 * 新しい見本「満足度の内訳（横棒グラフ）」（2026-09-23）。
 *
 * アンケートの内訳を、CSSだけの横棒4段で見せる区画（画像も外部のライブラリも使わない）。
 * 棒は同じ色の濃さ違いで、数値は必ず文字でも出すので、色が見えなくても読める。
 * 上に「とても満足＋まあ満足」の合計を1つだけ大きく置き、見せ場を1か所にまとめている。
 */
import { INK, INK_SUB, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-d0000007'
const ACCENT = '#2E6BE6'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .b-total{max-width:560px;margin:0 auto 24px;text-align:center;font-size:13.5px;line-height:1.8;color:${INK_SUB}}` +
  `${s} .b-total strong{display:block;font-size:34px;font-weight:800;line-height:1.2;color:${ACCENT};` +
  `font-variant-numeric:tabular-nums;letter-spacing:-.02em;margin-bottom:2px}` +
  `${s} .b-list{max-width:560px;margin:0 auto}` +
  `${s} .b-row+.b-row{margin-top:16px}` +
  `${s} .b-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin:0 0 7px}` +
  `${s} .b-label{font-size:14px;line-height:1.7;color:${INK}}` +
  `${s} .b-value{flex:none;font-size:16.5px;font-weight:800;line-height:1.5;color:${ACCENT};` +
  `font-variant-numeric:tabular-nums}` +
  `${s} .b-track{height:10px;background:${LINE_LIGHT}}` +
  `${s} .b-fill{display:block;height:100%;background:${ACCENT}}` +
  `${s} .b-fill--2{background:#6D97EE}` +
  `${s} .b-fill--3{background:#A9C1F5}` +
  `${s} .b-fill--4{background:#D5E0FA}` +
  `${s} .b-note{max-width:560px;margin:20px auto 0;font-size:12px;line-height:1.75;color:${INK_SUB}}` +
  `@media (max-width:480px){${s} .b-total strong{font-size:30px}${s} .b-label{font-size:13.5px}` +
  `${s} .b-value{font-size:15.5px}}`

const bar = (label: string, percent: number, tone: 1 | 2 | 3 | 4): string =>
  `<li class="b-row"><p class="b-head"><span class="b-label">${label}</span>` +
  `<span class="b-value">${percent}%</span></p>` +
  `<p class="b-track"><span class="b-fill b-fill--${tone}" style="width:${percent}%"></span></p></li>`

export const STATS_BAR_SAMPLE: NewSample = {
  id: 'stats-bar',
  category: '信頼・実績',
  name: '満足度の内訳（横棒グラフ）',
  summary: 'アンケートの内訳を横棒4段で。数値は文字でも出すので読み間違えません',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('ご利用中の方に、満足度をうかがいました') +
      '<p class="b-total"><strong>89%</strong>の方が「とても満足」「まあ満足」とお答えでした。</p>' +
      '<ul class="b-list">' +
      bar('とても満足', 62, 1) +
      bar('まあ満足', 27, 2) +
      bar('ふつう', 8, 3) +
      bar('あまり満足していない', 3, 4) +
      '</ul>' +
      '<p class="b-note">※2026年3月・ご利用中の1,043名への調査（自社調べ）。小数点以下は四捨五入しています。' +
      '※個人の感想です。</p>',
  }),
}
