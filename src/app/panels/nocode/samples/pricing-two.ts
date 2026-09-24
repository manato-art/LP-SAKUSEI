/**
 * 新しい見本「料金（2プラン）」（2026-09-23）。
 *
 * 同じ箱を2つ並べない（ui-forge anti-ai-look）。おすすめの方だけ淡い地にして、
 * もう一方は枠なしで並べる。状態の示し方は「面の淡色」1つだけ（本人の決まり）。
 */
import { CHECK, INK, INK_SUB, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-pric0001'
const ACCENT = '#E5573F'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .r-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;max-width:620px;margin:0 auto;align-items:start}` +
  `${s} .r-plan{min-width:0;padding:22px 18px;border-radius:14px}` +
  `${s} .r-plan--pick{background:#FDF3F1}` +
  `${s} .r-badge{display:inline-block;margin:0 0 10px;padding:4px 10px;border-radius:999px;background:${ACCENT};` +
  `color:#FFFFFF;font-size:11.5px;font-weight:800;letter-spacing:.04em}` +
  `${s} .r-name{font-size:15px;font-weight:800;line-height:1.5;margin:0 0 6px;color:${INK}}` +
  `${s} .r-price{display:flex;align-items:baseline;gap:3px;margin:0 0 4px;font-size:30px;font-weight:800;` +
  `line-height:1.2;color:${INK};font-variant-numeric:tabular-nums;letter-spacing:-.02em}` +
  `${s} .r-price--pick{color:${ACCENT}}` +
  `${s} .r-unit{font-size:14px;font-weight:800;letter-spacing:normal}` +
  `${s} .r-sub{font-size:12.5px;line-height:1.7;color:${INK_SUB};margin:0 0 14px}` +
  `${s} .r-feats{border-top:1px solid ${LINE_LIGHT}}` +
  `${s} .r-feat{display:flex;align-items:flex-start;gap:8px;padding:9px 0;border-bottom:1px solid ${LINE_LIGHT};` +
  `font-size:13.5px;line-height:1.7;text-align:left}` +
  `${s} .r-feat svg{flex:0 0 15px;width:15px;height:15px;margin-top:4px;color:${ACCENT}}` +
  `${s} .r-btn{display:flex;align-items:center;justify-content:center;min-height:50px;margin-top:16px;` +
  `padding:12px 16px;border-radius:10px;background:${ACCENT};color:#FFFFFF;font-weight:800;font-size:15px;line-height:1.4;font-family:inherit;` +
  `text-decoration:none;box-shadow:0 3px 0 #B83A26}` +
  `${s} .r-btn--quiet{background:#FFFFFF;color:${ACCENT};box-shadow:none;border:1.5px solid ${ACCENT}}` +
  `${s} .r-btn:active{transform:translateY(2px);box-shadow:none}` +
  `${s} .r-btn:focus-visible{outline:3px solid #B83A26;outline-offset:3px}` +
  `${s} .r-note{max-width:620px;margin:16px auto 0;font-size:12px;line-height:1.7;color:${INK_SUB};text-align:center}` +
  `@media (max-width:560px){${s} .r-grid{grid-template-columns:minmax(0,1fr);gap:12px}${s} .r-price{font-size:27px}}`

const feat = (text: string): string => `<li class="r-feat">${CHECK}<span>${text}</span></li>`

export const PRICING_TWO_SAMPLE: NewSample = {
  id: 'pricing-two',
  category: '料金・プラン',
  name: '料金（2プラン・おすすめつき）',
  summary: 'おすすめの方だけ淡い地にして選びやすく。含まれるものと申し込みボタンつき',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('料金は2つだけ', 'あとから変えられます。解約はいつでもできます。') +
      '<div class="r-grid">' +
      '<div class="r-plan r-plan--pick"><span class="r-badge">いちばん選ばれています</span>' +
      '<h3 class="r-name">まとめてプラン（12か月）</h3>' +
      '<p class="r-price r-price--pick">2,980<span class="r-unit">円／月</span></p>' +
      '<p class="r-sub">1日あたり約99円。初回は半額。</p>' +
      '<ul class="r-feats">' +
      feat('送料無料でお届け') +
      feat('30日間の返品保証') +
      feat('チャット相談し放題') +
      '</ul>' +
      '<a class="r-btn" href="ooooo">このプランではじめる</a></div>' +
      '<div class="r-plan"><h3 class="r-name">おためしプラン（1か月）</h3>' +
      '<p class="r-price">3,980<span class="r-unit">円／月</span></p>' +
      '<p class="r-sub">まず1か月だけ試したい方に。</p>' +
      '<ul class="r-feats">' +
      feat('送料無料でお届け') +
      feat('30日間の返品保証') +
      '</ul>' +
      '<a class="r-btn r-btn--quiet" href="ooooo">1か月だけ試す</a></div>' +
      '</div>' +
      '<p class="r-note">※価格は税込みです。表示は2026年3月時点のものです。</p>',
  }),
}
