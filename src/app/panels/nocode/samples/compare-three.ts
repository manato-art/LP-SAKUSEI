/**
 * 新しい見本「3列の比較表（自社とA社・B社）」（2026-09-23）。
 *
 * 5項目 × 3社。自社の列だけ淡い地にして、ほかは白のままにしてある（強調は1か所だけ）。
 * 狭い画面でも横に溢れないよう、列幅は決めずに文字と余白だけを小さくして収める。
 */
import { INK, INK_SUB, LINE, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-d0000009'
const ACCENT = '#1F7AE0'
const TINT = '#F1F6FD'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .t-wrap{max-width:620px;margin:0 auto;overflow-x:auto}` +
  `${s} .t-table{width:100%;border-collapse:collapse;font-size:13.5px;line-height:1.7}` +
  `${s} .t-table th,${s} .t-table td{padding:13px 8px;border-bottom:1px solid ${LINE_LIGHT};` +
  `text-align:center;vertical-align:middle}` +
  `${s} .t-table thead th{font-size:12.5px;font-weight:800;color:${INK_SUB};border-bottom:1px solid ${LINE}}` +
  `${s} .t-table thead th.is-mine{font-size:13px;color:${ACCENT}}` +
  `${s} .t-table tbody th{text-align:left;font-weight:700;color:${INK}}` +
  `${s} .t-table .is-mine{background:${TINT}}` +
  `${s} .t-table td.is-mine{font-weight:800;color:${ACCENT}}` +
  `${s} .t-note{max-width:620px;margin:14px auto 0;font-size:12px;line-height:1.75;color:${INK_SUB}}` +
  `@media (max-width:480px){${s} .t-table{font-size:12.5px}` +
  `${s} .t-table th,${s} .t-table td{padding:11px 5px}` +
  `${s} .t-table thead th{font-size:11.5px}${s} .t-table thead th.is-mine{font-size:12px}}`

const row = (label: string, mine: string, a: string, b: string): string =>
  `<tr><th scope="row">${label}</th><td class="is-mine">${mine}</td><td>${a}</td><td>${b}</td></tr>`

export const COMPARE_THREE_SAMPLE: NewSample = {
  id: 'compare-three',
  category: '比較・違い',
  name: '3列の比較表（自社とA社・B社）',
  summary: '5項目を3社で比べます。自社の列だけ淡い地にして目立たせます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('ほかのサービスと比べてみました', '同じくらいの内容で使える3社を並べています。') +
      '<div class="t-wrap"><table class="t-table">' +
      '<thead><tr><th scope="col"></th><th scope="col" class="is-mine">このサービス</th>' +
      '<th scope="col">A社</th><th scope="col">B社</th></tr></thead><tbody>' +
      row('月々の費用', '2,980円', '4,500円', '3,800円') +
      row('はじめる準備', '不要', '工事あり', '書類3枚') +
      row('1日の手間', '約30秒', '約15分', '約5分') +
      row('相談の方法', 'チャット', 'メール', '電話') +
      row('解約のしかた', 'いつでも', '1年しばり', '30日前連絡') +
      '</tbody></table></div>' +
      '<p class="t-note">※2026年3月時点・各社の公開情報をもとにした当社調べです。金額は税込です。' +
      '内容は変わることがありますので、お申し込み前に各社のご案内をご確認ください。</p>',
  }),
}
