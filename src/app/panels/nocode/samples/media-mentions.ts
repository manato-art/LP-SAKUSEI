/**
 * 新しい見本「メディア掲載（3件）」（2026-09-23）。
 *
 * 媒体名・日付・一言だけの、落ち着いた見せ方。色も飾りもほとんど使わず、
 * 左に媒体名と日付、右に内容の一文を置いて、細い線で区切るだけにしている。
 */
import { INK_SUB, LINE, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-d0000004'
const ACCENT = '#2F5D8A'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .n-list{max-width:620px;margin:0 auto;border-top:1px solid ${LINE}}` +
  `${s} .n-item{display:grid;grid-template-columns:minmax(0,12.5em) minmax(0,1fr);gap:4px 20px;` +
  `align-items:baseline;padding:16px 2px;border-bottom:1px solid ${LINE_LIGHT}}` +
  `${s} .n-name{display:block;font-size:14.5px;font-weight:700;line-height:1.65;color:${ACCENT}}` +
  `${s} .n-date{display:block;margin-top:3px;font-size:12px;line-height:1.6;color:${INK_SUB};` +
  `font-variant-numeric:tabular-nums}` +
  `${s} .n-text{font-size:14px;line-height:1.85;color:${INK_SUB}}` +
  `${s} .n-note{max-width:620px;margin:16px auto 0;font-size:12px;line-height:1.7;color:${INK_SUB}}` +
  `@media (max-width:560px){${s} .n-item{grid-template-columns:minmax(0,1fr);gap:6px;padding:15px 2px}` +
  `${s} .n-text{font-size:13.5px}}`

const item = (media: string, date: string, text: string): string =>
  `<li class="n-item"><div class="n-meta"><span class="n-name">${media}</span>` +
  `<span class="n-date">${date}</span></div><p class="n-text">${text}</p></li>`

export const MEDIA_MENTIONS_SAMPLE: NewSample = {
  id: 'media-mentions',
  category: '信頼・実績',
  name: 'メディア掲載（3件）',
  summary: '媒体名・日付・一言だけを並べます。飾らず落ち着いた見せ方です',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('メディアに取り上げていただきました') +
      '<ul class="n-list">' +
      item(
        'サンプル新聞（朝刊・くらし面）',
        '2026年2月14日',
        '「手間をかけずに続けられる仕組み」として、2社の事例とともに紹介されました。',
      ) +
      item(
        'サンプル経済オンライン',
        '2026年1月9日',
        '従業員10名ほどの会社が、月21時間の残業を減らした取り組みとして取り上げられました。',
      ) +
      item(
        '月刊サンプル（2026年3月号）',
        '2026年3月1日',
        'ご利用中の3名へのインタビューが、6ページにわたって掲載されました。',
      ) +
      '</ul>' +
      '<p class="n-note">※掲載時点の内容です。現在の内容とは異なる場合があります。</p>',
  }),
}
