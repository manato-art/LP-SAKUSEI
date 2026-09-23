/**
 * 新しい見本「お悩みチェック（4つ）」（2026-09-23）。
 *
 * 「こんなことで困っていませんか？」と並べて、読む人に自分ごとだと気づいてもらう区画。
 * 箱を4つ反復させず、細い線で区切るだけにする（ui-forge anti-ai-look）。
 */
import { CHECK, INK, INK_SUB, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-wory0001'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s}{background:#F7F9FC}` +
  `${s} .w-list{max-width:560px;margin:0 auto;border-top:1px solid ${LINE_LIGHT}}` +
  `${s} .w-item{display:flex;align-items:flex-start;gap:12px;padding:14px 2px;` +
  `border-bottom:1px solid ${LINE_LIGHT};font-size:15.5px;font-weight:700;line-height:1.75;color:${INK}}` +
  `${s} .w-item svg{flex:0 0 19px;width:19px;height:19px;margin-top:5px;color:${ACCENT}}` +
  `${s} .w-close{max-width:560px;margin:20px auto 0;font-size:15px;line-height:1.9;text-align:center;color:${INK_SUB}}` +
  `${s} .w-close b{color:${INK};font-weight:800}` +
  `@media (max-width:480px){${s} .w-item{font-size:14.5px}}`

const worry = (text: string): string => `<li class="w-item">${CHECK}<span>${text}</span></li>`

export const WORRY_CHECK_SAMPLE: NewSample = {
  id: 'worry-check',
  category: '悩み・共感',
  name: 'お悩みチェック（4つ）',
  summary: '「こんなことで困っていませんか？」を並べて、自分ごとにしてもらう区画',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('こんなことで困っていませんか？', '1つでも当てはまる方は、このまま読み進めてください。') +
      '<ul class="w-list">' +
      worry('始めてみたいけれど、続けられる自信がない') +
      worry('何から手をつければいいのか分からない') +
      worry('前に試したが、面倒でやめてしまった') +
      worry('費用がどれくらいかかるのか不安') +
      '</ul>' +
      '<p class="w-close">その悩み、<b>準備がいらない仕組み</b>で解決できます。</p>',
  }),
}
