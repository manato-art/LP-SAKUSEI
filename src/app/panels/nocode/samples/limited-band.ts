/**
 * 新しい見本「期間限定の帯」（2026-09-23）。
 *
 * 期限と条件を1行だけ伝える細い帯。上下の区画を切らないよう、背を低く保つ。
 * 動く数字（カウントダウン）は作らない ― スクリプトが要るうえ、読む人を急かしすぎる。
 * 赤は日付の文字と淡い地の2つだけに絞り、面全体を赤くしない。
 */
import { INK, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-f0000006'
const ACCENT = '#C2462C'
const TINT = '#FBF2EF'
const s = `.${UID}`

const CSS =
  `${s}{padding:0}` +
  `${s} .p-band{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:4px 18px;` +
  `padding:14px 16px;background:${TINT};text-align:center}` +
  `${s} .p-date{font-size:15.5px;font-weight:800;line-height:1.6;color:${ACCENT};` +
  `font-variant-numeric:tabular-nums;letter-spacing:.01em}` +
  `${s} .p-cond{font-size:13.5px;line-height:1.75;color:${INK}}` +
  `${s} .p-cond b{font-weight:800}` +
  `@media (max-width:480px){${s} .p-band{gap:2px;padding:12px 14px}` +
  `${s} .p-date{font-size:14.5px}${s} .p-cond{font-size:12.5px}}`

export const LIMITED_BAND_SAMPLE: NewSample = {
  id: 'limited-band',
  category: '限定・急ぎ',
  name: '期間限定の帯',
  summary: '期限と条件を1行だけ。読んでいる流れを止めない細い帯です',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      '<div class="p-band">' +
      '<p class="p-date">2026年3月31日（火）23:59まで</p>' +
      '<p class="p-cond"><b>先着100名様</b>を初回半額でご案内しています</p>' +
      '</div>',
  }),
}
