/**
 * 新しい見本「放っておくとどうなる」（2026-09-23）。
 *
 * いまのまま1年続けたときに積み上がるものを、3つの数字で見せる区画。
 * 囲みは作らず、細い線で区切った行に、大きな数字と短い説明を左右に並べる。
 * 数字の出どころ（計算の式・調べた時期）を必ず添えて、言いっぱなしにしない。
 */
import { INK, INK_SUB, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-a0000012'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .m-list{max-width:620px;margin:0 auto;border-top:1px solid ${LINE_LIGHT}}` +
  `${s} .m-row{display:flex;align-items:baseline;gap:20px;padding:18px 2px;` +
  `border-bottom:1px solid ${LINE_LIGHT}}` +
  `${s} .m-fig{flex:0 0 156px;display:flex;align-items:baseline;gap:3px;color:${ACCENT};` +
  `font-variant-numeric:tabular-nums}` +
  `${s} .m-pre{font-size:13px;font-weight:800}` +
  `${s} .m-num{font-size:38px;font-weight:800;line-height:1.1;letter-spacing:-.02em}` +
  `${s} .m-unit{font-size:16px;font-weight:800}` +
  `${s} .m-text{flex:1;min-width:0;font-size:14.5px;line-height:1.85;color:${INK_SUB}}` +
  `${s} .m-text b{color:${INK};font-weight:800}` +
  `${s} .m-close{max-width:620px;margin:22px auto 0;font-size:15.5px;font-weight:700;line-height:1.9;` +
  `text-align:center}` +
  `${s} .m-note{max-width:620px;margin:10px auto 0;font-size:12px;line-height:1.7;color:${INK_SUB};` +
  `text-align:center}` +
  `@media (max-width:480px){${s} .m-row{display:block;padding:15px 2px}` +
  `${s} .m-fig{margin:0 0 4px}${s} .m-num{font-size:32px}${s} .m-text{font-size:14px}}`

const cost = (num: string, unit: string, text: string): string =>
  `<div class="m-row"><p class="m-fig"><span class="m-pre">年間</span><span class="m-num">${num}</span>` +
  `<span class="m-unit">${unit}</span></p><p class="m-text">${text}</p></div>`

export const WORRY_COST_SAMPLE: NewSample = {
  id: 'worry-cost',
  category: '悩み・共感',
  name: '放っておくとどうなる（1年後）',
  summary: 'いまのまま1年続けたときに積み上がるものを、3つの数字で見せます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('このまま1年続けると、どうなるでしょうか', '月3時間の作業を、12か月ぶん数えてみました。') +
      '<div class="m-list">' +
      cost('36', '時間', '請求書づくりだけに使う時間です（月<b>3時間</b>×12か月）。') +
      cost('13', '万円', 'その時間を人件費に置きかえた金額です（時給3,600円で計算）。') +
      cost('6', '件', '金額や送り先の確認のために、やり直しが生じた件数の平均です。') +
      '</div>' +
      '<p class="m-close">どれも、月に30分の見直しで減らせる数字です。</p>' +
      '<p class="m-note">※2026年3月・当社調べ（従業員30名以下の102社にうかがいました）</p>',
  }),
}
