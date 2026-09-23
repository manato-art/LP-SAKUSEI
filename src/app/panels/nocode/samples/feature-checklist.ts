/**
 * 新しい見本「できること一覧（8項目）」（2026-09-23）。
 *
 * 対応している項目を8つ、短い言葉のまま2列に流す区画。
 * 項目ごとに箱を作ると8個の反復になるので、区切りは細い線1本だけにする（ui-forge anti-ai-look）。
 */
import { CHECK, INK, INK_SUB, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-b0000007'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .ck-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:36px;` +
  `max-width:660px;margin:0 auto}` +
  `${s} .ck-item{display:flex;align-items:flex-start;gap:10px;min-width:0;padding:12px 0;` +
  `border-bottom:1px solid ${LINE_LIGHT};font-size:14.5px;line-height:1.75;color:${INK}}` +
  `${s} .ck-item svg{flex:0 0 15px;width:15px;height:15px;margin-top:5px;color:${ACCENT}}` +
  `${s} .ck-sub{color:${INK_SUB};font-size:13px}` +
  `${s} .ck-note{max-width:660px;margin:18px auto 0;font-size:12px;line-height:1.7;color:${INK_SUB};text-align:center}` +
  `@media (max-width:560px){${s} .ck-list{grid-template-columns:minmax(0,1fr);column-gap:0}` +
  `${s} .ck-item{padding:11px 0;font-size:14px}}`

const line = (text: string, sub = ''): string =>
  `<li class="ck-item">${CHECK}<span>${text}` +
  (sub === '' ? '' : `<span class="ck-sub">（${sub}）</span>`) +
  '</span></li>'

export const FEATURE_CHECKLIST_SAMPLE: NewSample = {
  id: 'feature-checklist',
  category: '特徴・価値',
  name: 'できること一覧（8項目）',
  summary: '対応している項目を8つ、印つきで2列に。区切りは細い線だけです',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('できること一覧', 'どのプランでも、下の8つはすべてお使いいただけます。') +
      '<ul class="ck-list">' +
      line('予約の受け付け', '24時間') +
      line('前日のお知らせ', 'メール・SMS') +
      line('売上の集計', '日ごと・月ごと') +
      line('会員カードの発行', '1,000枚まで') +
      line('スタッフの登録', '5名まで') +
      line('データの書き出し', 'CSV') +
      line('スマートフォンからの操作') +
      line('チャットでの相談', '平日9時〜18時') +
      '</ul>' +
      '<p class="ck-note">※お申し込みの翌営業日から、すべての項目をお使いいただけます。</p>',
  }),
}
