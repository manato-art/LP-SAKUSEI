/**
 * 新しい見本「帯の見出し」（2026-09-23）。
 *
 * 話が変わるところに挟む帯1本。左右いっぱいに濃い地を敷いて白い文字を置き、上下の区画をはっきり切る。
 * 地の色はどのLPに入れても浮かないよう、見本共通の濃い墨色にしている。
 */
import { INK, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-h0000007'
const s = `.${UID}`

const CSS =
  `${s}{padding:0}` +
  `${s} .d-band{padding:18px 16px;background:${INK};text-align:center}` +
  `${s} .d-title{font-size:19px;font-weight:800;line-height:1.6;color:#FFFFFF;letter-spacing:.03em}` +
  `@media (max-width:480px){${s} .d-band{padding:16px 14px}${s} .d-title{font-size:17px}}`

export const HEADING_BAND_SAMPLE: NewSample = {
  id: 'heading-band',
  category: '文章・区切り',
  name: '帯の見出し',
  summary: '話が変わるところに挟む帯1本。濃い地に白文字で区切ります',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body: '<div class="d-band"><h2 class="d-title">ここからは、料金についてご説明します</h2></div>',
  }),
}
