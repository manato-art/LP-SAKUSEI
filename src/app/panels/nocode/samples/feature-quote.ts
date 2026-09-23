/**
 * 新しい見本「強みを一言で（大きな引用）」（2026-09-23）。
 *
 * 特徴を並べる代わりに、使っている方の言葉を1文だけ大きく置く区画。
 * 鍵括弧は文字ではなくCSSの疑似要素で置き、読み上げには本文だけが残るようにする。
 */
import { INK_SUB, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-b0000009'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s}{padding:48px 16px}` +
  `${s} .qt-block{position:relative;max-width:640px;margin:0 auto;padding:20px 34px 26px}` +
  `${s} .qt-block::before,${s} .qt-block::after{position:absolute;font-size:52px;font-weight:800;` +
  `line-height:1;color:#CFE1F7}` +
  `${s} .qt-block::before{content:"「";left:0;top:0}` +
  `${s} .qt-block::after{content:"」";right:0;bottom:0}` +
  `${s} .qt-text{font-size:23px;font-weight:800;line-height:1.85;letter-spacing:-.01em;text-align:center;` +
  `text-wrap:balance;word-break:auto-phrase}` +
  `${s} .qt-mark{color:${ACCENT}}` +
  `${s} .qt-src{max-width:640px;margin:18px auto 0;font-size:12.5px;line-height:1.75;` +
  `color:${INK_SUB};text-align:center}` +
  `@media (max-width:480px){${s}{padding:36px 16px}${s} .qt-block{padding:16px 24px 22px}` +
  `${s} .qt-block::before,${s} .qt-block::after{font-size:40px}${s} .qt-text{font-size:19px}}`

export const FEATURE_QUOTE_SAMPLE: NewSample = {
  id: 'feature-quote',
  category: '特徴・価値',
  name: '強みを一言で（大きな引用）',
  summary: 'お客さまの一文を大きな鍵括弧で見せ、下に出典を一行だけ添えます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('強みを、ひとことで') +
      '<blockquote class="qt-block"><p class="qt-text">覚え直す時間がいらないので、' +
      '<span class="qt-mark">引き継ぎが1日で終わりました。</span></p></blockquote>' +
      '<p class="qt-src">株式会社サンプル 総務部の方（40代・導入から1年）／※個人の感想です</p>',
  }),
}
