/**
 * 新しい見本「質問＋問い合わせ導線」（2026-09-23）。
 *
 * よくある質問だけでは解決しない人が、そのまま離れてしまわないようにする区画。
 * 3問のあとに「解決しないときは」の受け皿を置き、Widgetの下端まで淡い地を伸ばして区切る。
 * ボタンは申し込みボタンと同じ見た目にしない（線だけのボタン）。ここは購入でなく相談の行き先。
 */
import { ARROW_RIGHT_LABEL, INK, INK_SUB, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-f0000004'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .m-list{max-width:600px;margin:0 auto;border-top:1px solid ${LINE_LIGHT}}` +
  `${s} .m-item{padding:14px 2px;border-bottom:1px solid ${LINE_LIGHT}}` +
  `${s} .m-q{font-size:15px;font-weight:800;line-height:1.7;color:${INK}}` +
  `${s} .m-a{margin:4px 0 0;font-size:14px;line-height:1.9;color:${INK_SUB}}` +
  // 下端まで伸ばした淡い地（Widgetの左右の余白ぶんだけ外へ出す）
  `${s} .m-help{margin:28px -16px -32px;padding:26px 16px 28px;background:#F3F7FD;text-align:center}` +
  `${s} .m-help-head{font-size:16.5px;font-weight:800;line-height:1.6;margin:0 0 6px;color:${INK}}` +
  `${s} .m-help-text{max-width:460px;margin:0 auto 16px;font-size:13.5px;line-height:1.85;color:${INK_SUB}}` +
  `${s} .m-btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:52px;` +
  `padding:14px 26px;border:2px solid ${ACCENT};border-radius:10px;background:#FFFFFF;color:${ACCENT};` +
  `font-weight:800;font-size:15.5px;line-height:1.4;font-family:inherit;text-decoration:none;transition:background .14s ease}` +
  `${s} .m-btn:hover{background:#E9F1FC}` +
  `${s} .m-btn:focus-visible{outline:3px solid ${ACCENT};outline-offset:3px}` +
  `${s} .m-btn svg{flex:0 0 16px;width:16px;height:16px}` +
  `${s} .m-hours{margin:14px 0 0;font-size:12px;line-height:1.8;color:${INK_SUB}}` +
  `@media (max-width:480px){${s} .m-q{font-size:14.5px}${s} .m-a{font-size:13.5px}` +
  `${s} .m-btn{display:flex;width:100%;padding:14px 18px}}` +
  `@media (prefers-reduced-motion:reduce){${s} .m-btn{transition:none}}`

const qa = (question: string, answer: string): string =>
  `<div class="m-item"><p class="m-q">${question}</p><p class="m-a">${answer}</p></div>`

export const FAQ_CONTACT_SAMPLE: NewSample = {
  id: 'faq-contact',
  category: 'よくある質問',
  name: '質問＋問い合わせ導線',
  summary: '3問のあとに問い合わせ先を置き、解決しない方の行き先を作ります',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('よくあるご質問') +
      '<div class="m-list">' +
      qa('届くまでにどれくらいかかりますか？', 'ご注文の翌日から2〜4日でお届けします。お届け日と時間帯の指定もできます。') +
      qa('送料はかかりますか？', '全国どこでも送料無料です。離島の場合も追加の費用はいただきません。') +
      qa('注文した内容を変更できますか？', '発送の前日まで、マイページから変更できます。') +
      '</div>' +
      '<div class="m-help">' +
      '<p class="m-help-head">解決しないときは</p>' +
      '<p class="m-help-text">ここに載っていないご質問は、お問い合わせ窓口で承っています。' +
      'いただいた順に、担当者がひとつずつお返事します。</p>' +
      `<a class="m-btn" href="ooooo"><span>お問い合わせフォームへ</span>${ARROW_RIGHT_LABEL}</a>` +
      '<p class="m-hours">受付時間 平日10:00〜18:00（土日祝を除く）<br>' +
      'お返事までに1営業日ほどいただく場合があります。</p>' +
      '</div>',
  }),
}
