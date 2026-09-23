/**
 * 新しい見本「途中のひと押し（細い帯）」（2026-09-23）。
 *
 * LPの途中に挟む短いCTA。上下の区画を切らないよう、淡い地の帯1本ぶんに収める
 * （申し込みボタンの見本より背が低く、文章の流れを止めない）。
 */
import { ARROW_RIGHT_LABEL, INK, INK_SUB, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-band0001'
const ACCENT = '#E5573F'
const s = `.${UID}`

const CSS =
  `${s}{padding:20px 16px}` +
  `${s} .b-band{display:flex;align-items:center;gap:18px;max-width:620px;margin:0 auto;padding:18px 20px;` +
  `border-radius:14px;background:#FDF3F1}` +
  `${s} .b-body{flex:1;min-width:0}` +
  `${s} .b-head{font-size:16px;font-weight:800;line-height:1.6;color:${INK};margin:0 0 3px}` +
  `${s} .b-sub{font-size:13px;line-height:1.7;color:${INK_SUB}}` +
  `${s} .b-btn{flex:0 0 auto;display:flex;align-items:center;justify-content:center;gap:8px;min-height:52px;` +
  `padding:13px 22px;border-radius:10px;background:${ACCENT};color:#FFFFFF;font:800 15.5px/1.4 inherit;` +
  `text-decoration:none;box-shadow:0 3px 0 #B83A26;transition:transform .12s ease,box-shadow .12s ease}` +
  `${s} .b-btn:active{transform:translateY(2px);box-shadow:0 1px 0 #B83A26}` +
  `${s} .b-btn:focus-visible{outline:3px solid #B83A26;outline-offset:3px}` +
  `${s} .b-btn svg{flex:0 0 16px;width:16px;height:16px}` +
  `@media (max-width:560px){${s} .b-band{flex-direction:column;align-items:stretch;gap:14px;text-align:center}` +
  `${s} .b-btn{width:100%}}` +
  `@media (prefers-reduced-motion:reduce){${s} .b-btn{transition:none}}`

export const MID_CTA_BAND_SAMPLE: NewSample = {
  id: 'mid-cta-band',
  category: '申し込み・CTA',
  name: '途中のひと押し（細い帯）',
  summary: 'LPの途中に挟む短いCTA。背が低いので、読んでいる流れを止めません',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      '<div class="b-band"><div class="b-body">' +
      '<p class="b-head">いまなら初回半額でためせます</p>' +
      '<p class="b-sub">入力は1分。解約はいつでもできます。</p>' +
      '</div>' +
      `<a class="b-btn" href="ooooo"><span>くわしく見る</span>${ARROW_RIGHT_LABEL}</a></div>`,
  }),
}
