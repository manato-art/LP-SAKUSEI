/**
 * 新しい見本「違いを2つ並べて説明」（2026-09-23）。
 *
 * 左が「これまでのやり方」、右が「このサービス」。同じ箱を2つ反復させないよう、
 * 左は細い上線だけ・右は淡い地だけにして、見た目の重さを変えている（強調のやり方は面の淡色に統一）。
 * 狭い画面では左が上、右が下に縦積みになる。
 */
import { CHECK, INK, INK_SUB, LINE, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-d0000011'
const ACCENT = '#1F7AE0'
const TINT = '#F1F6FD'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .p-pair{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.12fr);gap:18px;` +
  `align-items:start;max-width:620px;margin:0 auto}` +
  `${s} .p-col{min-width:0}` +
  `${s} .p-col--old{padding:16px 2px 20px;border-top:1px solid ${LINE}}` +
  `${s} .p-col--new{padding:20px 18px 24px;background:${TINT}}` +
  `${s} .p-tag{font-size:12px;font-weight:800;letter-spacing:.06em;line-height:1.7;color:${INK_SUB};margin:0 0 6px}` +
  `${s} .p-head{font-size:16.5px;font-weight:800;line-height:1.6;color:${INK};margin:0 0 12px}` +
  `${s} .p-list li{font-size:14px;line-height:1.85;color:${INK_SUB}}` +
  `${s} .p-list li+li{margin-top:9px}` +
  `${s} .p-list--old li{position:relative;padding-left:16px}` +
  `${s} .p-list--old li::before{content:"";position:absolute;left:0;top:.86em;width:8px;height:1px;background:#A8B0BA}` +
  `${s} .p-list--new li{display:grid;grid-template-columns:18px minmax(0,1fr);gap:8px;align-items:start;color:${INK}}` +
  `${s} .p-ic{display:block;margin-top:4px;color:${ACCENT}}` +
  `${s} .p-ic svg{width:15px;height:15px;display:block}` +
  `${s} .p-note{max-width:620px;margin:16px auto 0;font-size:12px;line-height:1.75;color:${INK_SUB}}` +
  `@media (max-width:560px){${s} .p-pair{grid-template-columns:minmax(0,1fr);gap:16px}` +
  `${s} .p-col--new{padding:18px 15px 20px}${s} .p-head{font-size:15.5px}}`

const oldItem = (text: string): string => `<li>${text}</li>`
const newItem = (text: string): string => `<li><span class="p-ic" aria-hidden="true">${CHECK}</span><span>${text}</span></li>`

export const COMPARE_CARDS_SAMPLE: NewSample = {
  id: 'compare-cards',
  category: '比較・違い',
  name: '違いを2つ並べて説明',
  summary: '左右に2つ並べて違いを説明します。片方だけ淡い地にします',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('いままでと、どこが違うのか', '同じ仕事を、どう進めることになるかを並べました。') +
      '<div class="p-pair">' +
      '<div class="p-col p-col--old"><p class="p-tag">これまでのやり方</p>' +
      '<h3 class="p-head">同じ内容を、何度も書き写していました</h3>' +
      '<ul class="p-list p-list--old">' +
      oldItem('1件を仕上げるのに45分かかっていました。') +
      oldItem('書き写しのまちがいが、1か月に18件ありました。') +
      oldItem('担当の方が休むと、その日は先に進みませんでした。') +
      '</ul></div>' +
      '<div class="p-col p-col--new"><p class="p-tag">このサービス</p>' +
      '<h3 class="p-head">入力は最初の1回だけで済みます</h3>' +
      '<ul class="p-list p-list--new">' +
      newItem('1件あたり14分で仕上がります。') +
      newItem('書き写しがなくなり、まちがいは1か月2件まで減りました。') +
      newItem('手順が画面に出るので、はじめての方でも同じように進められます。') +
      '</ul></div>' +
      '</div>' +
      '<p class="p-note">※従業員12名の1社の記録です（2026年1月〜3月・自社調べ）。ご利用の状況によって結果は変わります。</p>',
  }),
}
