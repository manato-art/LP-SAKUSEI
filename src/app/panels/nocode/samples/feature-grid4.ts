/**
 * 新しい見本「4つの特徴（2×2）」（2026-09-23）。
 *
 * 選ばれる理由を4つ、2列2段で見せる区画。箱を4つ反復させず（ui-forge anti-ai-look）、
 * 細い横線と薄い番号だけで区切る。狭い画面では1列に積み直して、そのまま読める並びにする。
 */
import { INK_SUB, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-b0000001'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .f4-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:34px;` +
  `max-width:660px;margin:0 auto;border-bottom:1px solid ${LINE_LIGHT}}` +
  `${s} .f4-item{min-width:0;padding:20px 0;border-top:1px solid ${LINE_LIGHT}}` +
  `${s} .f4-no{font-size:12px;font-weight:800;line-height:1;letter-spacing:.14em;color:${ACCENT};` +
  `font-variant-numeric:tabular-nums;margin:0 0 8px}` +
  `${s} .f4-head{font-size:16.5px;font-weight:800;line-height:1.6;margin:0 0 6px}` +
  `${s} .f4-text{font-size:14.5px;line-height:1.85;color:${INK_SUB}}` +
  `${s} .f4-note{max-width:660px;margin:16px auto 0;font-size:12px;line-height:1.7;color:${INK_SUB};text-align:center}` +
  `@media (max-width:560px){${s} .f4-grid{grid-template-columns:minmax(0,1fr);column-gap:0}` +
  `${s} .f4-item{padding:18px 0}${s} .f4-head{font-size:16px}}`

const cell = (no: string, title: string, text: string): string =>
  `<div class="f4-item"><p class="f4-no">${no}</p><h3 class="f4-head">${title}</h3>` +
  `<p class="f4-text">${text}</p></div>`

export const FEATURE_GRID4_SAMPLE: NewSample = {
  id: 'feature-grid4',
  category: '特徴・価値',
  name: '4つの特徴（2×2）',
  summary: '選ばれる理由を4つ、2列2段で並べます。狭い画面では1列に積み直します',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('4つの特徴', 'はじめての方でも続けやすいように、仕組みを見直しました。') +
      '<div class="f4-grid">' +
      cell('01', '届いたその日から使えます', '箱から出してすぐに始められます。組み立ても、むずかしい初期設定もいりません。') +
      cell('02', '1日5分から続けられます', '朝でも夜でも、空いている5分で終わります。忙しい日は休んでも、翌日から戻せます。') +
      cell('03', '月々2,980円のままです', '追加の費用はいただきません。プランの変更も、解約の手数料もかかりません。') +
      cell('04', '30日間は返品できます', '開封したあとでも受け付けます。返送の送料は当社が負担いたします。') +
      '</div>' +
      '<p class="f4-note">※価格はすべて税込みです。2026年3月時点の内容です。</p>',
  }),
}
