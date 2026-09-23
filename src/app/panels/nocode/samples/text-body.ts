/**
 * 新しい見本「本文（見出し＋3段落）」（2026-09-23）。
 *
 * どこにでも挟めるふつうの文章ブロック。読む向きをそろえるため見出しも左に寄せ、
 * 大きさだけ headCss でほかの見本と合わせる。色は足さず、行間と余白だけで読ませる。
 */
import { INK, INK_SUB, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-h0000002'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .b-wrap{max-width:620px;margin:0 auto}` +
  `${s} .b-wrap .nsx-title{text-align:left;margin:0 0 16px}` +
  `${s} .b-text{font-size:15px;line-height:1.95;color:${INK_SUB}}` +
  `${s} .b-text+.b-text{margin-top:16px}` +
  `${s} .b-text b{color:${INK};font-weight:800}` +
  `@media (max-width:480px){${s} .b-wrap .nsx-title{margin-bottom:14px}` +
  `${s} .b-text{font-size:14.5px}}`

export const TEXT_BODY_SAMPLE: NewSample = {
  id: 'text-body',
  category: '文章・区切り',
  name: '本文（見出し＋3段落）',
  summary: '見出し1つと段落3つのふつうの文章。説明を足したいときに使います',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      '<div class="b-wrap">' +
      head('続けやすさを、いちばんに考えました') +
      '<p class="b-text">新しいことを始めるとき、壁になりやすいのは「覚えること」と「続けること」です。' +
      'そこで、説明を読まなくても分かる形にしました。</p>' +
      '<p class="b-text">ご用意いただくものはありません。' +
      '箱から出して、いつもの場所に置くだけで準備は終わります。' +
      '工具も、細かな設定も必要ありません。</p>' +
      '<p class="b-text">1日にかかる時間は<b>30秒ほど</b>です。' +
      '忙しい日は飛ばしていただいてかまいません。翌日からまた続けられます。</p>' +
      '</div>',
  }),
}
