/**
 * 新しい見本「料金についてのQ&A（4問）」（2026-09-23）。
 *
 * 料金のページの下に置く、短い問いと答え。押して開く形にはせず、4問とも出したままにする
 * （金額まわりは読み飛ばされると困るため）。箱は作らず、細い線で区切るだけにした。
 */
import { INK, INK_SUB, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-e0000004'
const ACCENT = '#2E7D5B'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .n-list{max-width:620px;margin:0 auto}` +
  `${s} .n-item{padding:16px 0;border-bottom:1px solid ${LINE_LIGHT}}` +
  `${s} .n-item:first-child{padding-top:0}` +
  `${s} .n-q{display:flex;align-items:flex-start;gap:10px;font-size:15.5px;font-weight:800;line-height:1.7;` +
  `color:${INK};margin:0 0 7px}` +
  `${s} .n-mark{flex:0 0 22px;width:22px;height:22px;display:flex;align-items:center;justify-content:center;` +
  `margin-top:2px;border-radius:5px;background:${ACCENT};color:#FFFFFF;font-size:12.5px;font-weight:800;line-height:1}` +
  `${s} .n-a{display:flex;align-items:flex-start;gap:10px;font-size:14px;line-height:1.95;color:${INK_SUB}}` +
  `${s} .n-mark--a{background:#FFFFFF;color:${ACCENT};border:1.5px solid ${ACCENT};font-size:12px}` +
  `${s} .n-note{max-width:620px;margin:16px auto 0;font-size:12px;line-height:1.8;color:${INK_SUB}}` +
  `@media (max-width:480px){${s} .n-q{font-size:14.5px;gap:8px}${s} .n-a{font-size:13.5px;gap:8px}}`

const qa = (question: string, answer: string): string =>
  `<div class="n-item"><p class="n-q"><span class="n-mark">Q</span><span>${question}</span></p>` +
  `<p class="n-a"><span class="n-mark n-mark--a">A</span><span>${answer}</span></p></div>`

export const PRICING_FAQ_SAMPLE: NewSample = {
  id: 'pricing-faq',
  category: '料金・プラン',
  name: '料金についてのQ&A（4問）',
  summary: '支払い方法・解約・追加費用など、お金まわりの4問。開かずに全部見せます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('料金についてのご質問', 'お問い合わせの多い4つをまとめました。') +
      '<div class="n-list">' +
      qa(
        'お支払い方法は何が選べますか？',
        'クレジットカード・口座振替・コンビニ払いの3つからお選びいただけます。' +
          '口座振替は、お申し込みから登録が終わるまでに2週間ほどかかります。それまでの分はコンビニ払いでご案内します。',
      ) +
      qa(
        '解約するときに費用はかかりますか？',
        '解約手数料はいただきません。マイページから1分ほどでお手続きでき、お手続きをした月の末日までご利用いただけます。' +
          'お電話でのお引き止めはいたしません。',
      ) +
      qa(
        '月額のほかに費用はかかりますか？',
        '初期費用と送料は0円です。追加でアカウントを増やす場合のみ、1名あたり月額800円（税込）をいただきます。' +
          'それ以外の費用が後からかかることはありません。',
      ) +
      qa(
        '途中でプランを変えられますか？',
        'いつでも変えられます。上のプランへの変更はその日から、下のプランへの変更は翌月1日から切り替わります。' +
          '差額は日割りで精算します。',
      ) +
      '</div>' +
      '<p class="n-note">※金額はすべて税込みです。※2026年3月時点の内容です。内容が変わる場合は、事前にメールでお知らせします。</p>',
  }),
}
