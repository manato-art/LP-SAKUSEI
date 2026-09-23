/**
 * 新しい見本「手順を箇条書き（番号）」（2026-09-23）。
 *
 * 1回ぶんの手順を5つに分けて、上から順に読ませる区画。番号は輪郭だけの丸、区切りは細い線。
 * 「ご利用の流れ」（申し込み〜到着）とは違い、手に取ったあとの動きを書くところ。
 */
import { INK_SUB, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-c0000005'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .z-list{max-width:600px;margin:0 auto;border-top:1px solid ${LINE_LIGHT}}` +
  `${s} .z-item{display:grid;grid-template-columns:30px minmax(0,1fr);gap:14px;align-items:start;` +
  `padding:14px 2px;border-bottom:1px solid ${LINE_LIGHT}}` +
  `${s} .z-no{display:flex;width:30px;height:30px;align-items:center;justify-content:center;` +
  `border:2px solid ${ACCENT};border-radius:50%;color:${ACCENT};font-size:14px;font-weight:800;line-height:1;` +
  `font-variant-numeric:tabular-nums}` +
  `${s} .z-text{font-size:14.5px;line-height:1.9;padding-top:3px}` +
  `${s} .z-lead{font-weight:800}` +
  `${s} .z-note{max-width:600px;margin:16px auto 0;font-size:12px;line-height:1.8;color:${INK_SUB}}` +
  `@media (max-width:480px){${s} .z-item{grid-template-columns:26px minmax(0,1fr);gap:11px}` +
  `${s} .z-no{width:26px;height:26px;font-size:13px}${s} .z-text{font-size:14px;padding-top:2px}}`

const line = (no: number, lead: string, text: string): string =>
  `<li class="z-item"><span class="z-no">${no}</span>` +
  `<span class="z-text"><span class="z-lead">${lead}</span>${text}</span></li>`

export const HOWTO_NUMBERED_SAMPLE: NewSample = {
  id: 'howto-numbered',
  category: '説明・使い方',
  name: '手順を箇条書き（番号）',
  summary: '1回ぶんの手順を5つに。番号は丸、区切りは線だけの読みやすい形です',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('使い方（5つの手順）', '1回にかかる時間は30秒ほどです。順番どおりに進めてください。') +
      '<ul class="z-list">' +
      line(1, '手を洗います。', 'ぬれたままにせず、清潔なタオルで水気をふき取ってください。') +
      line(2, 'キャップを外します。', '1回分は約2ml（ペットボトルのふた半分ほど）が目安です。') +
      line(3, '気になるところからつけます。', '広いところから順に、指の腹でやさしくなじませてください。') +
      line(4, '30秒ほどそのままおきます。', 'そのあと、いつもの手入れに進んでかまいません。') +
      line(5, 'キャップを閉めて片づけます。', '直射日光の当たらない、涼しいところで保管してください。') +
      '</ul>' +
      '<p class="z-note">はじめて使う日は、少ない量から試してください。回数を増やす必要はありません。</p>',
  }),
}
