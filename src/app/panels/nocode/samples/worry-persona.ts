/**
 * 新しい見本「向いている人・向いていない人」（2026-09-23）。
 *
 * 合う方・合わない方を先に伝えて、読む人が自分で決められるようにする区画。
 * 2列（PC）と縦積み（狭い画面）。囲みは作らず、間の細い縦線と見出しの下線だけで分ける。
 * 印は向いている方が kit のチェック、向いていない方は記号の「×」1文字。
 */
import { CHECK, INK_SUB, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-a0000010'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .j-cols{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));max-width:680px;margin:0 auto}` +
  `${s} .j-col{min-width:0;padding-right:24px}` +
  `${s} .j-col + .j-col{padding-right:0;padding-left:24px;border-left:1px solid ${LINE_LIGHT}}` +
  `${s} .j-head{font-size:15.5px;font-weight:800;line-height:1.6;margin:0 0 14px;padding:0 0 10px;` +
  `border-bottom:2px solid ${LINE_LIGHT}}` +
  `${s} .j-col--yes .j-head{color:${ACCENT};border-bottom-color:${ACCENT}}` +
  `${s} .j-item{display:flex;gap:10px;padding:7px 0;font-size:14.5px;line-height:1.8}` +
  `${s} .j-item svg{flex:0 0 17px;width:17px;height:17px;margin-top:5px;color:${ACCENT}}` +
  `${s} .j-x{flex:0 0 17px;text-align:center;font-size:16px;font-weight:800;line-height:1.8;color:#9AA3AE}` +
  `${s} .j-col--no .j-item{color:${INK_SUB}}` +
  `${s} .j-note{max-width:680px;margin:24px auto 0;font-size:13px;line-height:1.85;color:${INK_SUB};` +
  `text-align:center}` +
  `@media (max-width:560px){${s} .j-cols{grid-template-columns:minmax(0,1fr)}` +
  `${s} .j-col{padding-right:0}` +
  `${s} .j-col + .j-col{padding-left:0;border-left:0;margin-top:26px}}`

const yes = (text: string): string => `<li class="j-item">${CHECK}<span>${text}</span></li>`
const no = (text: string): string =>
  `<li class="j-item"><span class="j-x" aria-hidden="true">×</span><span>${text}</span></li>`

export const WORRY_PERSONA_SAMPLE: NewSample = {
  id: 'worry-persona',
  category: '悩み・共感',
  name: '向いている人・向いていない人',
  summary: '合う方・合わない方を2列で。読む人が自分で決められるようにします',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('こんな方に向いています', '無理におすすめはしません。合うかどうかを先にご確認ください。') +
      '<div class="j-cols">' +
      '<div class="j-col j-col--yes"><h3 class="j-head">向いている方</h3><ul>' +
      yes('従業員30名までの会社で、経理のご担当が1〜2名の方') +
      yes('請求書を毎月30件以上つくっている方') +
      yes('表計算ソフトでの管理に、限界を感じている方') +
      '</ul></div>' +
      '<div class="j-col j-col--no"><h3 class="j-head">向いていない方</h3><ul>' +
      no('請求が年に数件だけの方') +
      no('独自の基幹システムと必ずつなぐ必要がある方') +
      no('紙の帳簿のまま、運用を変えたくない方') +
      '</ul></div>' +
      '</div>' +
      '<p class="j-note">迷われたときは、無料のご相談窓口でお話をうかがいます。費用はかかりません。</p>',
  }),
}
