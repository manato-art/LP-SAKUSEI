/**
 * 新しい見本「フォームの前の一言」（2026-09-23）。
 *
 * 入力フォームの直前に置いて、「何を・どれだけ・いくらで」書くのかを先に見せる区画。
 * 3つの点は箱にせず、細い縦線で区切って1行に並べる（狭い画面では縦積み＋横線に変わる）。
 */
import { ARROW_RIGHT_LABEL, INK, INK_SUB, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-e0000008'
const ACCENT = '#1F7AE0'
const ACCENT_EDGE = '#14549B'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .v-points{display:flex;max-width:620px;margin:0 auto}` +
  `${s} .v-point{flex:1 1 0;min-width:0;padding:0 14px;text-align:center}` +
  `${s} .v-point+.v-point{border-left:1px solid ${LINE_LIGHT}}` +
  `${s} .v-key{font-size:15.5px;font-weight:800;line-height:1.5;color:${ACCENT};margin:0 0 4px}` +
  `${s} .v-key b{font-size:22px;font-weight:800;line-height:1.2;font-variant-numeric:tabular-nums;` +
  `letter-spacing:-.01em}` +
  `${s} .v-text{font-size:12.5px;line-height:1.75;color:${INK_SUB}}` +
  `${s} .v-btn{display:flex;width:100%;max-width:480px;margin:24px auto 0;align-items:center;justify-content:center;` +
  `gap:10px;min-height:62px;padding:16px 22px;border-radius:12px;background:${ACCENT};color:#FFFFFF;` +
  `font-weight:800;font-size:18px;line-height:1.4;font-family:inherit;text-decoration:none;text-shadow:0 1px 2px rgba(0,0,0,.2);` +
  `box-shadow:0 5px 0 ${ACCENT_EDGE},0 12px 20px rgba(0,0,0,.12);` +
  `transition:transform .14s ease,box-shadow .14s ease;-webkit-tap-highlight-color:transparent}` +
  `${s} .v-btn:active{transform:translateY(4px);box-shadow:0 1px 0 ${ACCENT_EDGE},0 5px 10px rgba(0,0,0,.1)}` +
  `${s} .v-btn:focus-visible{outline:3px solid ${ACCENT_EDGE};outline-offset:4px}` +
  `${s} .v-btn svg{flex:0 0 19px;width:19px;height:19px}` +
  `${s} .v-after{max-width:480px;margin:12px auto 0;font-size:13px;line-height:1.8;color:${INK};text-align:center}` +
  `${s} .v-note{max-width:480px;margin:8px auto 0;font-size:12px;line-height:1.8;color:${INK_SUB};text-align:center}` +
  `@media (max-width:560px){${s} .v-points{flex-direction:column;max-width:340px}` +
  `${s} .v-point{padding:12px 0}${s} .v-point+.v-point{border-left:0;border-top:1px solid ${LINE_LIGHT}}` +
  `${s} .v-btn{font-size:16.5px;min-height:58px}}` +
  `@media (prefers-reduced-motion:reduce){${s} .v-btn{transition:none}}`

const point = (key: string, text: string): string =>
  `<div class="v-point"><p class="v-key">${key}</p><p class="v-text">${text}</p></div>`

export const CTA_FORM_LEAD_SAMPLE: NewSample = {
  id: 'cta-form-lead',
  category: '申し込み・CTA',
  name: 'フォームの前の一言（入力は軽い）',
  summary: '入力の項目数・かかる時間・費用を先に見せてから、フォームへ送ります',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('入力はこれだけです', '書く項目が少ないので、途中でやめずに終えられます。') +
      '<div class="v-points">' +
      point('<b>3</b>項目だけ', 'お名前・メールアドレス・お住まいの都道府県をご記入ください。') +
      point('<b>30</b>秒ほど', '途中で保存する必要はありません。そのまま送信できます。') +
      point('費用は<b>0</b>円', 'ご相談と見積りは無料です。あとから請求することはありません。') +
      '</div>' +
      `<a class="v-btn" href="ooooo"><span>入力フォームへ進む</span>${ARROW_RIGHT_LABEL}</a>` +
      '<p class="v-after">送信後、2営業日以内に担当者よりメールでご連絡します。</p>' +
      '<p class="v-note">※ご入力いただいた内容は、ご連絡と見積りのためだけに使います。※2026年3月時点の対応です。</p>',
  }),
}
