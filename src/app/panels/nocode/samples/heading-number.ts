/**
 * 新しい見本「番号つきの見出し」（2026-09-23）。
 *
 * 章立てに使う見出し。番号は小さく上に置いて、見出しそのものより目立たせない。
 * 見出しの大きさは headCss にそろえてあるので、ほかの区画と並べても浮かない。
 */
import { head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-h0000009'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s}{padding:40px 16px 28px}` +
  `${s} .u-no{font-size:13px;font-weight:800;line-height:1;letter-spacing:.18em;text-align:center;` +
  `color:${ACCENT};margin:0 0 12px;font-variant-numeric:tabular-nums}` +
  `${s} .nsx-lead{margin:12px 0 0}` +
  `@media (max-width:480px){${s}{padding:32px 16px 24px}}`

export const HEADING_NUMBER_SAMPLE: NewSample = {
  id: 'heading-number',
  category: '文章・区切り',
  name: '番号つきの見出し',
  summary: '番号を小さく上に置いた見出し。章立てにして読ませたいときに',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body: '<p class="u-no">01</p>' + head('まずは、いまの困りごとを整理します', 'ここから順番にご説明します。'),
  }),
}
