/**
 * 新しい見本「導入前と導入後（表・4項目）」（2026-09-23）。
 *
 * 4項目を「導入前」「導入後」の2列で並べ、導入後の下に変化の幅（何分減ったか）を小さく添える。
 * 導入後の列だけ淡い地にして、目立たせるのは1か所だけにしている。
 * 1社の実績であることを注記で必ず書き、成果の言い切りはしない。
 */
import { INK, INK_SUB, LINE, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-d0000010'
const ACCENT = '#1F7AE0'
const TINT = '#F1F6FD'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .a-wrap{max-width:560px;margin:0 auto;overflow-x:auto}` +
  `${s} .a-table{width:100%;border-collapse:collapse;font-size:13.5px;line-height:1.7}` +
  `${s} .a-table th,${s} .a-table td{padding:14px 8px;border-bottom:1px solid ${LINE_LIGHT};` +
  `text-align:center;vertical-align:middle}` +
  `${s} .a-table thead th{font-size:12.5px;font-weight:800;color:${INK_SUB};border-bottom:1px solid ${LINE}}` +
  `${s} .a-table thead th.is-after{color:${ACCENT}}` +
  `${s} .a-table tbody th{text-align:left;font-weight:700;color:${INK}}` +
  `${s} .a-table .is-after{background:${TINT}}` +
  `${s} .a-before{font-size:16px;color:${INK_SUB};font-variant-numeric:tabular-nums}` +
  `${s} .a-after{font-size:19px;font-weight:800;color:${ACCENT};font-variant-numeric:tabular-nums;` +
  `line-height:1.4}` +
  `${s} .a-diff{display:block;margin-top:2px;font-size:11.5px;font-weight:700;color:${INK_SUB}}` +
  `${s} .a-note{max-width:560px;margin:14px auto 0;font-size:12px;line-height:1.75;color:${INK_SUB}}` +
  `@media (max-width:480px){${s} .a-table{font-size:12.5px}` +
  `${s} .a-table th,${s} .a-table td{padding:12px 5px}` +
  `${s} .a-before{font-size:14.5px}${s} .a-after{font-size:17px}}`

const row = (label: string, before: string, after: string, diff: string): string =>
  `<tr><th scope="row">${label}</th><td><span class="a-before">${before}</span></td>` +
  `<td class="is-after"><span class="a-after">${after}</span><span class="a-diff">${diff}</span></td></tr>`

export const COMPARE_BEFORE_AFTER_SAMPLE: NewSample = {
  id: 'compare-before-after',
  category: '比較・違い',
  name: '導入前と導入後（表・4項目）',
  summary: '4項目を導入前後の2列で。変化の幅を数字の下に小さく添えます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('導入する前と、あとで', '従業員12名の会社に、3か月ぶんの記録をご提供いただきました。') +
      '<div class="a-wrap"><table class="a-table">' +
      '<thead><tr><th scope="col"></th><th scope="col">導入前</th>' +
      '<th scope="col" class="is-after">導入後</th></tr></thead><tbody>' +
      row('1件あたりの作業時間', '45分', '14分', '31分みじかく') +
      row('1か月の入力ミス', '18件', '2件', '16件すくなく') +
      row('資料をつくる日数', '3日', '半日', '約6分の1に') +
      row('1か月の残業時間', '21時間', '7時間', '14時間すくなく') +
      '</tbody></table></div>' +
      '<p class="a-note">※導入いただいた1社の記録です（2026年1月〜3月・自社調べ）。' +
      'ご利用の状況によって結果は変わります。同じ成果を保証するものではありません。</p>',
  }),
}
