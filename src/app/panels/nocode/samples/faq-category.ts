/**
 * 新しい見本「種類ごとのよくある質問」（2026-09-23）。
 *
 * 質問が増えると探しにくくなるので「料金について」「使い方について」の2つに分ける。
 * 小見出しは箱にせず、文字の右へ細い線を伸ばすだけ。
 * 開け閉めは `<details>` の標準の動きで、スクリプトを使わない（どのブラウザでも動き、読み上げにも対応する）。
 */
import { CHEVRON_RIGHT, INK, INK_SUB, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-f0000002'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .g-wrap{max-width:620px;margin:0 auto}` +
  `${s} .g-cat{display:flex;align-items:center;gap:12px;margin:28px 0 0;font-size:13.5px;font-weight:800;` +
  `letter-spacing:.08em;line-height:1.6;color:${ACCENT}}` +
  `${s} .g-cat:first-child{margin-top:0}` +
  `${s} .g-cat::after{content:"";flex:1;height:1px;background:${LINE_LIGHT}}` +
  `${s} .g-item{border-bottom:1px solid ${LINE_LIGHT}}` +
  `${s} .g-q{display:flex;align-items:flex-start;gap:10px;padding:14px 2px;font-size:15px;font-weight:800;` +
  `line-height:1.7;color:${INK};cursor:pointer;list-style:none}` +
  `${s} .g-q::-webkit-details-marker{display:none}` +
  `${s} .g-mark{flex:0 0 14px;width:14px;height:14px;margin-top:6px;color:${ACCENT};` +
  `transition:transform .18s ease}` +
  `${s} .g-mark svg{width:100%;height:100%;display:block}` +
  `${s} .g-item[open] .g-mark{transform:rotate(90deg)}` +
  `${s} .g-a{padding:0 2px 16px 26px;font-size:14px;line-height:1.95;color:${INK_SUB}}` +
  `@media (max-width:480px){${s} .g-q{font-size:14.5px}${s} .g-a{font-size:13.5px;padding-left:24px}}` +
  `@media (prefers-reduced-motion:reduce){${s} .g-mark{transition:none}}`

const cat = (title: string): string => `<p class="g-cat">${title}</p>`

const qa = (question: string, answer: string, open = false): string =>
  `<details class="g-item"${open ? ' open=""' : ''}>` +
  `<summary class="g-q"><span class="g-mark">${CHEVRON_RIGHT}</span><span>${question}</span></summary>` +
  `<p class="g-a">${answer}</p></details>`

export const FAQ_CATEGORY_SAMPLE: NewSample = {
  id: 'faq-category',
  category: 'よくある質問',
  name: '種類ごとのよくある質問',
  summary: '料金と使い方に分けて並べます。押すと答えが開きます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('よくあるご質問', '知りたいことから順にお読みください。') +
      '<div class="g-wrap">' +
      cat('料金について') +
      qa('月額のほかに費用はかかりますか？', '月額料金のほかにいただく費用はありません。送料も全国無料です。', true) +
      qa('支払い方法は選べますか？', 'クレジットカード・口座振替・コンビニ払いからお選びいただけます。') +
      qa('途中でプランを変えられますか？', 'マイページからいつでも変更できます。差額は日割りで精算します。') +
      cat('使い方について') +
      qa('使いはじめに準備は必要ですか？', '届いた箱から出して、そのまま使いはじめられます。工具や工事はいりません。') +
      qa('スマートフォンからも使えますか？', 'パソコンとスマートフォンのどちらからでもご利用いただけます。') +
      qa('困ったときは相談できますか？', '平日10:00〜18:00、チャットとお電話で承っています。') +
      '</div>',
  }),
}
