/**
 * 新しい見本「リード文（中央寄せ）」（2026-09-23）。
 *
 * 区画のいちばん上に置く3行ほどの前置き。1行の長さを max-width で詰めて読みやすくし、
 * 上に細い線を1本だけ置いて「ここから新しい話が始まる」と分かるようにする。
 */
import { INK, INK_SUB, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-h0000001'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  `${s}{padding:28px 16px}` +
  `${s} .l-mark{width:32px;height:2px;margin:0 auto 18px;background:${ACCENT}}` +
  `${s} .l-text{max-width:26em;margin:0 auto;font-size:15.5px;line-height:1.95;` +
  `text-align:center;color:${INK_SUB}}` +
  `${s} .l-text b{color:${INK};font-weight:800}` +
  `@media (max-width:480px){${s} .l-mark{margin-bottom:14px}` +
  `${s} .l-text{font-size:14.5px;line-height:1.9}}`

export const TEXT_LEAD_SAMPLE: NewSample = {
  id: 'text-lead',
  category: '文章・区切り',
  name: 'リード文（中央寄せ）',
  summary: '区画の頭に置く3行の前置き。1行を短くして読みやすくしています',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      '<div class="l-mark"></div>' +
      '<p class="l-text">毎日の暮らしを、もう少しだけ軽くしたい。' +
      'そう考えている方のために、<b>準備のいらない使い方</b>をまとめました。' +
      'はじめての方でも、読んだその日から試していただけます。</p>',
  }),
}
