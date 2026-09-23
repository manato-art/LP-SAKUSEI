/**
 * 新しい見本「4ステップ（横並び）」（2026-09-23）。
 *
 * 申し込みから使い始めるまでを4段階で見せる区画。PCは横4列、狭い画面では縦1列に積む。
 * 矢印の画像は使わず、番号の丸と細い線だけでつなぐ（箱を4つ反復させない）。
 */
import { INK_SUB, LINE, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-c0000001'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .q-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px;max-width:760px;margin:0 auto}` +
  `${s} .q-item{position:relative;padding:46px 0 0}` +
  // 番号の丸から次の番号へ伸びる細い線（矢印の代わり）
  `${s} .q-item::before{content:"";position:absolute;left:42px;right:-20px;top:16px;height:2px;background:${LINE}}` +
  `${s} .q-item:last-child::before{display:none}` +
  `${s} .q-no{position:absolute;left:0;top:0;display:flex;width:34px;height:34px;align-items:center;` +
  `justify-content:center;border-radius:50%;background:${ACCENT};color:#FFFFFF;font-size:14.5px;font-weight:800;` +
  `line-height:1;font-variant-numeric:tabular-nums}` +
  `${s} .q-head{font-size:16.5px;font-weight:800;line-height:1.55;margin:0 0 6px}` +
  `${s} .q-text{font-size:14.5px;line-height:1.85;color:${INK_SUB}}` +
  `${s} .q-when{display:block;margin:8px 0 0;font-size:12px;font-weight:800;letter-spacing:.04em;color:${ACCENT}}` +
  // 狭い画面は縦1列。線は番号の下へ伸ばす
  `@media (max-width:560px){${s} .q-grid{grid-template-columns:minmax(0,1fr);gap:0;max-width:440px}` +
  `${s} .q-item{padding:0 0 22px 50px}${s} .q-item:last-child{padding-bottom:0}` +
  `${s} .q-item::before{left:16px;right:auto;top:40px;bottom:6px;width:2px;height:auto}` +
  `${s} .q-head{font-size:15.5px}}`

const step = (no: number, title: string, text: string, when: string): string =>
  `<div class="q-item"><p class="q-no">${no}</p><h3 class="q-head">${title}</h3>` +
  `<p class="q-text">${text}<span class="q-when">${when}</span></p></div>`

export const STEPS_FOUR_CARDS_SAMPLE: NewSample = {
  id: 'steps-four-cards',
  category: '説明・使い方',
  name: '4ステップ（横並び）',
  summary: '申し込みから使い始めるまでを4つに。PCは横4列、狭い画面では縦に並びます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('ご利用までの4ステップ', '申し込みから使い始めるまで、むずかしい準備はいりません。') +
      '<div class="q-grid">' +
      step(1, 'お申し込み', 'お名前とお届け先を入力します。入力する項目は5つだけです。', '約2分') +
      step(2, '確認のご連絡', 'ご登録のメールアドレスへ、内容の確認をお送りします。', '1営業日以内') +
      step(3, 'お届け', 'ご確認のあと発送します。お届け日時のご指定もできます。', '2〜4日') +
      step(4, '使いはじめる', '箱から出してすぐ始められます。使い方は冊子に載せています。', '届いた日') +
      '</div>',
  }),
}
