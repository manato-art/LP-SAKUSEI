/**
 * 新しい見本「問いかけの見出し（共感型）」（2026-09-23）。
 *
 * 「〜していませんか？」と問いかけ、短い答えを返してから下へ送り出す冒頭。
 * 下向きの誘導は kit の山形（CHEVRON_RIGHT）を90度まわして使う（絵文字も画像も足さない）。
 * 答えだけを淡い面にのせ、そのほかは白地のままにする。
 */
import { CHEVRON_RIGHT, INK_SUB, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-a0000005'
const ACCENT = '#E5573F'
const s = `.${UID}`

const CSS =
  `${s}{padding:38px 16px 32px;text-align:center}` +
  `${s} .e-q{font-size:26px;font-weight:800;line-height:1.55;letter-spacing:-.01em;margin:0;text-wrap:balance}` +
  `${s} .e-q em{font-style:normal;color:${ACCENT}}` +
  `${s} .e-sub{max-width:560px;margin:14px auto 0;font-size:14.5px;line-height:1.95;color:${INK_SUB}}` +
  `${s} .e-down{display:block;width:26px;height:26px;margin:20px auto 16px;color:${ACCENT};` +
  `transform:rotate(90deg)}` +
  `${s} .e-down svg{width:100%;height:100%}` +
  `${s} .e-answer{max-width:560px;margin:0 auto;padding:20px 18px;background:#FDF3F0;` +
  `font-size:17px;font-weight:800;line-height:1.85}` +
  `${s} .e-answer b{color:${ACCENT};font-weight:800}` +
  `${s} .e-note{margin:14px 0 0;font-size:12.5px;line-height:1.75;color:${INK_SUB}}` +
  `@media (max-width:480px){${s} .e-q{font-size:22px}${s} .e-answer{font-size:15.5px;padding:18px 15px}}`

export const HERO_QUESTION_SAMPLE: NewSample = {
  id: 'hero-question',
  category: '冒頭・つかみ',
  name: '問いかけの見出し（共感型）',
  summary: '「〜していませんか？」と問い、短い答えを返して下へ送り出す冒頭',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      '<h1 class="e-q">毎月の請求書づくりに、<em>3時間以上</em>かけていませんか？</h1>' +
      '<p class="e-sub">取引先ごとに書式を直し、金額を数え直し、印刷して封をする。' +
      '月末になると、その作業だけで半日が終わってしまう——。</p>' +
      `<span class="e-down" aria-hidden="true">${CHEVRON_RIGHT}</span>` +
      '<p class="e-answer">入力する場所を<b>1つ</b>にまとめると、翌月からは確認するだけで済みます。</p>' +
      '<p class="e-note">このページでは、そのやり方を3分でご説明します。</p>',
  }),
}
