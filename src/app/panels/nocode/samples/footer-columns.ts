/**
 * 新しい見本「フッター（リンク2列＋会社情報）」（2026-09-23）。
 *
 * 項目が多いLP向け。PCは2列、スマホは1列。リンク先は仮（入れた人がWidget編集で入れる）。
 */
import { INK, INK_SUB, LINE_LIGHT, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-i0000003'
const s = `.${UID}`

const CSS =
  `${s}{padding:28px 16px 22px;background:#F7F9FC}` +
  `${s} .fc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;max-width:620px;margin:0 auto}` +
  `${s} .fc-head{font-size:12.5px;font-weight:800;line-height:1.7;color:${INK};margin:0 0 8px}` +
  `${s} .fc-link{display:block;padding:5px 0;font-size:12.5px;line-height:1.8;color:${INK_SUB};` +
  `text-decoration:none}` +
  `${s} .fc-link:hover{color:${INK};text-decoration:underline;text-underline-offset:3px}` +
  `${s} .fc-info{max-width:620px;margin:20px auto 0;padding-top:16px;border-top:1px solid ${LINE_LIGHT};` +
  `font-size:12px;line-height:1.9;color:${INK_SUB}}` +
  `${s} .fc-copy{max-width:620px;margin:10px auto 0;font-size:11.5px;line-height:1.7;color:#9AA3AE}` +
  `@media (max-width:480px){${s} .fc-grid{grid-template-columns:minmax(0,1fr);gap:16px}}`

const link = (text: string): string => `<a class="fc-link" href="ooooo">${text}</a>`

export const FOOTER_COLUMNS_SAMPLE: NewSample = {
  id: 'footer-columns',
  category: 'フッター・注意書き',
  name: 'フッター（リンク2列＋会社情報）',
  summary: '項目が多いLP向け。サービスと会社のリンクを2列に分けて置きます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      '<div class="fc-grid">' +
      '<div><p class="fc-head">サービスについて</p>' +
      link('はじめての方へ') +
      link('料金とプラン') +
      link('よくあるご質問') +
      '</div>' +
      '<div><p class="fc-head">会社とお約束</p>' +
      link('特定商取引法に基づく表記') +
      link('プライバシーポリシー') +
      link('お問い合わせ') +
      '</div></div>' +
      '<p class="fc-info">株式会社サンプル　〒000-0000 東京都サンプル区サンプル1-2-3<br>' +
      '受付時間 平日10:00〜18:00（土日祝を除く）</p>' +
      '<p class="fc-copy">© 株式会社サンプル</p>',
  }),
}
