/**
 * 新しい見本「注意書きの囲み（淡色）」（2026-09-23）。
 *
 * 申し込みの前に読んでおいてほしい決まりごとを3行だけ置く区画。
 * 赤や黄の警告色は使わず、淡い地と小さな文字で「補足」として見せる（本文の流れを止めないため）。
 */
import { INK_SUB, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-h0000004'
const s = `.${UID}`

const CSS =
  `${s}{padding:24px 16px}` +
  `${s} .n-box{max-width:620px;margin:0 auto;padding:20px 22px;border-radius:12px;background:#F4F6F9}` +
  `${s} .n-head{font-size:14.5px;font-weight:800;line-height:1.7;margin:0 0 8px}` +
  `${s} .n-list{display:grid;gap:5px}` +
  `${s} .n-item{padding-left:1.1em;text-indent:-1.1em;font-size:13.5px;line-height:1.9;color:${INK_SUB}}` +
  `${s} .n-item::before{content:'・'}` +
  `@media (max-width:480px){${s} .n-box{padding:18px 16px}${s} .n-item{font-size:13px}}`

const note = (text: string): string => `<li class="n-item">${text}</li>`

export const TEXT_NOTE_BOX_SAMPLE: NewSample = {
  id: 'text-note-box',
  category: '文章・区切り',
  name: '注意書きの囲み（淡色）',
  summary: '決まりごとを3行だけ。淡い地に置いて補足として読ませます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      '<div class="n-box">' +
      '<p class="n-head">お申し込みの前にご確認ください</p>' +
      '<ul class="n-list">' +
      note('お届けまでに3〜5日ほどいただきます。地域や天候により前後することがあります。') +
      note('内容の変更とキャンセルは、発送のご連絡を差し上げる前までにお願いします。') +
      note('表示している価格はすべて税込みです。送料は別にいただきます。') +
      '</ul></div>',
  }),
}
