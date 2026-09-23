/**
 * 新しい見本「写真のビフォーアフター」（2026-09-23）。
 *
 * 使う前と使った後の写真を左右に並べる区画。狭い画面でも並びを崩さない（並べないと比べられない）。
 * 言い切りにならないよう、下に「写真はイメージ・感じ方には個人差がある」の一行を必ず置く。
 */
import { IMAGE_PLACEHOLDER, INK_SUB, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-c0000009'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .a-pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;max-width:620px;margin:0 auto}` +
  `${s} .a-label{margin:0 0 8px;padding-bottom:7px;border-bottom:1px solid ${LINE_LIGHT};` +
  `font-size:13px;font-weight:800;letter-spacing:.04em;text-align:center;color:${INK_SUB}}` +
  `${s} .a-col--after .a-label{color:${ACCENT};border-bottom-color:${ACCENT}}` +
  `${s} .a-col img{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:4px}` +
  `${s} .a-when{margin:8px 0 0;font-size:12.5px;line-height:1.75;text-align:center;color:${INK_SUB}}` +
  `${s} .a-note{max-width:620px;margin:16px auto 0;font-size:12px;line-height:1.8;color:${INK_SUB}}` +
  `@media (max-width:480px){${s} .a-pair{gap:10px}${s} .a-label{font-size:12px}${s} .a-when{font-size:11.5px}}`

const side = (kind: 'before' | 'after', label: string, when: string, alt: string): string =>
  `<figure class="a-col a-col--${kind}"><figcaption class="a-label">${label}</figcaption>` +
  `<img src="${IMAGE_PLACEHOLDER}" alt="${alt}"><p class="a-when">${when}</p></figure>`

export const IMAGE_BEFORE_AFTER_SAMPLE: NewSample = {
  id: 'image-before-after',
  category: '画像・動画',
  name: '写真のビフォーアフター',
  summary: '使う前と使った後の写真を左右に。上にラベル、下に撮った日を入れます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('使う前と、使った後', '同じ場所・同じ明るさで撮影した写真です。') +
      '<div class="a-pair">' +
      side('before', '使う前', '1日目の朝に撮影', '使う前の様子の写真') +
      side('after', '使った後', '14日目の朝に撮影', '使った後の様子の写真') +
      '</div>' +
      '<p class="a-note">写真はイメージです。感じ方や見え方には個人差があり、同じようになることをお約束するものではありません。</p>',
  }),
}
