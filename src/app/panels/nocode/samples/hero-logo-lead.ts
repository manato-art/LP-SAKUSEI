/**
 * 新しい見本「ロゴ枠＋キャッチ（企業向け）」（2026-09-23）。
 *
 * BtoB向けの落ち着いた冒頭。上に仮のロゴ（細い枠に入れた小さめの画像）、下にキャッチと一言。
 * 中央そろえにせず左そろえにして、色は見出しの上の短い線と小さなラベルだけに使う。
 * ロゴは `<img>` のままなので「画像を変える」でそのまま差し替えられる。
 */
import { CHEVRON_RIGHT, IMAGE_PLACEHOLDER, INK_SUB, LINE, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-a0000007'
const ACCENT = '#C0492F'
const s = `.${UID}`

const CSS =
  `${s}{padding:38px 16px 34px}` +
  `${s} .g-inner{max-width:600px;margin:0 auto}` +
  `${s} .g-logobox{display:inline-block;padding:12px 16px;border:1px solid ${LINE};margin:0 0 22px}` +
  `${s} .g-logo{width:124px}` +
  `${s} .g-label{display:inline-block;padding-top:14px;border-top:2px solid ${ACCENT};` +
  `font-size:12px;font-weight:800;letter-spacing:.08em;color:${ACCENT};margin:0 0 12px}` +
  `${s} .g-title{font-size:26px;font-weight:800;line-height:1.5;letter-spacing:-.01em;margin:0 0 14px;` +
  `text-wrap:balance}` +
  `${s} .g-lead{font-size:15px;line-height:1.95;color:${INK_SUB};margin:0 0 20px}` +
  `${s} .g-link{display:inline-flex;align-items:center;gap:6px;font-size:14px;font-weight:700;` +
  `color:${ACCENT};text-decoration:none;border-bottom:1px solid ${ACCENT};padding-bottom:2px}` +
  `${s} .g-link svg{flex:0 0 15px;width:15px;height:15px}` +
  `${s} .g-link:focus-visible{outline:2px solid ${ACCENT};outline-offset:3px}` +
  `@media (max-width:480px){${s} .g-title{font-size:22px}${s} .g-lead{font-size:14.5px}` +
  `${s} .g-logo{width:108px}}`

export const HERO_LOGO_LEAD_SAMPLE: NewSample = {
  id: 'hero-logo-lead',
  category: '冒頭・つかみ',
  name: 'ロゴ枠＋キャッチ（企業向け）',
  summary: '上に小さなロゴ、下にキャッチと一言。BtoB向けの落ち着いた冒頭',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      '<div class="g-inner">' +
      `<span class="g-logobox"><img class="g-logo" src="${IMAGE_PLACEHOLDER}" alt="株式会社サンプルのロゴ"></span>` +
      '<p class="g-label">法人向けサービス</p>' +
      '<h1 class="g-title">拠点が増えても、勤怠の集計はひとつの画面で</h1>' +
      '<p class="g-lead">全国に支店をお持ちの会社向けです。30拠点までは同じ料金で、' +
      '締め日ごとの集計を毎月1日にまとめてお出しします。</p>' +
      `<a class="g-link" href="ooooo"><span>サービス資料（PDF・12ページ）をご請求ください</span>${CHEVRON_RIGHT}</a>` +
      '</div>',
  }),
}
