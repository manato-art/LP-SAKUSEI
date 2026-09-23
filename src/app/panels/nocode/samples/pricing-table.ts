/**
 * 新しい見本「料金表（項目と金額）」（2026-09-23）。
 *
 * 項目が多くて箇条書きでは読みにくいときの表。縦線は引かず、横の細い線だけで区切る。
 * 金額は右そろえ・等幅の数字にして、桁がそろって見えるようにする。
 */
import { INK, INK_SUB, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-e0000003'
const ACCENT = '#2B4A7E'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .m-wrap{max-width:620px;margin:0 auto}` +
  `${s} .m-table{width:100%;border-collapse:collapse;table-layout:fixed}` +
  `${s} .m-th{padding:0 2px 9px;border-bottom:2px solid ${ACCENT};font-size:12.5px;font-weight:800;` +
  `line-height:1.6;color:${ACCENT};text-align:left;letter-spacing:.03em}` +
  `${s} .m-th--right{text-align:right;width:38%}` +
  `${s} .m-td{padding:13px 2px;border-bottom:1px solid ${LINE_LIGHT};font-size:14.5px;line-height:1.7;` +
  `color:${INK};text-align:left;vertical-align:top;word-break:auto-phrase}` +
  `${s} .m-td--right{text-align:right;font-weight:800;font-variant-numeric:tabular-nums}` +
  `${s} .m-sub{display:block;font-size:12px;font-weight:400;line-height:1.7;color:${INK_SUB};margin-top:2px}` +
  `${s} .m-free{font-size:13px;font-weight:800;color:${ACCENT}}` +
  `${s} .m-note{margin:14px 0 0;font-size:12px;line-height:1.8;color:${INK_SUB}}` +
  `@media (max-width:480px){${s} .m-td{font-size:13.5px;padding:11px 0}${s} .m-th{font-size:11.5px}` +
  `${s} .m-th--right{width:40%}${s} .m-sub{font-size:11.5px}}`

const row = (item: string, note: string, price: string, isFree = false): string =>
  `<tr><td class="m-td">${item}${note === '' ? '' : `<span class="m-sub">${note}</span>`}</td>` +
  `<td class="m-td m-td--right">${isFree ? `<span class="m-free">${price}</span>` : price}</td></tr>`

export const PRICING_TABLE_SAMPLE: NewSample = {
  id: 'pricing-table',
  category: '料金・プラン',
  name: '料金表（項目ごとの金額）',
  summary: '項目が多いときの表。縦線を引かず、金額を右にそろえて読みやすくします',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('料金の内訳', 'お申し込みのときにかかる費用と、毎月かかる費用の一覧です。') +
      '<div class="m-wrap">' +
      '<table class="m-table"><thead><tr>' +
      '<th class="m-th">項目</th><th class="m-th m-th--right">料金（税込）</th>' +
      '</tr></thead><tbody>' +
      row('初期費用', 'お申し込みのときだけ', '0円', true) +
      row('月額の基本料金', '3名までお使いいただけます', '4,800円') +
      row('アカウントの追加', '4名目から、1名あたり月額', '800円') +
      row('データ移行の代行', 'ご希望の場合のみ・1回かぎり', '22,000円') +
      row('ご相談の窓口', 'メール・チャット（平日9時〜18時）', '月額に含みます', true) +
      row('解約のお手続き', 'いつでもお手続きいただけます', '0円', true) +
      '</tbody></table>' +
      '<p class="m-note">※金額はすべて税込みです。※月の途中でお申し込みの場合は、日割りでご請求します。' +
      '※表にない作業をご希望の場合は、お見積りのうえご案内します。※2026年3月時点の料金です。</p>' +
      '</div>',
  }),
}
