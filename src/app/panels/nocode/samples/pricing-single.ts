/**
 * 新しい見本「単品価格（割引前後）」（2026-09-23）。
 *
 * 単品をひとつだけ売るときの価格の出し方。通常価格は打ち消し線で小さく、
 * いま払う金額だけを大きく出す（箱を並べず、真ん中に1本の流れで読ませる）。
 */
import { ARROW_RIGHT_LABEL, INK, INK_SUB, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-e0000002'
const ACCENT = '#E5573F'
const ACCENT_EDGE = '#B83A26'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .u-body{max-width:520px;margin:0 auto;text-align:center}` +
  `${s} .u-tag{display:inline-block;margin:0 0 14px;padding:5px 13px;border-radius:999px;background:${ACCENT};` +
  `color:#FFFFFF;font-size:12px;font-weight:800;letter-spacing:.04em}` +
  `${s} .u-item{font-size:16.5px;font-weight:800;line-height:1.6;color:${INK};margin:0 0 2px}` +
  `${s} .u-amount{font-size:13px;line-height:1.7;color:${INK_SUB};margin:0 0 16px}` +
  // 通常価格（打ち消し線）と、いま払う金額
  `${s} .u-old{font-size:14px;line-height:1.6;color:${INK_SUB};margin:0 0 2px}` +
  `${s} .u-old s{text-decoration:line-through;text-decoration-thickness:1.5px;font-variant-numeric:tabular-nums}` +
  `${s} .u-now{font-size:13px;font-weight:800;line-height:1.6;color:${ACCENT};margin:0 0 2px}` +
  `${s} .u-price{display:flex;align-items:baseline;justify-content:center;gap:3px;margin:0 0 8px;` +
  `font-size:52px;font-weight:800;line-height:1.05;color:${ACCENT};letter-spacing:-.03em;` +
  `font-variant-numeric:tabular-nums}` +
  `${s} .u-yen{font-size:20px;font-weight:800;letter-spacing:normal;color:${INK}}` +
  `${s} .u-save{display:inline-block;margin:0 0 20px;padding:4px 12px;border-radius:999px;background:#FDF3F1;` +
  `color:${ACCENT};font-size:12.5px;font-weight:800}` +
  // ボタン（下の縁で厚みを出し、押すと沈む）
  `${s} .u-btn{display:flex;align-items:center;justify-content:center;gap:10px;min-height:62px;padding:16px 22px;` +
  `border-radius:12px;background:${ACCENT};color:#FFFFFF;font:800 18px/1.4 inherit;text-decoration:none;` +
  `text-shadow:0 1px 2px rgba(0,0,0,.2);box-shadow:0 5px 0 ${ACCENT_EDGE},0 12px 20px rgba(0,0,0,.12);` +
  `transition:transform .14s ease,box-shadow .14s ease;-webkit-tap-highlight-color:transparent}` +
  `${s} .u-btn:active{transform:translateY(4px);box-shadow:0 1px 0 ${ACCENT_EDGE},0 5px 10px rgba(0,0,0,.1)}` +
  `${s} .u-btn:focus-visible{outline:3px solid ${ACCENT_EDGE};outline-offset:4px}` +
  `${s} .u-btn svg{flex:0 0 19px;width:19px;height:19px}` +
  `${s} .u-note{margin:16px 0 0;padding-top:14px;border-top:1px solid ${LINE_LIGHT};font-size:12px;` +
  `line-height:1.8;color:${INK_SUB};text-align:left}` +
  `@media (max-width:480px){${s} .u-price{font-size:44px}${s} .u-btn{font-size:16.5px;min-height:58px}}` +
  `@media (prefers-reduced-motion:reduce){${s} .u-btn{transition:none}}`

export const PRICING_SINGLE_SAMPLE: NewSample = {
  id: 'pricing-single',
  category: '料金・プラン',
  name: '単品価格（割引前と割引後）',
  summary: '通常価格に打ち消し線を引き、いま払う金額だけを大きく出す形です',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('お試しセットの価格', '内容量もお届けの中身も、通常のセットと同じです。') +
      '<div class="u-body">' +
      '<span class="u-tag">はじめての方かぎり</span>' +
      '<h3 class="u-item">お試しセット（30日分）</h3>' +
      '<p class="u-amount">1日あたり約163円です。</p>' +
      '<p class="u-old">通常価格 <s>9,800円</s></p>' +
      '<p class="u-now">いまのお申し込み価格</p>' +
      '<p class="u-price">4,900<span class="u-yen">円（税込）</span></p>' +
      '<span class="u-save">4,900円お得になります</span>' +
      `<a class="u-btn" href="ooooo"><span>このセットを申し込む</span>${ARROW_RIGHT_LABEL}</a>` +
      '<p class="u-note">※価格は税込み・送料無料です。※お一人さま1回かぎりのご提供です。' +
      '※2回目以降は通常価格（9,800円・税込）でのご案内となります。※2026年3月時点の価格です。</p>' +
      '</div>',
  }),
}
