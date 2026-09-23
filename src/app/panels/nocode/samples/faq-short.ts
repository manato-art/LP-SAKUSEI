/**
 * 新しい見本「短いQ&A（3問）」（2026-09-23）。
 *
 * 1画面に収まる短い形。LPの途中に挟んで、読みながらの引っかかりをその場で外すための区画。
 * 区切り線も箱も使わず、余白と「Q」の印だけで問いと答えを分ける（背を低く保つ）。
 */
import { INK, INK_SUB, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-f0000003'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s}{padding:26px 16px}` +
  `${s} .nsx-lead{margin-bottom:20px}` +
  `${s} .h-list{max-width:520px;margin:0 auto}` +
  `${s} .h-item{margin:0 0 20px}` +
  `${s} .h-item:last-child{margin-bottom:0}` +
  `${s} .h-q{display:flex;align-items:flex-start;gap:9px;font-size:16px;font-weight:800;` +
  `line-height:1.65;color:${INK}}` +
  `${s} .h-q::before{content:"Q";flex:0 0 auto;margin-top:3px;padding:2px 7px;border-radius:4px;` +
  `background:#EDF3FC;color:${ACCENT};font-size:12.5px;font-weight:800;line-height:1.5}` +
  `${s} .h-a{margin:6px 0 0;padding-left:34px;font-size:14.5px;line-height:1.9;color:${INK_SUB}}` +
  `@media (max-width:480px){${s} .h-q{font-size:15px}${s} .h-a{font-size:13.5px;padding-left:31px}}`

const qa = (question: string, answer: string): string =>
  `<div class="h-item"><p class="h-q"><span>${question}</span></p><p class="h-a">${answer}</p></div>`

export const FAQ_SHORT_SAMPLE: NewSample = {
  id: 'faq-short',
  category: 'よくある質問',
  name: '短いQ&A（3問）',
  summary: '3問だけの短い形。ページの途中にそっと挟めます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('はじめての方からのご質問') +
      '<div class="h-list">' +
      qa('初めてでも使えますか？', '説明書のとおりに進めるだけです。最初の設定は3分ほどで終わります。') +
      qa('途中でやめられますか？', 'マイページからいつでも解約できます。解約金はいただきません。') +
      qa('相談できる窓口はありますか？', '平日10:00〜18:00、チャットとお電話で承っています。') +
      '</div>',
  }),
}
