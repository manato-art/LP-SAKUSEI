/**
 * 新しい見本「申し込みボタン（安心材料つき）」（2026-09-23・本人の依頼で0から作り直した2本目）。
 *
 * 一言（今だけの条件）＋大きなボタン＋押す前の不安を消す3行。LPの中・下で一番よく置く形。
 * リンク先は仮（`ooooo`）にしてあり、入れたあとWidget編集でボタンを押すと、その場で入れられる
 * （link-placeholder.ts・widget-link-bubble.ts）。
 */
import { ARROW_RIGHT_LABEL, CHECK, INK, INK_SUB, LINE_LIGHT, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-appl0001'
const ACCENT = '#E5573F'
const ACCENT_EDGE = '#B83A26'
const s = `.${UID}`

const CSS =
  `${s}{text-align:center}` +
  // 今だけの条件（細い線で挟んだ一言）
  `${s} .c-label{display:flex;align-items:center;justify-content:center;gap:10px;margin:0 0 14px;` +
  `font-size:13.5px;font-weight:800;letter-spacing:.06em;color:${ACCENT}}` +
  `${s} .c-label::before,${s} .c-label::after{content:"";flex:0 0 28px;height:1px;background:${ACCENT};opacity:.5}` +
  // ボタン（下の縁で厚みを出し、押すと沈む）
  `${s} .c-btn{display:flex;width:100%;max-width:520px;margin:0 auto;align-items:center;justify-content:center;` +
  `gap:10px;min-height:66px;padding:18px 26px;border-radius:12px;background:${ACCENT};color:#FFFFFF;` +
  `font:800 19px/1.35 inherit;text-decoration:none;text-shadow:0 1px 2px rgba(0,0,0,.2);` +
  `box-shadow:0 5px 0 ${ACCENT_EDGE},0 12px 20px rgba(0,0,0,.12);` +
  `transition:transform .14s ease,box-shadow .14s ease;-webkit-tap-highlight-color:transparent}` +
  `${s} .c-btn:active{transform:translateY(4px);box-shadow:0 1px 0 ${ACCENT_EDGE},0 5px 10px rgba(0,0,0,.1)}` +
  `${s} .c-btn:focus-visible{outline:3px solid ${ACCENT_EDGE};outline-offset:4px}` +
  `${s} .c-btn__text{min-width:0}` +
  `${s} .c-btn svg{flex:0 0 20px;width:20px;height:20px}` +
  `${s} .c-note{margin:12px 0 0;font-size:13px;line-height:1.7;color:${INK_SUB}}` +
  // 押す前の不安を消す3行（箱にせず、細い線で区切るだけ）
  `${s} .c-points{max-width:520px;margin:22px auto 0;border-top:1px solid ${LINE_LIGHT}}` +
  `${s} .c-point{display:flex;align-items:flex-start;gap:10px;padding:11px 2px;` +
  `border-bottom:1px solid ${LINE_LIGHT};font-size:14.5px;line-height:1.7;text-align:left;color:${INK}}` +
  `${s} .c-point svg{flex:0 0 17px;width:17px;height:17px;margin-top:4px;color:${ACCENT}}` +
  `@media (max-width:480px){${s} .c-btn{font-size:17px;min-height:62px}${s} .c-point{font-size:13.5px}}` +
  `@media (prefers-reduced-motion:reduce){${s} .c-btn{transition:none}}`

const point = (text: string): string => `<li class="c-point">${CHECK}<span>${text}</span></li>`

export const CTA_APPLY_SAMPLE: NewSample = {
  id: 'cta-apply',
  name: '申し込みボタン（安心材料つき）',
  summary: '今だけの一言＋大きなボタン＋押す前の不安を消す3行。リンク先はあとから入れられます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      '<p class="c-label">今なら初回半額</p>' +
      `<a class="c-btn" href="ooooo"><span class="c-btn__text">無料ではじめる</span>${ARROW_RIGHT_LABEL}</a>` +
      '<p class="c-note">入力は1分で終わります。解約はいつでもできます。</p>' +
      '<ul class="c-points">' +
      point('全国どこでも送料無料') +
      point('届いてから30日間は返品できます') +
      point('チャットでいつでも相談できます') +
      '</ul>',
  }),
}
