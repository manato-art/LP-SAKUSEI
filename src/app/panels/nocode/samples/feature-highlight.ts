/**
 * 新しい見本「いちばんの強みを1つ大きく」（2026-09-23）。
 *
 * 特徴を並べるのではなく、いちばん言いたいことを1つだけ大きく置く区画。
 * 余白を広めにとり、裏づけの数字を1つだけ細い線の下に添える（箱も枠も使わない）。
 */
import { INK_SUB, LINE_LIGHT, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-b0000003'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  `${s}{padding:56px 20px}` +
  `${s} .fh-wrap{max-width:600px;margin:0 auto;text-align:center}` +
  `${s} .fh-eyebrow{font-size:12px;font-weight:800;line-height:1.6;letter-spacing:.16em;color:${ACCENT};margin:0 0 18px}` +
  `${s} .fh-lead{font-size:27px;font-weight:800;line-height:1.6;letter-spacing:-.01em;margin:0 0 20px;` +
  `text-wrap:balance;word-break:auto-phrase}` +
  `${s} .fh-text{font-size:14.5px;line-height:1.9;color:${INK_SUB}}` +
  `${s} .fh-fact{display:flex;align-items:baseline;justify-content:center;gap:14px;` +
  `margin:32px auto 0;padding:24px 0 0;border-top:1px solid ${LINE_LIGHT};text-align:left}` +
  `${s} .fh-num{display:flex;align-items:baseline;gap:2px;font-size:46px;font-weight:800;line-height:1;` +
  `color:${ACCENT};font-variant-numeric:tabular-nums;letter-spacing:-.03em}` +
  `${s} .fh-unit{font-size:20px;font-weight:800;letter-spacing:normal}` +
  `${s} .fh-cap{max-width:15em;font-size:13px;line-height:1.7;color:${INK_SUB}}` +
  `${s} .fh-note{max-width:600px;margin:20px auto 0;font-size:12px;line-height:1.7;color:${INK_SUB};text-align:center}` +
  `@media (max-width:480px){${s}{padding:40px 16px}${s} .fh-lead{font-size:22px}` +
  `${s} .fh-num{font-size:38px}${s} .fh-fact{gap:12px}}`

export const FEATURE_HIGHLIGHT_SAMPLE: NewSample = {
  id: 'feature-highlight',
  category: '特徴・価値',
  name: 'いちばんの強みを1つ大きく',
  summary: '強みを一文で大きく見せ、裏づけの数字を1つだけ添えます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      '<div class="fh-wrap">' +
      '<p class="fh-eyebrow">いちばんの強み</p>' +
      '<h2 class="fh-lead">いちばんの強みは、むりなく続けられることです。</h2>' +
      '<p class="fh-text">1日5分・週3回から始められます。予定が合わない週は休んでも、' +
      'そのまま翌週から戻せます。やり方を覚え直す必要はありません。</p>' +
      '<p class="fh-fact"><span class="fh-num">91<span class="fh-unit">%</span></span>' +
      '<span class="fh-cap">3か月後も続けていると答えた方の割合です</span></p>' +
      '</div>' +
      '<p class="fh-note">※2026年3月・当社調べ（回答1,043件）。感じ方には個人差があります。</p>',
  }),
}
