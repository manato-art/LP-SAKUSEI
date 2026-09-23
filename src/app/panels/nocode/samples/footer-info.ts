/**
 * 新しい見本「フッター（会社情報とリンク）」（2026-09-23）。
 *
 * LPのいちばん下。特定商取引法に基づく表記・プライバシーポリシー・お問い合わせは、
 * 広告審査でも見られるので最初から3つ置いておく（リンク先は仮。入れた人が入れる）。
 */
import { INK_SUB, LINE_LIGHT, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-foot0001'
const s = `.${UID}`

const CSS =
  `${s}{padding:28px 16px 24px;background:#F7F9FC;text-align:center}` +
  `${s} .o-name{font-size:14.5px;font-weight:800;line-height:1.7;margin:0 0 6px}` +
  `${s} .o-info{font-size:12.5px;line-height:1.9;color:${INK_SUB};margin:0 0 16px}` +
  `${s} .o-links{display:flex;flex-wrap:wrap;justify-content:center;gap:8px 18px;` +
  `padding-top:16px;border-top:1px solid ${LINE_LIGHT}}` +
  `${s} .o-link{font-size:12.5px;line-height:1.8;color:${INK_SUB};text-decoration:underline;text-underline-offset:3px}` +
  `${s} .o-link:hover{color:#1F2A37}` +
  `${s} .o-copy{margin:16px 0 0;font-size:11.5px;line-height:1.7;color:#9AA3AE}` +
  `@media (max-width:480px){${s} .o-links{gap:8px 14px}}`

const link = (text: string): string => `<a class="o-link" href="ooooo">${text}</a>`

export const FOOTER_INFO_SAMPLE: NewSample = {
  id: 'footer-info',
  category: 'フッター・注意書き',
  name: 'フッター（会社情報とリンク）',
  summary: '特定商取引法に基づく表記・プライバシーポリシー・お問い合わせの3つを最初から用意',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      '<p class="o-name">株式会社サンプル</p>' +
      '<p class="o-info">〒000-0000 東京都サンプル区サンプル1-2-3<br>' +
      '受付時間 平日10:00〜18:00（土日祝を除く）</p>' +
      '<div class="o-links">' +
      link('特定商取引法に基づく表記') +
      link('プライバシーポリシー') +
      link('お問い合わせ') +
      '</div>' +
      '<p class="o-copy">© 株式会社サンプル</p>',
  }),
}
