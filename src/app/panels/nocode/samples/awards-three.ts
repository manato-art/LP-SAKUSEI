/**
 * 新しい見本「受賞歴（3件）」（2026-09-23）。
 *
 * リボンやメダルの絵は使わず、年・賞の名前・一言だけの文字で見せる区画。
 * 年を左にそろえて大きめにし、区切りは細い線1本。箱は使わない。
 */
import { INK, INK_SUB, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-d0000005'
const ACCENT = '#8A6A2F'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .w-list{max-width:620px;margin:0 auto;border-top:1px solid ${LINE_LIGHT}}` +
  `${s} .w-item{display:grid;grid-template-columns:5.5em minmax(0,1fr);gap:4px 18px;` +
  `align-items:baseline;padding:18px 2px;border-bottom:1px solid ${LINE_LIGHT}}` +
  `${s} .w-year{font-size:17px;font-weight:800;line-height:1.6;color:${ACCENT};` +
  `font-variant-numeric:tabular-nums;letter-spacing:.01em}` +
  `${s} .w-name{font-size:16.5px;font-weight:800;line-height:1.6;color:${INK}}` +
  `${s} .w-text{margin-top:5px;font-size:13.5px;line-height:1.85;color:${INK_SUB}}` +
  `${s} .w-note{max-width:620px;margin:16px auto 0;font-size:12px;line-height:1.7;color:${INK_SUB}}` +
  `@media (max-width:480px){${s} .w-item{grid-template-columns:minmax(0,1fr);gap:2px;padding:16px 2px}` +
  `${s} .w-year{font-size:13.5px}${s} .w-name{font-size:15.5px}}`

const award = (year: string, name: string, text: string): string =>
  `<li class="w-item"><span class="w-year">${year}</span>` +
  `<div class="w-body"><h3 class="w-name">${name}</h3><p class="w-text">${text}</p></div></li>`

export const AWARDS_THREE_SAMPLE: NewSample = {
  id: 'awards-three',
  category: '信頼・実績',
  name: '受賞歴（3件）',
  summary: '年・賞の名前・一言だけを文字で見せます。リボンの絵は使いません',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('これまでにいただいた評価') +
      '<ul class="w-list">' +
      award(
        '2025年',
        'サンプル・サービス大賞 優秀賞',
        '使いやすさの項目で、審査員10名のうち9名から支持をいただきました。',
      ) +
      award(
        '2024年',
        'サンプル地域産業賞 奨励賞',
        '従業員10名以下の事業者に向けた取り組みとして、応募182件の中から選ばれました。',
      ) +
      award(
        '2023年',
        'サンプル・デザイン選定 入選',
        '画面の分かりやすさと、文字の読みやすさについて評価をいただきました。',
      ) +
      '</ul>' +
      '<p class="w-note">※いずれも選考時点の評価です。内容の優劣を保証するものではありません。</p>',
  }),
}
