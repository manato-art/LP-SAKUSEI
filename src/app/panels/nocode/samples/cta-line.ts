/**
 * 新しい見本「LINEで受け取る」（2026-09-23）。
 *
 * メールアドレスを書かせずに、LINEの友だち追加で受け取ってもらうときのボタン。
 * ロゴの画像は使わず（外から画像を読み込まない決まり）、色（#06C755）と文字だけで示す。
 * 押したあと何が起きるのかを短く書き、注意書きを下にまとめた。
 */
import { ARROW_RIGHT_LABEL, INK, INK_SUB, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-e0000006'
const ACCENT = '#06C755'
const ACCENT_EDGE = '#04913E'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .g-body{max-width:520px;margin:0 auto;text-align:center}` +
  // ロゴの代わりの文字の印
  `${s} .g-tag{display:inline-block;margin:0 0 16px;padding:5px 14px;border-radius:8px;` +
  `border:1.5px solid ${ACCENT};color:${ACCENT};font-size:12.5px;font-weight:800;letter-spacing:.06em}` +
  `${s} .g-btn{display:flex;align-items:center;justify-content:center;gap:10px;min-height:64px;padding:17px 22px;` +
  `border-radius:12px;background:${ACCENT};color:#FFFFFF;font-weight:800;font-size:18px;line-height:1.4;font-family:inherit;text-decoration:none;` +
  `text-shadow:0 1px 2px rgba(0,0,0,.25);box-shadow:0 5px 0 ${ACCENT_EDGE},0 12px 20px rgba(0,0,0,.12);` +
  `transition:transform .14s ease,box-shadow .14s ease;-webkit-tap-highlight-color:transparent}` +
  `${s} .g-btn:active{transform:translateY(4px);box-shadow:0 1px 0 ${ACCENT_EDGE},0 5px 10px rgba(0,0,0,.1)}` +
  `${s} .g-btn:focus-visible{outline:3px solid ${ACCENT_EDGE};outline-offset:4px}` +
  `${s} .g-btn svg{flex:0 0 19px;width:19px;height:19px}` +
  `${s} .g-how{margin:14px 0 0;font-size:13.5px;line-height:1.85;color:${INK};text-align:left}` +
  `${s} .g-strong{font-weight:800;color:${ACCENT}}` +
  `${s} .g-notes{margin:18px 0 0;padding-top:14px;border-top:1px solid ${LINE_LIGHT};text-align:left}` +
  `${s} .g-notes li{position:relative;padding:3px 0 3px 15px;font-size:12.5px;line-height:1.8;color:${INK_SUB}}` +
  `${s} .g-notes li::before{content:"";position:absolute;left:0;top:14px;width:8px;height:1.5px;background:#B6C0CB}` +
  `@media (max-width:480px){${s} .g-btn{font-size:16.5px;min-height:60px}${s} .g-how{font-size:13px}}` +
  `@media (prefers-reduced-motion:reduce){${s} .g-btn{transition:none}}`

const note = (text: string): string => `<li>${text}</li>`

export const CTA_LINE_SAMPLE: NewSample = {
  id: 'cta-line',
  category: '申し込み・CTA',
  name: 'LINEで受け取る（友だち追加）',
  summary: 'メールアドレスを書かずに受け取れます。追加の手順と注意書きつき',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('LINEで受け取る', '毎週1回、季節の献立と使い方のヒントをお届けします。') +
      '<div class="g-body">' +
      '<span class="g-tag">LINE公式アカウント</span>' +
      `<a class="g-btn" href="ooooo"><span>友だち追加して受け取る</span>${ARROW_RIGHT_LABEL}</a>` +
      '<p class="g-how">ボタンを押すとLINEが開きます。表示された画面で<span class="g-strong">「追加」</span>' +
      'を押すと登録が終わり、その日のうちに最初のメッセージが届きます。かかる時間は10秒ほどです。</p>' +
      '<ul class="g-notes">' +
      note('受け取りは無料です（通信料はお客さまのご負担となります）。') +
      note('メールアドレスや電話番号をお伝えいただく必要はありません。') +
      note('配信はいつでも止められます。止め方は最初のメッセージでご案内します。') +
      note('ご利用にはLINEアプリが必要です。※2026年3月時点のご案内です。') +
      '</ul>' +
      '</div>',
  }),
}
