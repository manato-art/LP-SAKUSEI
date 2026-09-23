/**
 * 新しい見本「料金の比べ方（3社）」（2026-09-23）。
 *
 * 月額・初期費用・解約金の3項目 × 3社。月額だけを見ると分からない差が出るので、
 * 表の下に「1年つづけた場合の合計」を1文で足してある。
 * 自社の列だけ淡い地。狭い画面でも読めるよう、金額は短く書き、列幅は決めない。
 */
import { INK, INK_SUB, LINE, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-d0000012'
const ACCENT = '#1F7AE0'
const TINT = '#F1F6FD'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .r-wrap{max-width:560px;margin:0 auto;overflow-x:auto}` +
  `${s} .r-table{width:100%;border-collapse:collapse;font-size:13.5px;line-height:1.7}` +
  `${s} .r-table th,${s} .r-table td{padding:14px 8px;border-bottom:1px solid ${LINE_LIGHT};` +
  `text-align:center;vertical-align:middle;font-variant-numeric:tabular-nums}` +
  `${s} .r-table thead th{font-size:12.5px;font-weight:800;color:${INK_SUB};border-bottom:1px solid ${LINE}}` +
  `${s} .r-table thead th.is-mine{font-size:13px;color:${ACCENT}}` +
  `${s} .r-table tbody th{text-align:left;font-weight:700;color:${INK}}` +
  `${s} .r-table .is-mine{background:${TINT}}` +
  `${s} .r-table td.is-mine{font-weight:800;color:${ACCENT}}` +
  `${s} .r-sum{max-width:560px;margin:16px auto 0;font-size:14px;line-height:1.9;color:${INK}}` +
  `${s} .r-sum strong{font-weight:800;color:${ACCENT};font-variant-numeric:tabular-nums}` +
  `${s} .r-note{max-width:560px;margin:10px auto 0;font-size:12px;line-height:1.75;color:${INK_SUB}}` +
  `@media (max-width:480px){${s} .r-table{font-size:12.5px}` +
  `${s} .r-table th,${s} .r-table td{padding:12px 5px}` +
  `${s} .r-table thead th{font-size:11.5px}${s} .r-table thead th.is-mine{font-size:12px}` +
  `${s} .r-sum{font-size:13.5px}}`

const row = (label: string, mine: string, a: string, b: string): string =>
  `<tr><th scope="row">${label}</th><td class="is-mine">${mine}</td><td>${a}</td><td>${b}</td></tr>`

export const COMPARE_PRICE_SAMPLE: NewSample = {
  id: 'compare-price',
  category: '比較・違い',
  name: '料金の比べ方（3社）',
  summary: '月額・初期費用・解約金を3社で。1年つづけた合計も添えます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('料金は、3つを見ると分かります', '月額だけでなく、初期費用と解約金もあわせてご覧ください。') +
      '<div class="r-wrap"><table class="r-table">' +
      '<thead><tr><th scope="col"></th><th scope="col" class="is-mine">このサービス</th>' +
      '<th scope="col">A社</th><th scope="col">B社</th></tr></thead><tbody>' +
      row('月額', '2,980円', '4,500円', '3,800円') +
      row('初期費用', '0円', '19,800円', '9,800円') +
      row('解約金', '0円', '9,800円', '1か月分') +
      '</tbody></table></div>' +
      '<p class="r-sum">1年間つづけた場合の合計は、このサービスが <strong>35,760円</strong>、' +
      'A社が 73,800円、B社が 55,400円です（解約しなかった場合）。</p>' +
      '<p class="r-note">※2026年3月時点・各社の公開情報をもとにした当社調べです。金額はすべて税込です。' +
      '内容は変わることがありますので、お申し込み前に各社のご案内をご確認ください。</p>',
  }),
}
