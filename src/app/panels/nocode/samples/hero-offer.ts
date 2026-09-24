/**
 * 新しい見本「ファーストビュー（見出し＋ボタン＋画像）」（2026-09-23）。
 *
 * LPのいちばん上。言い切りの見出し → ひとこと補足 → ボタン → 信頼の一行 → 画像 の順。
 * 画像は仮の絵。入れた人が「画像を変える」で差し替える。
 */
import { ARROW_RIGHT_LABEL, IMAGE_PLACEHOLDER, INK_SUB, LINE_LIGHT, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-hero0001'
const ACCENT = '#E5573F'
const ACCENT_EDGE = '#B83A26'
const s = `.${UID}`

const CSS =
  `${s}{padding:36px 16px 32px;text-align:center}` +
  `${s} .h-tag{display:inline-block;margin:0 0 14px;padding:5px 12px;border-radius:999px;` +
  `background:#FDECE8;color:${ACCENT};font-size:12.5px;font-weight:800;letter-spacing:.04em}` +
  `${s} .h-title{font-size:30px;font-weight:800;line-height:1.35;margin:0 0 12px;letter-spacing:-.01em}` +
  `${s} .h-title em{font-style:normal;color:${ACCENT}}` +
  `${s} .h-lead{font-size:15px;line-height:1.9;color:${INK_SUB};margin:0 0 24px}` +
  `${s} .h-btn{display:flex;width:100%;max-width:460px;margin:0 auto;align-items:center;justify-content:center;` +
  `gap:10px;min-height:64px;padding:16px 24px;border-radius:12px;background:${ACCENT};color:#FFFFFF;` +
  `font-weight:800;font-size:18px;line-height:1.4;font-family:inherit;text-decoration:none;box-shadow:0 5px 0 ${ACCENT_EDGE};` +
  `transition:transform .14s ease,box-shadow .14s ease}` +
  `${s} .h-btn:active{transform:translateY(4px);box-shadow:0 1px 0 ${ACCENT_EDGE}}` +
  `${s} .h-btn:focus-visible{outline:3px solid ${ACCENT_EDGE};outline-offset:4px}` +
  `${s} .h-btn svg{flex:0 0 19px;width:19px;height:19px}` +
  `${s} .h-trust{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px 18px;` +
  `margin:14px 0 24px;font-size:12.5px;line-height:1.7;color:${INK_SUB}}` +
  `${s} .h-trust b{color:#1F2A37;font-size:14px;font-weight:800;font-variant-numeric:tabular-nums}` +
  `${s} .h-visual{margin:0;border-top:1px solid ${LINE_LIGHT};padding-top:24px}` +
  `${s} .h-visual img{width:100%;border-radius:12px}` +
  `${s} .h-cap{margin:8px 0 0;font-size:12px;line-height:1.7;color:${INK_SUB}}` +
  `@media (max-width:480px){${s} .h-title{font-size:25px}${s} .h-lead{font-size:14px}}` +
  `@media (prefers-reduced-motion:reduce){${s} .h-btn{transition:none}}`

export const HERO_OFFER_SAMPLE: NewSample = {
  id: 'hero-offer',
  category: '冒頭・つかみ',
  name: 'ファーストビュー（見出し＋ボタン＋画像）',
  summary: 'LPのいちばん上。言い切りの見出し・ボタン・信頼の一行・画像がひとそろい',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      '<p class="h-tag">はじめての方へ</p>' +
      '<h1 class="h-title">毎日の「時間がない」を、<em>30秒</em>で終わらせる</h1>' +
      '<p class="h-lead">面倒な準備はいりません。届いたその日から、いつもの生活のまま続けられます。</p>' +
      `<a class="h-btn" href="ooooo"><span>無料ではじめる</span>${ARROW_RIGHT_LABEL}</a>` +
      '<p class="h-trust"><span>利用者の評価 <b>4.8</b>／5</span><span>導入 <b>1,200</b>社</span><span>解約はいつでも</span></p>' +
      `<figure class="h-visual"><img src="${IMAGE_PLACEHOLDER}" alt="商品の写真">` +
      '<figcaption class="h-cap">※写真はイメージです</figcaption></figure>',
  }),
}
