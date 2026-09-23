/**
 * 新しい見本「導入前と導入後（文章）」（2026-09-23）。
 *
 * 左に「これまで」、右に「これから」を文章で置き、間に固定SVGの矢印を1つだけ入れる。
 * 差は箱の数ではなく、右だけ淡い地にして見せる（面の淡色ひとつ・本人の決まり）。
 * 狭い画面では縦に積み、矢印を下向きに回す。
 */
import { ARROW_RIGHT_LABEL, INK, INK_SUB, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-b0000004'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .ba-grid{display:grid;grid-template-columns:minmax(0,1fr) 52px minmax(0,1fr);align-items:center;` +
  `max-width:700px;margin:0 auto}` +
  `${s} .ba-col{min-width:0;padding:22px 20px}` +
  `${s} .ba-col--after{background:#F2F7FD;border-radius:14px}` +
  `${s} .ba-label{font-size:12.5px;font-weight:800;line-height:1.6;letter-spacing:.12em;` +
  `color:${INK_SUB};margin:0 0 10px}` +
  `${s} .ba-label--after{color:${ACCENT}}` +
  `${s} .ba-text{font-size:14.5px;line-height:1.9;color:${INK_SUB}}` +
  `${s} .ba-text--after{color:${INK};font-weight:700}` +
  `${s} .ba-arrow{display:flex;align-items:center;justify-content:center}` +
  `${s} .ba-arrow svg{width:26px;height:26px;color:${ACCENT}}` +
  `${s} .ba-note{max-width:700px;margin:18px auto 0;font-size:12px;line-height:1.7;color:${INK_SUB};text-align:center}` +
  `@media (max-width:560px){${s} .ba-grid{grid-template-columns:minmax(0,1fr)}` +
  `${s} .ba-col{padding:18px 16px}${s} .ba-arrow{padding:12px 0}` +
  `${s} .ba-arrow svg{transform:rotate(90deg)}}`

export const FEATURE_BEFORE_AFTER_SAMPLE: NewSample = {
  id: 'feature-before-after',
  category: '特徴・価値',
  name: '導入前と導入後（文章）',
  summary: '左に「これまで」、右に「これから」。矢印ひとつで変わり方を見せます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('導入の前と、後で', '同じ仕事でも、手順が変わると時間の使い方が変わります。') +
      '<div class="ba-grid">' +
      '<div class="ba-col"><p class="ba-label">これまで</p>' +
      '<p class="ba-text">毎月の集計に2日かかっていました。担当の方の手が空くまで待つことも多く、' +
      '月初はほかの仕事が止まりがちでした。数え直しのたびに、数字が合わなくなることもありました。</p></div>' +
      `<p class="ba-arrow">${ARROW_RIGHT_LABEL}</p>` +
      '<div class="ba-col ba-col--after"><p class="ba-label ba-label--after">これから</p>' +
      '<p class="ba-text ba-text--after">集計はその日のうちに終わり、確認にかかるのは15分ほどです。' +
      '空いた時間は、次の打ち手を考えることに使えます。</p></div>' +
      '</div>' +
      '<p class="ba-note">※導入いただいた会社での一例です。かかる時間は環境によって変わります。</p>',
  }),
}
