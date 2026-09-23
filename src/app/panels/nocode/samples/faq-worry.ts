/**
 * 新しい見本「不安に答えるQ&A（返品・解約）」（2026-09-23）。
 *
 * 買う前にいちばん気になる4つ（返品・解約・解約金・自動更新）だけに絞った区画。
 * 左に不安、右に答えを置き、答えは言い切りの短い一文にする（読む人は答えだけを横に追える）。
 * 箱で囲まず、横に通る細い線だけで区切る。狭い画面では上下に積む。
 */
import { INK, INK_SUB, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-f0000005'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .r-list{max-width:660px;margin:0 auto;border-top:1px solid ${LINE_LIGHT}}` +
  `${s} .r-item{display:flex;align-items:flex-start;gap:20px;padding:16px 2px;` +
  `border-bottom:1px solid ${LINE_LIGHT}}` +
  `${s} .r-q{flex:0 0 38%;min-width:0;font-size:14px;line-height:1.8;color:${INK_SUB}}` +
  `${s} .r-a{flex:1;min-width:0;font-size:15.5px;font-weight:800;line-height:1.8;color:${INK}}` +
  `${s} .r-a em{font-style:normal;color:${ACCENT}}` +
  `${s} .r-note{max-width:660px;margin:18px auto 0;font-size:12px;line-height:1.85;color:${INK_SUB}}` +
  `@media (max-width:560px){${s} .r-item{flex-direction:column;gap:5px;padding:14px 2px}` +
  `${s} .r-q{flex:none;width:100%;font-size:13px}${s} .r-a{font-size:15px}}`

const qa = (worry: string, lead: string, rest: string): string =>
  `<div class="r-item"><p class="r-q">${worry}</p>` +
  `<p class="r-a"><em>${lead}</em>${rest}</p></div>`

export const FAQ_WORRY_SAMPLE: NewSample = {
  id: 'faq-worry',
  category: 'よくある質問',
  name: '不安に答えるQ&A（返品・解約）',
  summary: '返品・解約・支払いなど、買う前の不安に絞った4問です',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('買う前の不安にお答えします', 'よくいただく4つのご心配ごとを、先にお伝えしておきます。') +
      '<div class="r-list">' +
      qa('合わなかったら返品できますか？', '30日以内なら返品できます。', '返送にかかる送料も当社が負担します。') +
      qa('解約の手続きは面倒ではありませんか？', 'マイページから1分で終わります。', 'お電話や書面のやり取りは必要ありません。') +
      qa('解約金はかかりますか？', '解約金はいただきません。', '次のお支払い日の前日まで受け付けています。') +
      qa('気づかないうちに更新されませんか？', '更新の7日前にメールでお知らせします。', '止めたいときは、そのまま解約の手続きへ進めます。') +
      '</div>' +
      '<p class="r-note">※返品・解約の条件は、お申し込みの内容によって異なる場合があります。' +
      'くわしくは特定商取引法に基づく表記をご確認ください。</p>',
  }),
}
