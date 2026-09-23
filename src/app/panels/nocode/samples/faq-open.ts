/**
 * 新しい見本「よくある質問（5問・押すと開く）」（2026-09-23）。
 *
 * 開け閉めは `<details>` の標準の動きで、スクリプトを使わない
 * （どのブラウザでも動き、読み上げにも対応する。見本のスクリプトが増えるほど壊れやすくなる）。
 */
import { INK, INK_SUB, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-faqq0001'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .f-list{max-width:620px;margin:0 auto;border-top:1px solid ${LINE_LIGHT}}` +
  `${s} .f-item{border-bottom:1px solid ${LINE_LIGHT}}` +
  `${s} .f-q{display:flex;align-items:flex-start;gap:10px;padding:16px 34px 16px 2px;position:relative;` +
  `font-size:15.5px;font-weight:800;line-height:1.7;color:${INK};cursor:pointer;list-style:none}` +
  `${s} .f-q::-webkit-details-marker{display:none}` +
  `${s} .f-q::before{content:"Q";flex:0 0 auto;color:${ACCENT};font-size:15px;font-weight:800}` +
  // 右端の「＋」。開くと「−」になる（線2本の向きで見せる）
  `${s} .f-q::after{content:"";position:absolute;right:6px;top:24px;width:13px;height:13px;` +
  `border-right:2px solid ${ACCENT};border-bottom:2px solid ${ACCENT};transform:rotate(45deg);` +
  `transform-origin:center;transition:transform .18s ease}` +
  `${s} .f-item[open] .f-q::after{transform:rotate(-135deg);top:28px}` +
  `${s} .f-a{display:flex;align-items:flex-start;gap:10px;padding:0 6px 18px 2px;font-size:14.5px;` +
  `line-height:1.95;color:${INK_SUB}}` +
  `${s} .f-a::before{content:"A";flex:0 0 auto;color:#9AA3AE;font-size:14px;font-weight:800}` +
  `@media (max-width:480px){${s} .f-q{font-size:14.5px}${s} .f-a{font-size:13.5px}}` +
  `@media (prefers-reduced-motion:reduce){${s} .f-q::after{transition:none}}`

const qa = (question: string, answer: string, open = false): string =>
  `<details class="f-item"${open ? ' open=""' : ''}><summary class="f-q"><span>${question}</span></summary>` +
  `<p class="f-a"><span>${answer}</span></p></details>`

export const FAQ_OPEN_SAMPLE: NewSample = {
  id: 'faq-open',
  name: 'よくある質問（5問・押すと開く）',
  summary: '押すと答えが開きます。スクリプトを使わないので、どの環境でも動きます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('よくあるご質問') +
      '<div class="f-list">' +
      qa('送料はかかりますか？', '全国どこでも送料無料でお届けします。離島の場合も追加の費用はいただきません。', true) +
      qa('届くまでにどれくらいかかりますか？', 'ご注文から2〜4日でお届けします。お届け日と時間帯の指定もできます。') +
      qa('解約はいつでもできますか？', 'はい。マイページから1分ほどで手続きできます。電話は必要ありません。') +
      qa('合わなかった場合は返品できますか？', '届いてから30日間は、理由を問わず返品できます。返送の送料も当社が負担します。') +
      qa('支払い方法は何がありますか？', 'クレジットカード・口座振替・コンビニ払いに対応しています。') +
      '</div>',
  }),
}
