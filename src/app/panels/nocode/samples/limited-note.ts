/**
 * 新しい見本「終了予定の注意書き」（2026-09-23）。
 *
 * 期間や数に限りがあることを、急かさずに書いておくための小さめの囲み。
 * 終了の条件と、予告なく変わる場合があることを先に伝えておくと、あとでの行き違いが減る。
 * 目立たせる区画ではないので、角を丸めず、文字も小さく、色は見出しの一語だけにとどめる。
 */
import { INK_SUB, LINE, LINE_LIGHT, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-f0000010'
const ACCENT = '#C2462C'
const s = `.${UID}`

const CSS =
  `${s}{padding:20px 16px}` +
  `${s} .z-box{max-width:620px;margin:0 auto;padding:18px 20px;border:1px solid ${LINE};background:#FAFBFC}` +
  `${s} .z-head{margin:0 0 9px;font-size:13.5px;font-weight:800;letter-spacing:.04em;` +
  `line-height:1.6;color:${ACCENT}}` +
  `${s} .z-li{position:relative;padding-left:14px;font-size:12.5px;line-height:1.95;color:${INK_SUB}}` +
  `${s} .z-li+.z-li{margin-top:5px}` +
  `${s} .z-li::before{content:"";position:absolute;left:2px;top:10px;width:4px;height:4px;` +
  `border-radius:50%;background:#A7B0BB}` +
  `${s} .z-foot{margin:12px 0 0;padding-top:11px;border-top:1px solid ${LINE_LIGHT};` +
  `font-size:12px;line-height:1.9;color:${INK_SUB}}` +
  `@media (max-width:480px){${s} .z-box{padding:16px 15px}${s} .z-li{font-size:12px}}`

const note = (text: string): string => `<li class="z-li">${text}</li>`

export const LIMITED_NOTE_SAMPLE: NewSample = {
  id: 'limited-note',
  category: '限定・急ぎ',
  name: '終了予定の注意書き',
  summary: '終了の条件と、予告なく変わる場合があることを丁寧に伝えます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      '<div class="z-box">' +
      '<p class="z-head">ご案内の終了について</p>' +
      '<ul>' +
      note('本キャンペーンは2026年3月31日（火）23時59分までを予定しています。') +
      note('ご用意した数に達した場合は、期間の途中でも受付を終了することがあります。') +
      note('内容は予告なく変更、または終了する場合があります。あらかじめご了承ください。') +
      note('終了後のお申し込みは、通常価格でのご案内となります。') +
      '</ul>' +
      '<p class="z-foot">ご不明な点は、お問い合わせ窓口（平日10:00〜18:00・土日祝を除く）まで' +
      'お気軽にご連絡ください。</p>' +
      '</div>',
  }),
}
