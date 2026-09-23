/**
 * 新しい見本「最後のひと押し（フッター直前）」（2026-09-23）。
 *
 * ページの終わりで、もう一度だけ背中を押す区画。濃い地に白文字で、
 * ここから下は会社情報だけ、と分かるようにする。
 */
import { ARROW_RIGHT_LABEL, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-i0000004'
const ACCENT = '#E5573F'
const s = `.${UID}`

const CSS =
  `${s}{padding:34px 16px;background:#1F2A37;color:#FFFFFF;text-align:center}` +
  `${s} .fe-title{font-size:21px;font-weight:800;line-height:1.55;margin:0 0 8px;color:#FFFFFF}` +
  `${s} .fe-lead{font-size:14px;line-height:1.85;color:#C6CDD6;margin:0 0 22px}` +
  `${s} .fe-btn{display:flex;width:100%;max-width:460px;margin:0 auto;align-items:center;justify-content:center;` +
  `gap:10px;min-height:62px;padding:16px 24px;border-radius:12px;background:${ACCENT};color:#FFFFFF;` +
  `font:800 18px/1.4 inherit;text-decoration:none;box-shadow:0 4px 0 #B83A26;` +
  `transition:transform .14s ease,box-shadow .14s ease}` +
  `${s} .fe-btn:active{transform:translateY(3px);box-shadow:0 1px 0 #B83A26}` +
  `${s} .fe-btn:focus-visible{outline:3px solid #FFFFFF;outline-offset:3px}` +
  `${s} .fe-btn svg{flex:0 0 18px;width:18px;height:18px}` +
  `${s} .fe-note{margin:14px 0 0;font-size:12.5px;line-height:1.7;color:#A8B1BC}` +
  `@media (max-width:480px){${s} .fe-title{font-size:19px}${s} .fe-btn{font-size:16.5px}}` +
  `@media (prefers-reduced-motion:reduce){${s} .fe-btn{transition:none}}`

export const FOOTER_CTA_SAMPLE: NewSample = {
  id: 'footer-cta',
  category: 'フッター・注意書き',
  name: '最後のひと押し（濃い地）',
  summary: 'ページの終わりでもう一度。濃い地に白文字で、ここで終わりだと分かる形',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      '<h2 class="fe-title">迷っているなら、まず1か月だけ</h2>' +
      '<p class="fe-lead">合わなければ30日以内に返品できます。解約の手続きも1分で終わります。</p>' +
      `<a class="fe-btn" href="ooooo"><span>無料ではじめる</span>${ARROW_RIGHT_LABEL}</a>` +
      '<p class="fe-note">入力は1分。クレジットカードの登録は後からでもできます。</p>',
  }),
}
