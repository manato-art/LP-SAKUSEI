/**
 * 新しい見本「受賞・認定バッジ4つ」（2026-09-23）。
 *
 * 裏づけを短い言葉で4つ。写真やロゴは使わず、丸い枠と文字だけで作る（外から何も読み込まない）。
 * 色は1色とその淡色まで。狭い画面では2列2段に畳む。
 */
import { INK_SUB, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-b0000005'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .bd-list{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px;` +
  `max-width:680px;margin:0 auto}` +
  `${s} .bd-item{min-width:0;text-align:center}` +
  `${s} .bd-circle{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;` +
  `width:100%;max-width:140px;aspect-ratio:1/1;margin:0 auto;padding:10px;` +
  `border:1.5px solid #BFD7F4;border-radius:50%;background:#F5F9FE}` +
  `${s} .bd-top{font-size:11.5px;font-weight:700;line-height:1.5;color:${INK_SUB}}` +
  `${s} .bd-main{font-size:17px;font-weight:800;line-height:1.4;color:${ACCENT};letter-spacing:-.01em}` +
  `${s} .bd-cap{display:block;margin-top:10px;font-size:12px;line-height:1.65;color:${INK_SUB}}` +
  `${s} .bd-note{max-width:680px;margin:20px auto 0;font-size:12px;line-height:1.7;color:${INK_SUB};text-align:center}` +
  `@media (max-width:560px){${s} .bd-list{grid-template-columns:repeat(2,minmax(0,1fr));gap:22px 16px}` +
  `${s} .bd-circle{max-width:150px}${s} .bd-main{font-size:16px}}`

const badge = (top: string, main: string, cap: string): string =>
  `<li class="bd-item"><span class="bd-circle"><span class="bd-top">${top}</span>` +
  `<span class="bd-main">${main}</span></span><span class="bd-cap">${cap}</span></li>`

export const FEATURE_BADGES_SAMPLE: NewSample = {
  id: 'feature-badges',
  category: '特徴・価値',
  name: '受賞・認定バッジ4つ',
  summary: '丸い枠に短い言葉だけ。写真を使わずに裏づけを4つ並べます',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('たしかな裏づけ', '調査の結果と、社内で決めている取り組みをまとめました。') +
      '<ul class="bd-list">' +
      badge('満足度', 'No.1', '同価格帯のサービス6社との比較') +
      badge('継続率', '94%', 'お申し込みから3か月時点') +
      badge('品質', '認証取得', '国内の自社工場で生産') +
      badge('相談', '年中無休', 'チャットで毎日受け付け') +
      '</ul>' +
      '<p class="bd-note">※2026年3月・当社調べ（回答1,043件）。表示している内容は見本です。</p>',
  }),
}
