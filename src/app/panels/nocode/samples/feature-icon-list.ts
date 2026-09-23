/**
 * 新しい見本「印つきの特徴6つ」（2026-09-23）。
 *
 * 細かい説明に入る前に、要点だけ6つ先に渡す区画。印（固定SVG）を行頭に置き、2列に流す。
 * 1項目ずつ箱に入れると6個の反復になるので、区切りは細い線だけにする（ui-forge anti-ai-look）。
 */
import { CHECK, INK, INK_SUB, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-b0000002'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .fi-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:32px;` +
  `max-width:680px;margin:0 auto;border-top:1px solid ${LINE_LIGHT}}` +
  `${s} .fi-item{display:flex;align-items:flex-start;gap:11px;min-width:0;padding:15px 0;` +
  `border-bottom:1px solid ${LINE_LIGHT}}` +
  `${s} .fi-item svg{flex:0 0 17px;width:17px;height:17px;margin-top:5px;color:${ACCENT}}` +
  `${s} .fi-body{min-width:0;font-size:14.5px;line-height:1.85;color:${INK_SUB}}` +
  `${s} .fi-name{display:block;font-size:15px;font-weight:800;line-height:1.6;color:${INK};margin:0 0 2px}` +
  `${s} .fi-note{max-width:680px;margin:16px auto 0;font-size:12px;line-height:1.7;color:${INK_SUB};text-align:center}` +
  `@media (max-width:560px){${s} .fi-list{grid-template-columns:minmax(0,1fr);column-gap:0}` +
  `${s} .fi-item{padding:13px 0}${s} .fi-body{font-size:14px}}`

const row = (name: string, text: string): string =>
  `<li class="fi-item">${CHECK}<span class="fi-body"><b class="fi-name">${name}</b>${text}</span></li>`

export const FEATURE_ICON_LIST_SAMPLE: NewSample = {
  id: 'feature-icon-list',
  category: '特徴・価値',
  name: '印つきの特徴6つ',
  summary: '要点を6つ、印つきで2列に。箱で囲まず細い線だけで区切ります',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('はじめに、要点を6つ', '細かい説明の前に、よくいただくご質問への答えをまとめました。') +
      '<ul class="fi-list">' +
      row('初期費用は0円です', '月々2,980円のほかに、登録料や事務手数料はいただきません。') +
      row('最短3日でお届けします', 'ご注文の翌営業日に発送し、お住まいの地域へ3日以内にお届けします。') +
      row('相談はチャットで受け付けます', '平日9時から18時まで、担当者が順にお返事いたします。') +
      row('プランは月1回変えられます', 'マイページから切り替えられます。差額のご請求は翌月分からです。') +
      row('解約はいつでもできます', '違約金はいただきません。次回発送の5日前までにお知らせください。') +
      row('30日間は返品できます', '開封後でも理由を問わず受け付けます。返送の送料は当社が負担します。') +
      '</ul>' +
      '<p class="fi-note">※価格はすべて税込みです。2026年3月時点の内容です。</p>',
  }),
}
