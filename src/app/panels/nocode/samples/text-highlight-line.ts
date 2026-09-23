/**
 * 新しい見本「大事な一文（下線つき）」（2026-09-23）。
 *
 * ここだけは読んでほしい、という1文を大きく置く区画。色文字や太い囲みで強めず、
 * 淡いマーカー（文字の下側だけに敷いた帯）で示す。行が折り返しても帯は文字の下に付いてくる。
 */
import { sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-h0000006'
const MARKER = '#D7E7F8'
const s = `.${UID}`

const CSS =
  `${s}{padding:26px 16px}` +
  `${s} .m-line{max-width:560px;margin:0 auto;font-size:19px;font-weight:800;line-height:2.1;` +
  `text-align:center}` +
  `${s} .m-line span{background:linear-gradient(transparent 62%,${MARKER} 62%);padding:0 3px}` +
  `@media (max-width:480px){${s} .m-line{font-size:17px;line-height:2;text-align:left}}`

export const TEXT_HIGHLIGHT_LINE_SAMPLE: NewSample = {
  id: 'text-highlight-line',
  category: '文章・区切り',
  name: '大事な一文（下線つき）',
  summary: 'ここだけは読んでほしい1文を、淡いマーカーで示します',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body: '<p class="m-line"><span>準備にかかる時間は、はじめの1回だけです。</span></p>',
  }),
}
