/**
 * 新しい見本「フッター（会社名とコピーライトだけ）」（2026-09-23）。
 *
 * いちばん軽いフッター。リンクや住所を載せない一枚もののLP向け。
 */
import { INK_SUB, LINE_LIGHT, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-i0000001'
const s = `.${UID}`

const CSS =
  `${s}{padding:24px 16px 20px;text-align:center;border-top:1px solid ${LINE_LIGHT}}` +
  `${s} .fs-name{font-size:13.5px;font-weight:700;line-height:1.7;margin:0 0 4px}` +
  `${s} .fs-copy{margin:0;font-size:11.5px;line-height:1.7;color:${INK_SUB}}`

export const FOOTER_SIMPLE_SAMPLE: NewSample = {
  id: 'footer-simple',
  category: 'フッター・注意書き',
  name: 'フッター（会社名だけ）',
  summary: 'いちばん軽いフッター。会社名と著作権表示だけを静かに置きます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body: '<p class="fs-name">株式会社サンプル</p><p class="fs-copy">© 株式会社サンプル</p>',
  }),
}
