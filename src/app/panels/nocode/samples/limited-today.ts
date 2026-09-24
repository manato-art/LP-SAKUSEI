/**
 * 新しい見本「本日限りのご案内」（2026-09-23）。
 *
 * いちばん上に日付を入れる場所を置き、その下に特典を3つ、最後にボタン。
 * 日付は毎日書き換える前提なので、他の文字と混ぜず独立した1行にして直しやすくする
 * （時計の動きは作らない。スクリプトが要るうえ、書き換え忘れに気づけなくなる）。
 * 特典は箱を3つ並べず、番号と細い線だけで区切る。
 */
import { ARROW_RIGHT_LABEL, INK, INK_SUB, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-f0000008'
const ACCENT = '#C2462C'
const TINT = '#FBF2EF'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .y-when-wrap{text-align:center;margin:0 0 24px}` +
  `${s} .y-when{display:inline-block;padding:9px 20px;border-radius:8px;background:${TINT};` +
  `color:${ACCENT};font-size:17px;font-weight:800;line-height:1.5;font-variant-numeric:tabular-nums}` +
  `${s} .y-list{max-width:560px;margin:0 auto;border-top:1px solid ${LINE_LIGHT}}` +
  `${s} .y-item{display:flex;align-items:flex-start;gap:14px;padding:14px 2px;` +
  `border-bottom:1px solid ${LINE_LIGHT}}` +
  `${s} .y-no{flex:0 0 auto;font-size:13px;font-weight:800;line-height:1.95;color:${ACCENT};` +
  `font-variant-numeric:tabular-nums;letter-spacing:.04em}` +
  `${s} .y-txt{flex:1;min-width:0}` +
  `${s} .y-t{font-size:15.5px;font-weight:800;line-height:1.65;color:${INK}}` +
  `${s} .y-d{margin:3px 0 0;font-size:13.5px;line-height:1.85;color:${INK_SUB}}` +
  `${s} .y-btn{display:flex;width:100%;max-width:440px;margin:24px auto 0;align-items:center;` +
  `justify-content:center;gap:9px;min-height:58px;padding:16px 22px;border-radius:10px;` +
  `background:${ACCENT};color:#FFFFFF;font-weight:800;font-size:16.5px;line-height:1.4;font-family:inherit;text-decoration:none;` +
  `transition:opacity .14s ease}` +
  `${s} .y-btn:hover{opacity:.88}` +
  `${s} .y-btn:focus-visible{outline:3px solid ${ACCENT};outline-offset:4px}` +
  `${s} .y-btn svg{flex:0 0 18px;width:18px;height:18px}` +
  `${s} .y-note{max-width:560px;margin:14px auto 0;font-size:12px;line-height:1.85;` +
  `color:${INK_SUB};text-align:center}` +
  `@media (max-width:480px){${s} .y-when{font-size:15.5px;padding:8px 14px}` +
  `${s} .y-t{font-size:15px}${s} .y-d{font-size:13px}${s} .y-btn{font-size:15.5px;min-height:56px}}` +
  `@media (prefers-reduced-motion:reduce){${s} .y-btn{transition:none}}`

const gift = (no: string, title: string, text: string): string =>
  `<div class="y-item"><p class="y-no">${no}</p>` +
  `<div class="y-txt"><p class="y-t">${title}</p><p class="y-d">${text}</p></div></div>`

export const LIMITED_TODAY_SAMPLE: NewSample = {
  id: 'limited-today',
  category: '限定・急ぎ',
  name: '本日限りのご案内',
  summary: '日付を入れる場所と特典3つとボタン。当日だけの案内に使います',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('本日お申し込みの方へ', '下記の3つは、本日お申し込みの方までのご案内です。') +
      '<div class="y-when-wrap"><p class="y-when">2026年3月15日（日）23:59まで</p></div>' +
      '<div class="y-list">' +
      gift('01', '初回料金が半額', '通常4,800円のところ、初月は2,400円でご利用いただけます。') +
      gift('02', '送料が無料', '全国どこでも送料をいただきません。離島も同じ条件です。') +
      gift('03', '開始日をお選びいただけます', 'お申し込みから最長30日先まで、使いはじめる日を指定できます。') +
      '</div>' +
      `<a class="y-btn" href="ooooo"><span>本日のご案内を見る</span>${ARROW_RIGHT_LABEL}</a>` +
      '<p class="y-note">※本日23時59分を過ぎたお申し込みは、通常価格でのご案内となります。</p>',
  }),
}
