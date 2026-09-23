/**
 * 新しい見本「引用（大きな鍵括弧）」（2026-09-23）。
 *
 * お客様の言葉や社内の方針を1つだけ引くときの区画。鍵括弧はCSSの疑似要素で薄く大きく出し、
 * 文字そのものは読みやすい大きさに保つ。出典は下に1行だけ添える。
 */
import { INK_SUB, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-h0000003'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  `${s}{padding:32px 16px}` +
  `${s} .q-wrap{position:relative;max-width:560px;margin:0 auto;padding:0 28px}` +
  `${s} .q-wrap::before,${s} .q-wrap::after{position:absolute;font-size:32px;font-weight:800;` +
  `line-height:1;color:${ACCENT};opacity:.32}` +
  `${s} .q-wrap::before{content:'「';left:0;top:-4px}` +
  `${s} .q-wrap::after{content:'」';right:0;bottom:-4px}` +
  `${s} .q-text{font-size:16.5px;font-weight:700;line-height:1.95;text-align:center}` +
  `${s} .q-from{max-width:560px;margin:14px auto 0;font-size:12.5px;line-height:1.8;` +
  `text-align:center;color:${INK_SUB}}` +
  `@media (max-width:480px){${s} .q-wrap{padding:0 22px}` +
  `${s} .q-text{font-size:15px;text-align:left}${s} .q-from{text-align:left;padding:0 22px}}`

export const TEXT_QUOTE_SAMPLE: NewSample = {
  id: 'text-quote',
  category: '文章・区切り',
  name: '引用（大きな鍵括弧）',
  summary: '引用文を1つだけ大きく。下に出典の一行を添えられます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      '<div class="q-wrap"><p class="q-text">使い方を覚える必要がなかったので、' +
      'はじめた日からそのまま続けられています。</p></div>' +
      '<p class="q-from">ご利用中のお客様の声より（40代・男性）</p>',
  }),
}
