/**
 * 新しい見本「電話で相談」（2026-09-23）。
 *
 * 入力フォームを嫌う方の受け皿。番号そのものを押せる形（`tel:`）にして、
 * スマートフォンならそのままかけられるようにした。受付時間と「売り込みはしない」一言を必ず添える。
 */
import { INK, INK_SUB, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-e0000007'
const ACCENT = '#2B4A7E'
const ACCENT_EDGE = '#1B3055'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .d-body{max-width:460px;margin:0 auto;text-align:center}` +
  // 番号そのものがボタン（白地＋濃い枠。下の縁で厚みを出し、押すと沈む）
  `${s} .d-call{display:block;padding:14px 18px 16px;border-radius:12px;border:2px solid ${ACCENT};` +
  `background:#FFFFFF;color:${ACCENT};text-decoration:none;box-shadow:0 5px 0 ${ACCENT_EDGE};` +
  `transition:transform .14s ease,box-shadow .14s ease;-webkit-tap-highlight-color:transparent}` +
  `${s} .d-call:active{transform:translateY(4px);box-shadow:0 1px 0 ${ACCENT_EDGE}}` +
  `${s} .d-call:focus-visible{outline:3px solid ${ACCENT_EDGE};outline-offset:4px}` +
  `${s} .d-free{display:inline-block;padding:3px 11px;border-radius:999px;background:${ACCENT};color:#FFFFFF;` +
  `font-size:11.5px;font-weight:800;letter-spacing:.06em}` +
  `${s} .d-no{display:block;margin-top:7px;font-size:36px;font-weight:800;line-height:1.15;letter-spacing:.01em;` +
  `font-variant-numeric:tabular-nums;white-space:nowrap}` +
  `${s} .d-tap{display:block;margin-top:4px;font-size:12px;font-weight:800;line-height:1.6;color:${INK_SUB}}` +
  `${s} .d-hours{margin:16px 0 0;font-size:14px;line-height:1.8;color:${INK};font-weight:800}` +
  `${s} .d-hours span{display:block;font-size:12.5px;font-weight:400;color:${INK_SUB};margin-top:2px}` +
  `${s} .d-say{margin:16px 0 0;padding-top:14px;border-top:1px solid ${LINE_LIGHT};font-size:13.5px;` +
  `line-height:1.9;color:${INK};text-align:left}` +
  `${s} .d-note{margin:10px 0 0;font-size:12px;line-height:1.8;color:${INK_SUB};text-align:left}` +
  `@media (max-width:480px){${s} .d-no{font-size:30px}${s} .d-say{font-size:13px}}` +
  `@media (prefers-reduced-motion:reduce){${s} .d-call{transition:none}}`

export const CTA_TEL_SAMPLE: NewSample = {
  id: 'cta-tel',
  category: '申し込み・CTA',
  name: '電話で相談（番号を押すとかかります）',
  summary: '大きな電話番号がそのままボタン。受付時間と一言を添えた形です',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('お電話でのご相談', 'フォームの入力が面倒な方は、こちらからどうぞ。') +
      '<div class="d-body">' +
      '<a class="d-call" href="tel:0120-000-000">' +
      '<span class="d-free">通話料は無料です</span>' +
      '<span class="d-no">0120-000-000</span>' +
      '<span class="d-tap">押すとそのままおかけいただけます</span></a>' +
      '<p class="d-hours">受付時間 平日9時〜18時<span>土日・祝日・年末年始はお休みをいただきます</span></p>' +
      '<p class="d-say">無理におすすめすることはありません。「いまは決められない」というお返事でも大丈夫ですので、' +
      '気になることだけ聞いてお切りください。1回の相談は10分ほどです。</p>' +
      '<p class="d-note">※おかけまちがいにご注意ください。※通話の内容は、応対の確認のために録音しています。' +
      '※2026年3月時点の受付時間です。</p>' +
      '</div>',
  }),
}
