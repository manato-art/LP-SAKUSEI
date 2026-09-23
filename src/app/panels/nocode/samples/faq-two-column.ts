/**
 * 新しい見本「よくある質問（2列・6問）」（2026-09-23）。
 *
 * 答えが1〜2行で済む質問を6つ。PCは2列にして縦の長さを半分にし、狭い画面では1列に落とす。
 * 押して開く形にしない（短い答えなので、閉じておくより全部見えている方が早く読める）。
 * 箱で囲まず、横に通る細い線だけで区切る。
 */
import { INK, INK_SUB, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-f0000001'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .d-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 44px;` +
  `max-width:760px;margin:0 auto;border-bottom:1px solid ${LINE_LIGHT}}` +
  `${s} .d-item{min-width:0;padding:15px 0 16px;border-top:1px solid ${LINE_LIGHT}}` +
  `${s} .d-q{display:flex;align-items:flex-start;gap:9px;font-size:15.5px;font-weight:800;` +
  `line-height:1.7;color:${INK}}` +
  `${s} .d-q::before{content:"Q";flex:0 0 auto;color:${ACCENT};font-size:14.5px;font-weight:800}` +
  `${s} .d-a{margin:5px 0 0;padding-left:20px;font-size:14px;line-height:1.9;color:${INK_SUB}}` +
  `@media (max-width:560px){${s} .d-grid{grid-template-columns:minmax(0,1fr);gap:0}` +
  `${s} .d-q{font-size:14.5px}${s} .d-a{font-size:13.5px;padding-left:19px}}`

const qa = (question: string, answer: string): string =>
  `<div class="d-item"><p class="d-q"><span>${question}</span></p><p class="d-a">${answer}</p></div>`

export const FAQ_TWO_COLUMN_SAMPLE: NewSample = {
  id: 'faq-two-column',
  category: 'よくある質問',
  name: 'よくある質問（2列・6問）',
  summary: 'PCは2列、スマホは1列。短い問答を6つ並べます。開閉はありません',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('よくあるご質問', 'お申し込みの前によくいただくご質問をまとめました。') +
      '<div class="d-grid">' +
      qa('申し込みにはどれくらいかかりますか？', '入力は3分ほどで終わります。お支払い方法は後から登録することもできます。') +
      qa('支払い方法を教えてください。', 'クレジットカード・口座振替・コンビニ払いからお選びいただけます。') +
      qa('途中で内容を変更できますか？', 'マイページからいつでも変更できます。変更の手数料はいただきません。') +
      qa('領収書は発行できますか？', 'マイページからPDFで発行できます。宛名と但し書きの指定もできます。') +
      qa('家族と一緒に使えますか？', '1つのご契約で3名まで登録できます。追加の費用はかかりません。') +
      qa('解約に費用はかかりますか？', '解約金はいただきません。次のお支払い日の前日まで手続きできます。') +
      '</div>',
  }),
}
