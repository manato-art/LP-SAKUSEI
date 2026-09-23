/**
 * 新しい見本「見出し＋価格＋ボタン」（2026-09-23）。
 *
 * ねだんが決め手になる商材の冒頭。通常価格に打ち消し線を引き、いまの価格だけを大きく見せる。
 * 強調は「面の淡色」と「数字の大きさ」だけにして、囲みや色付きの線は使わない。
 */
import { INK_SUB, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-a0000004'
const ACCENT = '#E5573F'
const ACCENT_EDGE = '#B83A26'
const s = `.${UID}`

const CSS =
  `${s}{padding:36px 16px 32px;text-align:center}` +
  `${s} .d-title{font-size:27px;font-weight:800;line-height:1.42;letter-spacing:-.01em;margin:0 0 8px;` +
  `text-wrap:balance}` +
  `${s} .d-title em{font-style:normal;color:${ACCENT}}` +
  `${s} .d-lead{max-width:560px;margin:0 auto 22px;font-size:14.5px;line-height:1.9;color:${INK_SUB}}` +
  `${s} .d-price{max-width:460px;margin:0 auto;padding:20px 16px 18px;background:#FDF3F0}` +
  `${s} .d-was{display:block;font-size:13.5px;line-height:1.7;color:${INK_SUB}}` +
  `${s} .d-was s{text-decoration:line-through;font-variant-numeric:tabular-nums}` +
  `${s} .d-now{display:flex;align-items:baseline;justify-content:center;gap:4px;margin:4px 0 0;` +
  `color:${ACCENT};font-variant-numeric:tabular-nums}` +
  `${s} .d-mark{font-size:15px;font-weight:800}` +
  `${s} .d-value{font-size:52px;font-weight:800;line-height:1.05;letter-spacing:-.03em}` +
  `${s} .d-unit{font-size:17px;font-weight:800}` +
  `${s} .d-cond{margin:8px 0 0;font-size:12.5px;line-height:1.7;color:${INK_SUB}}` +
  `${s} .d-btn{display:block;width:100%;max-width:440px;margin:20px auto 0;min-height:62px;` +
  `padding:18px 22px;border-radius:12px;background:${ACCENT};color:#FFFFFF;font:800 17px/1.5 inherit;` +
  `text-decoration:none;box-shadow:0 5px 0 ${ACCENT_EDGE};transition:transform .14s ease,box-shadow .14s ease}` +
  `${s} .d-btn:active{transform:translateY(4px);box-shadow:0 1px 0 ${ACCENT_EDGE}}` +
  `${s} .d-btn:focus-visible{outline:3px solid ${ACCENT_EDGE};outline-offset:4px}` +
  `${s} .d-note{max-width:460px;margin:12px auto 0;font-size:12px;line-height:1.75;color:${INK_SUB}}` +
  `@media (max-width:480px){${s} .d-title{font-size:23px}${s} .d-value{font-size:44px}` +
  `${s} .d-btn{font-size:16px}}` +
  `@media (prefers-reduced-motion:reduce){${s} .d-btn{transition:none}}`

export const HERO_PRICE_SAMPLE: NewSample = {
  id: 'hero-price',
  category: '冒頭・つかみ',
  name: '見出し＋価格＋ボタン',
  summary: '通常価格に打ち消し線、いまの価格を大きく。ボタンと注記まで一式',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      '<h1 class="d-title">月々<em>2,980円</em>で、請求書づくりをまるごと</h1>' +
      '<p class="d-lead">初期費用はいただきません。契約は1か月ごとで、いつでもおやめいただけます。</p>' +
      '<div class="d-price">' +
      '<span class="d-was">通常 <s>月額 4,800円</s></span>' +
      '<p class="d-now"><span class="d-mark">月額</span><span class="d-value">2,980</span>' +
      '<span class="d-unit">円（税込）</span></p>' +
      '<p class="d-cond">先着100社・2026年3月31日（火）までのお申し込み</p>' +
      '</div>' +
      '<a class="d-btn" href="ooooo">このねだんで申し込む</a>' +
      '<p class="d-note">※表示はすべて税込です。2026年3月時点の価格で、変わることがあります。</p>',
  }),
}
