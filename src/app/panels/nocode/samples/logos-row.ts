/**
 * 新しい見本「導入企業のロゴ（6枠）」（2026-09-23）。
 *
 * 仮画像を6つ並べる区画。1枠ずつを箱にすると「同じカードの反復」になるので、
 * 1pxのすき間で区切った1枚の面として見せている。狭い画面では3列×2段に折り返す。
 */
import { INK_SUB, LINE_LIGHT, IMAGE_PLACEHOLDER, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-d0000003'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .l-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:1px;` +
  `max-width:620px;margin:0 auto;background:${LINE_LIGHT};border:1px solid ${LINE_LIGHT}}` +
  `${s} .l-cell{display:flex;align-items:center;justify-content:center;min-width:0;` +
  `padding:16px 8px;background:#FAFBFC}` +
  `${s} .l-cell img{width:100%;max-width:84px}` +
  `${s} .l-more{max-width:620px;margin:16px auto 0;text-align:center;font-size:13.5px;line-height:1.8;color:${INK_SUB}}` +
  `${s} .l-more strong{font-size:17px;font-weight:800;color:${ACCENT};font-variant-numeric:tabular-nums}` +
  `${s} .l-note{max-width:620px;margin:8px auto 0;text-align:center;font-size:12px;line-height:1.7;color:${INK_SUB}}` +
  `@media (max-width:560px){${s} .l-grid{grid-template-columns:repeat(3,minmax(0,1fr))}` +
  `${s} .l-cell{padding:14px 6px}}`

const cell = (alt: string): string =>
  `<div class="l-cell"><img src="${IMAGE_PLACEHOLDER}" alt="${alt}"></div>`

export const LOGOS_ROW_SAMPLE: NewSample = {
  id: 'logos-row',
  category: '信頼・実績',
  name: '導入企業のロゴ（6枠）',
  summary: 'ロゴを6つ並べます。狭い画面では3列2段に折り返します',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('ご利用いただいている会社', '3名の事務所から、拠点が全国にある会社まで、幅広くお使いいただいています。') +
      '<div class="l-grid">' +
      cell('株式会社サンプルA のロゴ') +
      cell('株式会社サンプルB のロゴ') +
      cell('サンプルC株式会社 のロゴ') +
      cell('サンプルD工業株式会社 のロゴ') +
      cell('株式会社サンプルE のロゴ') +
      cell('サンプルF合同会社 のロゴ') +
      '</div>' +
      '<p class="l-more">このほかにも <strong>1,200社</strong> 以上にご利用いただいています。</p>' +
      '<p class="l-note">※掲載は許可をいただいた会社さまのみです（2026年3月時点）。</p>',
  }),
}
