/**
 * 新しい見本「ご利用の流れ（3ステップ）」（2026-09-23）。
 *
 * 申し込みから使い始めるまで。番号の丸と、その下に伸びる縦線でつなぐ（矢印の画像は使わない）。
 */
import { INK_SUB, LINE, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-step0001'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .t-list{max-width:560px;margin:0 auto}` +
  `${s} .t-item{position:relative;padding:0 0 26px 54px}` +
  `${s} .t-item:last-child{padding-bottom:0}` +
  // 番号の丸と、次の番号へ伸びる線
  `${s} .t-item::before{content:"";position:absolute;left:17px;top:34px;bottom:4px;width:2px;background:${LINE}}` +
  `${s} .t-item:last-child::before{display:none}` +
  `${s} .t-no{position:absolute;left:0;top:0;display:flex;width:36px;height:36px;align-items:center;` +
  `justify-content:center;border-radius:50%;background:${ACCENT};color:#FFFFFF;font-size:15px;font-weight:800;` +
  `line-height:1;font-variant-numeric:tabular-nums}` +
  `${s} .t-head{font-size:16.5px;font-weight:800;line-height:1.55;margin:6px 0 6px}` +
  `${s} .t-text{font-size:14.5px;line-height:1.9;color:${INK_SUB}}` +
  `${s} .t-when{display:inline-block;margin:8px 0 0;padding:3px 9px;border-radius:999px;background:#EEF4FC;` +
  `color:${ACCENT};font-size:12px;font-weight:800}` +
  `@media (max-width:480px){${s} .t-item{padding-left:48px}${s} .t-head{font-size:15.5px}}`

const step = (no: number, title: string, text: string, when: string): string =>
  `<div class="t-item"><p class="t-no">${no}</p><h3 class="t-head">${title}</h3>` +
  `<p class="t-text">${text}</p><span class="t-when">${when}</span></div>`

export const STEPS_THREE_SAMPLE: NewSample = {
  id: 'steps-three',
  category: '説明・使い方',
  name: 'ご利用の流れ（3ステップ）',
  summary: '申し込みから使い始めるまでを3つに。番号の丸と縦線でつなぎます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('ご利用の流れ', '申し込みから使い始めるまで、3ステップで終わります。') +
      '<div class="t-list">' +
      step(1, 'フォームに入力する', 'お名前とお届け先だけ。クレジットカードは後からでも登録できます。', '約1分') +
      step(2, '届くのを待つ', 'ご注文の翌日から2〜4日でお届けします。お届け日の指定もできます。', '2〜4日') +
      step(3, '箱から出して使いはじめる', '準備はいりません。置いたその日から1日30秒で続けられます。', '当日') +
      '</div>',
  }),
}
