/**
 * 新しい見本「締切の一言＋ボタン」（2026-09-23）。
 *
 * 締切を文字だけで見せる（動く数字・残り時間のカウントは使わない。
 * ずっと同じ数字が出ていると嘘になりやすく、スクリプトが増えるほど壊れやすくなるため）。
 * 日付は大きく、過ぎたあとどうなるかまで書いて、押す理由がはっきり分かるようにした。
 */
import { ARROW_RIGHT_LABEL, INK, INK_SUB, LINE_LIGHT, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-e0000011'
const ACCENT = '#C0392B'
const ACCENT_EDGE = '#8C2419'
const s = `.${UID}`

const CSS =
  `${s}{text-align:center}` +
  `${s} .k-label{display:inline-block;margin:0 0 12px;padding:5px 14px;border-radius:999px;background:${ACCENT};` +
  `color:#FFFFFF;font-size:12px;font-weight:800;letter-spacing:.06em}` +
  `${s} .k-date{font-size:32px;font-weight:800;line-height:1.35;color:${INK};letter-spacing:-.01em;` +
  `margin:0 0 4px}` +
  // 「3月31日（火）」の途中では折り返さない（狭い画面でも日付がばらけないように）
  `${s} .k-day{white-space:nowrap}` +
  `${s} .k-day b{color:${ACCENT};font-weight:800;font-variant-numeric:tabular-nums}` +
  `${s} .k-time{font-size:16px;font-weight:800;letter-spacing:normal;white-space:nowrap}` +
  `${s} .k-after{max-width:520px;margin:0 auto 22px;font-size:14px;line-height:1.85;color:${INK_SUB}}` +
  `${s} .k-btn{display:flex;width:100%;max-width:520px;margin:0 auto;align-items:center;justify-content:center;` +
  `gap:10px;min-height:66px;padding:18px 24px;border-radius:12px;background:${ACCENT};color:#FFFFFF;` +
  `font-weight:800;font-size:19px;line-height:1.35;font-family:inherit;text-decoration:none;text-shadow:0 1px 2px rgba(0,0,0,.2);` +
  `box-shadow:0 5px 0 ${ACCENT_EDGE},0 12px 20px rgba(0,0,0,.12);` +
  `transition:transform .14s ease,box-shadow .14s ease;-webkit-tap-highlight-color:transparent}` +
  `${s} .k-btn:active{transform:translateY(4px);box-shadow:0 1px 0 ${ACCENT_EDGE},0 5px 10px rgba(0,0,0,.1)}` +
  `${s} .k-btn:focus-visible{outline:3px solid ${ACCENT_EDGE};outline-offset:4px}` +
  `${s} .k-btn svg{flex:0 0 20px;width:20px;height:20px}` +
  `${s} .k-note{max-width:520px;margin:14px auto 0;padding-top:12px;border-top:1px solid ${LINE_LIGHT};` +
  `font-size:12px;line-height:1.8;color:${INK_SUB};text-align:left}` +
  `@media (max-width:480px){${s} .k-date{font-size:26px}${s} .k-time{font-size:14px}` +
  `${s} .k-btn{font-size:17px;min-height:62px}}` +
  `@media (prefers-reduced-motion:reduce){${s} .k-btn{transition:none}}`

export const CTA_DEADLINE_SAMPLE: NewSample = {
  id: 'cta-deadline',
  category: '申し込み・CTA',
  name: '締切の一言つきボタン',
  summary: '締切を文字で大きく見せます。動く数字や残り時間のカウントは使いません',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      '<p class="k-label">お申し込みの締切</p>' +
      '<p class="k-date"><span class="k-day"><b>3月31日</b>（火）</span>' +
      '<span class="k-time">23時59分</span>まで</p>' +
      '<p class="k-after">締切を過ぎたあとのお申し込みは、通常価格（12,800円・税込）でのご案内となります。' +
      'お手続きは3分ほどで終わります。</p>' +
      `<a class="k-btn" href="ooooo"><span>締切までに申し込む</span>${ARROW_RIGHT_LABEL}</a>` +
      '<p class="k-note">※締切はお申し込みフォームを受け付けた時刻で判定します。' +
      '※お支払いの手続きは、締切のあとでもお進みいただけます。※2026年3月時点のご案内です。</p>',
  }),
}
