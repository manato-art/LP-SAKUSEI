/**
 * 新しい見本「使うときの注意（3点）」（2026-09-23）。
 *
 * 使う前に読んでおいてほしいことを3点だけ。赤や黄の強い警告色は使わず、
 * 淡い地の囲みを1つ置いて、その中に線で区切って並べる（怖がらせずに、読み飛ばされない形）。
 */
import { CHECK, INK_SUB, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-c0000006'
const ACCENT = '#5B7089'
const s = `.${UID}`

const CSS =
  `${s} .j-box{max-width:620px;margin:0 auto;padding:22px 22px 20px;background:#F4F6F9;border-radius:6px}` +
  `${s} .j-title{font-size:15px;font-weight:800;line-height:1.7;color:${ACCENT};margin:0 0 6px}` +
  `${s} .j-list{margin:0}` +
  `${s} .j-item{display:grid;grid-template-columns:18px minmax(0,1fr);gap:11px;align-items:start;` +
  `padding:12px 0;border-top:1px solid #E2E7EE;font-size:14.5px;line-height:1.85}` +
  `${s} .j-item svg{width:18px;height:18px;margin-top:4px;color:${ACCENT}}` +
  `${s} .j-note{margin:12px 0 0;font-size:12px;line-height:1.8;color:${INK_SUB}}` +
  `@media (max-width:480px){${s} .j-box{padding:18px 16px 16px}${s} .j-item{font-size:14px;gap:9px}}`

const caution = (text: string): string => `<li class="j-item">${CHECK}<span>${text}</span></li>`

export const HOWTO_CAUTION_SAMPLE: NewSample = {
  id: 'howto-caution',
  category: '説明・使い方',
  name: '使うときの注意（3点）',
  summary: '使う前に読んでほしい3点を、淡い地の囲み1つにまとめます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      '<div class="j-box">' +
      '<p class="j-title">ご使用の前に、次の3点をご確認ください</p>' +
      '<ul class="j-list">' +
      caution('お肌に合わないと感じたときは、その日のうちに使用をやめてください。') +
      caution('直射日光の当たる場所や、高温になる車内には置かないでください。') +
      caution('お子さまやペットの手が届かないところで保管してください。') +
      '</ul>' +
      '<p class="j-note">ご不明な点は、お問い合わせ窓口までご連絡ください。受付時間 平日10:00〜18:00（土日祝を除く）</p>' +
      '</div>',
  }),
}
