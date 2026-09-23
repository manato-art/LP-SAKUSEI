/**
 * 新しい見本「使い方のQ&A（3つ）」（2026-09-23）。
 *
 * 使い方でよく聞かれることを3つだけ。開いて読ませる形（details）にはせず、
 * 問いと答えを最初から並べて出す（短いので、開く手間のほうが邪魔になる）。
 */
import { INK_SUB, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-c0000004'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .k-list{max-width:600px;margin:0 auto;border-top:1px solid ${LINE_LIGHT}}` +
  `${s} .k-item{padding:18px 2px;border-bottom:1px solid ${LINE_LIGHT}}` +
  `${s} .k-q,${s} .k-a{display:grid;grid-template-columns:22px minmax(0,1fr);gap:10px}` +
  `${s} .k-q{font-size:16.5px;font-weight:800;line-height:1.6}` +
  `${s} .k-a{margin-top:10px;font-size:14.5px;line-height:1.9;color:${INK_SUB}}` +
  `${s} .k-mark{font-size:15px;font-weight:800;line-height:1.75;color:${ACCENT};font-variant-numeric:tabular-nums}` +
  `${s} .k-a .k-mark{color:${INK_SUB};opacity:.6}` +
  `@media (max-width:480px){${s} .k-q{font-size:15.5px}${s} .k-q,${s} .k-a{grid-template-columns:20px minmax(0,1fr);gap:8px}}`

const qa = (question: string, answer: string): string =>
  `<div class="k-item">` +
  `<p class="k-q"><span class="k-mark">Q</span><span>${question}</span></p>` +
  `<p class="k-a"><span class="k-mark">A</span><span>${answer}</span></p>` +
  '</div>'

export const HOWTO_QA_SAMPLE: NewSample = {
  id: 'howto-qa',
  category: '説明・使い方',
  name: '使い方のQ&A（3つ）',
  summary: '使い方でよく聞かれる3つを、問いと答えを並べた短い形で載せます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('使い方のQ&A', 'お問い合わせの多い3つをまとめました。') +
      '<div class="k-list">' +
      qa(
        '1日に何回使えばよいですか。',
        '朝と夜の2回を目安にしています。回数を増やすより、同じ時間に続けるほうが習慣にしやすいです。',
      ) +
      qa(
        '1日使わない日があっても大丈夫ですか。',
        'かまいません。翌日からいつもどおりに戻してください。まとめて使う必要はありません。',
      ) +
      qa(
        'ほかのものと一緒に使えますか。',
        '一緒にお使いいただけます。順番に迷うときは、いつもの手入れの最後にしてください。',
      ) +
      '</div>',
  }),
}
