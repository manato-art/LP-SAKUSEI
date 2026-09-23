/**
 * 新しい見本「画像と説明の縦並び（3件）」（2026-09-23）。
 *
 * 写真・見出し・説明を1組にして、上から3つ積む区画（同梱物やセット内容の紹介に使う）。
 * 左右交互の形（image-text）と違い、狭い画面でも並びが変わらないので読み順が崩れない。
 */
import { IMAGE_PLACEHOLDER, INK_SUB, LINE_LIGHT, head, headCss, sampleHtml, type NewSample } from './kit.ts'

const UID = 'nc-c0000011'
const ACCENT = '#1F7AE0'
const s = `.${UID}`

const CSS =
  headCss(UID) +
  `${s} .y-list{max-width:560px;margin:0 auto;border-top:1px solid ${LINE_LIGHT}}` +
  `${s} .y-item{padding:22px 0;border-bottom:1px solid ${LINE_LIGHT}}` +
  `${s} .y-item img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:4px}` +
  `${s} .y-no{display:block;margin:14px 0 3px;font-size:12px;font-weight:800;letter-spacing:.06em;color:${ACCENT}}` +
  `${s} .y-head{font-size:16.5px;font-weight:800;line-height:1.55;margin:0 0 6px}` +
  `${s} .y-text{font-size:14.5px;line-height:1.9;color:${INK_SUB}}` +
  `@media (max-width:480px){${s} .y-item{padding:18px 0}${s} .y-head{font-size:15.5px}${s} .y-text{font-size:14px}}`

const item = (no: string, title: string, text: string, alt: string): string =>
  `<li class="y-item"><img src="${IMAGE_PLACEHOLDER}" alt="${alt}">` +
  `<span class="y-no">${no}</span><h3 class="y-head">${title}</h3><p class="y-text">${text}</p></li>`

export const IMAGE_CAPTION_LIST_SAMPLE: NewSample = {
  id: 'image-caption-list',
  category: '画像・動画',
  name: '画像と説明の縦並び（3件）',
  summary: '写真・見出し・説明を1組にして縦に3つ。区切りは細い線だけです',
  html: sampleHtml({
    uid: UID,
    css: CSS,
    body:
      head('セットの中身', '1つの箱に、次の3点が入っています。追加で買うものはありません。') +
      '<ul class="y-list">' +
      item(
        '01',
        '本体（約120g）',
        '手のひらに収まる大きさです。電池も配線も使わないので、置く場所を選びません。',
        '本体の写真',
      ) +
      item(
        '02',
        '持ち運び用のケース',
        'かばんに入れても中身が出ない形です。旅行や出張のときはこちらに入れ替えてください。',
        '持ち運び用ケースの写真',
      ) +
      item(
        '03',
        '使い方の冊子（12ページ）',
        '1日目・1週間目・1か月目にすることを、写真つきで載せています。字は大きめです。',
        '使い方の冊子の写真',
      ) +
      '</ul>',
  }),
}
