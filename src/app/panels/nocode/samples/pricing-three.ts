/**
 * 新しい見本「料金（3プラン）」（2026-09-23）。
 *
 * 3つ並べても「同じ箱の反復」にならないよう、真ん中のおすすめだけ淡い地にして少し幅を広く取り、
 * 両側は枠を持たせない（状態の示し方は「面の淡色」1つだけ・本人の決まり）。
 * 720px以下では縦積みにするので、375pxでも横に溢れない。
 */
import { CHECK, INK, INK_SUB, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-e0000001'
const ACCENT = '#1F7AE0'
const ACCENT_EDGE = '#14549B'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .q-grid{display:grid;grid-template-columns:1fr 1.16fr 1fr;gap:14px;max-width:780px;margin:0 auto;` +
  `align-items:start}` +
  `${s} .q-plan{min-width:0;padding:18px 14px}` +
  `${s} .q-plan--pick{padding:24px 18px;border-radius:14px;background:#EEF4FC}` +
  `${s} .q-badge{display:inline-block;margin:0 0 10px;padding:4px 11px;border-radius:999px;background:${ACCENT};` +
  `color:#FFFFFF;font-size:11.5px;font-weight:800;letter-spacing:.04em}` +
  `${s} .q-name{font-size:15px;font-weight:800;line-height:1.5;margin:0 0 8px;color:${INK}}` +
  `${s} .q-price{display:flex;align-items:baseline;gap:2px;margin:0 0 4px;font-size:28px;font-weight:800;` +
  `line-height:1.15;color:${INK};font-variant-numeric:tabular-nums;letter-spacing:-.02em}` +
  `${s} .q-price--pick{font-size:34px;color:${ACCENT}}` +
  `${s} .q-unit{font-size:13.5px;font-weight:800;letter-spacing:normal}` +
  `${s} .q-sub{font-size:12.5px;line-height:1.7;color:${INK_SUB};margin:0 0 14px}` +
  // 含まれるもの（箱にも線にもせず、印と文字だけで並べる）
  `${s} .q-feat{display:flex;align-items:flex-start;gap:8px;margin:0 0 9px;font-size:13.5px;line-height:1.7}` +
  `${s} .q-feat svg{flex:0 0 15px;width:15px;height:15px;margin-top:4px;color:${ACCENT}}` +
  `${s} .q-btn{display:flex;align-items:center;justify-content:center;min-height:50px;margin-top:16px;` +
  `padding:12px 14px;border-radius:10px;background:${ACCENT};color:#FFFFFF;font:800 15px/1.4 inherit;` +
  `text-decoration:none;box-shadow:0 4px 0 ${ACCENT_EDGE};transition:transform .12s ease,box-shadow .12s ease}` +
  `${s} .q-btn--quiet{background:#FFFFFF;color:${ACCENT};border:1.5px solid ${ACCENT};box-shadow:0 3px 0 #C6DCF5;` +
  `font-size:14px;min-height:46px}` +
  `${s} .q-btn:active{transform:translateY(3px);box-shadow:none}` +
  `${s} .q-btn:focus-visible{outline:3px solid ${ACCENT_EDGE};outline-offset:3px}` +
  `${s} .q-note{max-width:780px;margin:18px auto 0;font-size:12px;line-height:1.8;color:${INK_SUB};text-align:center}` +
  `@media (max-width:720px){${s} .q-grid{grid-template-columns:minmax(0,1fr);gap:10px;max-width:460px}` +
  `${s} .q-plan{padding:14px 12px}${s} .q-plan--pick{padding:20px 16px}${s} .q-price--pick{font-size:31px}}` +
  `@media (prefers-reduced-motion:reduce){${s} .q-btn{transition:none}}`

const feat = (text: string): string => `<p class="q-feat">${CHECK}<span>${text}</span></p>`

export const PRICING_THREE_SAMPLE: NewSample = {
  id: 'pricing-three',
  category: '料金・プラン',
  name: '料金（3プラン・真ん中がおすすめ）',
  summary: '3つの料金を横に並べて比べられます。真ん中だけ淡い地でおすすめを示します',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('料金プラン', 'どのプランも、あとから変更できます。解約の費用はかかりません。') +
      '<div class="q-grid">' +
      '<div class="q-plan"><h3 class="q-name">はじめてプラン</h3>' +
      '<p class="q-price">1,480<span class="q-unit">円／月</span></p>' +
      '<p class="q-sub">お一人で使いはじめる方に。</p>' +
      feat('メールでのご相談（2営業日以内にお返事します）') +
      feat('保存できるデータは100件までです') +
      '<a class="q-btn q-btn--quiet" href="ooooo">このプランを選ぶ</a></div>' +
      '<div class="q-plan q-plan--pick"><span class="q-badge">いちばん選ばれています</span>' +
      '<h3 class="q-name">しっかりプラン（3名まで）</h3>' +
      '<p class="q-price q-price--pick">3,980<span class="q-unit">円／月</span></p>' +
      '<p class="q-sub">1名あたり約1,327円。最初の30日間は0円です。</p>' +
      feat('チャットでのご相談（平日9時〜18時）') +
      feat('保存できるデータに上限はありません') +
      feat('毎月のご利用レポートをお届けします') +
      '<a class="q-btn" href="ooooo">このプランではじめる</a></div>' +
      '<div class="q-plan"><h3 class="q-name">まとめてプラン（10名まで）</h3>' +
      '<p class="q-price">7,800<span class="q-unit">円／月</span></p>' +
      '<p class="q-sub">部署やチームで使う方に。</p>' +
      feat('お電話でもご相談いただけます') +
      feat('担当者がひとりお付きします') +
      '<a class="q-btn q-btn--quiet" href="ooooo">このプランを選ぶ</a></div>' +
      '</div>' +
      '<p class="q-note">※価格はすべて税込みです。※年払いにすると1か月分お得になります。※2026年3月時点の料金です。</p>',
  }),
}
