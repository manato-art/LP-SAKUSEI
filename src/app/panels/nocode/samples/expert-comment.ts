/**
 * 新しい見本「専門家のコメント」（2026-09-23）。
 *
 * 丸い仮画像・お名前・肩書きを上に置き、その下にコメントを3段落で読ませる区画。
 * 言い切りにならないよう、最後は「合う・合わないがある」という一文と注記で締める。
 */
import { INK, INK_SUB, IMAGE_PLACEHOLDER, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-d0000006'
const ACCENT = '#1F6F5C'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .x-wrap{max-width:560px;margin:0 auto}` +
  `${s} .x-who{display:flex;align-items:center;gap:16px;padding-bottom:18px;border-bottom:1px solid ${LINE_LIGHT}}` +
  `${s} .x-face{flex:none;width:76px;height:76px;border-radius:50%;object-fit:cover;background:#F1F3F5}` +
  `${s} .x-meta{min-width:0}` +
  `${s} .x-name{font-size:16.5px;font-weight:800;line-height:1.6;color:${INK}}` +
  `${s} .x-role{margin-top:4px;font-size:12.5px;font-weight:700;line-height:1.7;color:${ACCENT}}` +
  `${s} .x-comment{margin:20px 0 0}` +
  `${s} .x-comment p{font-size:14.5px;line-height:1.95;color:${INK}}` +
  `${s} .x-comment p+p{margin-top:12px}` +
  `${s} .x-note{margin:18px 0 0;font-size:12px;line-height:1.75;color:${INK_SUB}}` +
  `@media (max-width:480px){${s} .x-who{gap:13px}${s} .x-face{width:64px;height:64px}` +
  `${s} .x-name{font-size:15.5px}${s} .x-comment p{font-size:14px}}`

export const EXPERT_COMMENT_SAMPLE: NewSample = {
  id: 'expert-comment',
  category: '信頼・実績',
  name: '専門家のコメント',
  summary: '丸い写真・肩書き・コメント3段落。最後に注記を添えます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('専門家の方に、お話をうかがいました') +
      '<div class="x-wrap">' +
      `<div class="x-who"><img class="x-face" src="${IMAGE_PLACEHOLDER}" alt="サンプル 太郎さんのお写真">` +
      '<div class="x-meta"><p class="x-name">サンプル 太郎</p>' +
      '<p class="x-role">サンプル総合研究所 主任研究員／この分野の調査に12年</p></div></div>' +
      '<blockquote class="x-comment">' +
      '<p>毎日つづけるための工夫を、使う人ではなく道具の側に持たせている点が特徴だと感じます。</p>' +
      '<p>1日あたりの手間が30秒ほどに収まるため、仕事が立て込む時期でも、生活の流れを大きく変えずに取り入れられます。' +
      '2026年の調査では、3か月後も続けていた方が10名中7名でした。</p>' +
      '<p>ただし、合う・合わないは人によって異なります。気になることがあるときは、自己判断せず、専門の窓口にご相談ください。</p>' +
      '</blockquote>' +
      '<p class="x-note">※個人の見解であり、効果や成果を保証するものではありません。' +
      '※調査は2026年2月・当社によるもので、対象は120名です。</p>' +
      '</div>',
  }),
}
