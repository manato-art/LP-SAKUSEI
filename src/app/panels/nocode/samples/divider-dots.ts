/**
 * 新しい見本「点の区切り」（2026-09-23）。
 *
 * 線よりやわらかく切りたいときの区切り。小さな点を3つ並べるだけにしている。
 * 同じ話の中で場面が変わるところ（文章の続き）に向く。
 */
import { LINE, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-h0000011'
const s = `.${UID}`

const CSS =
  `${s}{padding:26px 16px}` +
  `${s} .o-dots{display:flex;justify-content:center;align-items:center;gap:10px}` +
  `${s} .o-dot{width:5px;height:5px;border-radius:50%;background:${LINE}}` +
  `@media (max-width:480px){${s}{padding:22px 16px}${s} .o-dots{gap:9px}}`

export const DIVIDER_DOTS_SAMPLE: NewSample = {
  id: 'divider-dots',
  category: '文章・区切り',
  name: '点の区切り',
  summary: '小さな点を3つ並べた区切り。線よりやわらかく切れます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body: '<div class="o-dots"><span class="o-dot"></span><span class="o-dot"></span><span class="o-dot"></span></div>',
  }),
}
