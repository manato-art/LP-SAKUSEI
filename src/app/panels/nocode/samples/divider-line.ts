/**
 * 新しい見本「区切り線」（2026-09-23）。
 *
 * 話の切れ目に引く細い線1本。上下に余白を持たせ、線そのものは目立たせない
 * （区切りが強すぎると、そこで読む手が止まってしまうため）。
 */
import { LINE, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-h0000010'
const s = `.${UID}`

const CSS =
  `${s}{padding:28px 16px}` +
  `${s} .r-line{max-width:620px;height:1px;margin:0 auto;border:0;background:${LINE}}` +
  `@media (max-width:480px){${s}{padding:22px 16px}}`

export const DIVIDER_LINE_SAMPLE: NewSample = {
  id: 'divider-line',
  category: '文章・区切り',
  name: '区切り線',
  summary: '話の切れ目に引く細い線1本。上下に余白を取ってあります',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body: '<hr class="r-line">',
  }),
}
