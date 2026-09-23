/**
 * 新しい見本「見出し＋実績バッジ3つ」（2026-09-23）。
 *
 * 見出しの下に、数字の実績を3つ横並びで置く冒頭。
 * 同じ箱を3つ反復させないため、囲みは作らず、上下の細い線1本ずつで1つの帯にまとめ、
 * 間は縦の細い線で区切る。狭い画面では縦積みにして、数字と言葉を左右に並べる。
 */
import { INK, INK_SUB, LINE_LIGHT, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-a0000003'
const ACCENT = '#E5573F'
const s = `.${UID}`

const CSS =
  `${s}{padding:38px 16px 32px;text-align:center}` +
  `${s} .c-title{font-size:28px;font-weight:800;line-height:1.42;letter-spacing:-.01em;margin:0 0 12px;` +
  `text-wrap:balance}` +
  `${s} .c-title em{font-style:normal;color:${ACCENT}}` +
  `${s} .c-lead{max-width:580px;margin:0 auto 26px;font-size:15px;line-height:1.9;color:${INK_SUB}}` +
  `${s} .c-strip{display:flex;max-width:620px;margin:0 auto;` +
  `border-top:1px solid ${LINE_LIGHT};border-bottom:1px solid ${LINE_LIGHT}}` +
  `${s} .c-cell{flex:1;min-width:0;padding:16px 10px}` +
  `${s} .c-cell + .c-cell{border-left:1px solid ${LINE_LIGHT}}` +
  `${s} .c-value{display:block;font-size:24px;font-weight:800;line-height:1.25;color:${ACCENT};` +
  `font-variant-numeric:tabular-nums;letter-spacing:-.02em}` +
  `${s} .c-label{display:block;margin-top:4px;font-size:13px;font-weight:700;line-height:1.6;color:${INK}}` +
  `${s} .c-said{display:block;margin-top:3px;font-size:11.5px;line-height:1.65;color:${INK_SUB}}` +
  `${s} .c-note{margin:14px 0 0;font-size:12px;line-height:1.75;color:${INK_SUB}}` +
  `@media (max-width:560px){${s} .c-strip{display:block}` +
  `${s} .c-cell{display:grid;grid-template-columns:auto minmax(0,1fr);column-gap:14px;` +
  `text-align:left;padding:13px 2px}` +
  `${s} .c-cell + .c-cell{border-left:0;border-top:1px solid ${LINE_LIGHT}}` +
  `${s} .c-value{grid-column:1;grid-row:1 / span 2;align-self:center;font-size:21px}` +
  `${s} .c-label{grid-column:2;grid-row:1;margin-top:0}` +
  `${s} .c-said{grid-column:2;grid-row:2}}` +
  `@media (max-width:480px){${s} .c-title{font-size:23px}${s} .c-lead{font-size:14px}}`

const badge = (value: string, label: string, said: string): string =>
  `<div class="c-cell"><span class="c-value">${value}</span><span class="c-label">${label}</span>` +
  `<span class="c-said">${said}</span></div>`

export const HERO_BADGES_SAMPLE: NewSample = {
  id: 'hero-badges',
  category: '冒頭・つかみ',
  name: '見出し＋実績バッジ3つ',
  summary: '見出しの下に数字の実績を3つ。囲まず、細い線1本の帯にまとめます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      '<h1 class="c-title">請求も入金の確認も、<em>ひとつの画面</em>でまとめて</h1>' +
      '<p class="c-lead">従業員30名までの会社のために作りました。' +
      '表計算ソフトからの乗りかえは、最短1日で終わります。</p>' +
      '<div class="c-strip">' +
      badge('96%', '利用者の満足度', '回答1,043件・2026年3月') +
      badge('1,200社', 'ご利用いただいている会社', '2026年3月時点') +
      badge('94%', '1年後も続けている割合', '2025年に始めた方のうち') +
      '</div>' +
      '<p class="c-note">※数字はいずれも当社調べです。内容は変わることがあります。</p>',
  }),
}
