/**
 * 型「ご利用の流れ」（2026-09-22・ノーコードでWidgetを作る③）。
 *
 * 丸い番号（STEP 01）＋題名＋説明＋写真（任意）を縦につなぐ。番号は並びの順番そのものなので付ける。
 * 番号の数字は別の文字（<span class="nc-st__num">）にしてあり、Widget編集で手順を複製・並べ替えると
 * 自動で 01, 02… と付け直される（② serial-numbers）。
 * つなぎの線は色を付けない点線（色付きの左線に見せない）。
 */
import { baseCss, esc, inkOn, safeColor, safeImage, shade, textHtml, titleHtml, wrapWidget } from './kit.ts'
import { ACCENT_PRESETS, items, str, type ItemData, type NocodeTemplate } from './types.ts'

function step(item: ItemData, index: number, label: string): string {
  const image = safeImage(str(item, 'image'))
  const body = str(item, 'body').trim()
  return (
    `<li class="nc-st__item">` +
    `<span class="nc-st__badge" aria-hidden="true">` +
    (label === '' ? '' : `<span class="nc-st__label">${esc(label)}</span>`) +
    `<span class="nc-st__num">${String(index + 1).padStart(2, '0')}</span></span>` +
    `<div class="nc-st__content">` +
    `<h3 class="nc-st__title">${esc(str(item, 'title').trim())}</h3>` +
    (body === '' ? '' : `<p class="nc-st__body">${textHtml(body)}</p>`) +
    (image === '' ? '' : `<img class="nc-st__img" src="${image}" alt="">`) +
    `</div></li>`
  )
}

export const STEPS_TEMPLATE: NocodeTemplate = {
  id: 'steps',
  name: 'ご利用の流れ',
  summary: '申し込みから届くまでの手順を、番号つきで縦につなげて見せます',
  icon:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="6" cy="5" r="2.5"/><circle cx="6" cy="19" r="2.5"/><path d="M6 7.5v9" stroke-dasharray="2 2"/><path d="M11 5h9M11 19h9"/></svg>',
  fields: [
    { kind: 'text', key: 'title', label: '見出し', placeholder: 'ご利用の流れ', note: '空にすると出しません' },
    { kind: 'text', key: 'label', label: '番号の上の文字', placeholder: 'STEP', note: '空にすると数字だけになります' },
    {
      kind: 'list',
      key: 'items',
      label: '手順',
      itemLabel: '手順',
      min: 2,
      max: 8,
      fields: [
        { kind: 'text', key: 'title', label: '題名', placeholder: 'お申し込み' },
        { kind: 'textarea', key: 'body', label: '説明', rows: 2 },
        { kind: 'image', key: 'image', label: '写真（任意）' },
      ],
      newItem: () => ({ title: '', body: '', image: '' }),
    },
    { kind: 'color', key: 'color', label: '番号の色', presets: ACCENT_PRESETS },
  ],
  defaults: () => ({
    title: 'ご利用の流れ',
    label: 'STEP',
    items: [
      { title: 'お申し込み', body: 'このページのボタンから、1分ほどでお申し込みいただけます。', image: '' },
      { title: 'お届け', body: 'ご注文から2〜4日でお届けします。', image: '' },
      { title: 'ご使用開始', body: '届いたその日から使えます。分からないことはチャットでご相談ください。', image: '' },
    ],
    color: '#E5573F',
  }),
  validate: (data) => {
    const list = items(data, 'items')
    if (list.length < 2) return '手順を2つ以上入れてください'
    if (list.some((item) => str(item, 'title').trim() === '')) return '題名が空の手順があります。題名を書くか、その手順を消してください'
    return null
  },
  render: (data, uid) => {
    const s = `.${uid}`
    const color = safeColor(str(data, 'color'), '#E5573F')
    const label = str(data, 'label').trim()

    const css =
      baseCss(s) +
      `${s} .nc-st__list{list-style:none;margin:0;padding:0}` +
      `${s} .nc-st__item{position:relative;display:grid;grid-template-columns:56px minmax(0,1fr);gap:16px;padding:0 0 26px}` +
      `${s} .nc-st__item:last-child{padding-bottom:0}` +
      // 次の手順へつなぐ点線（色は付けない）
      `${s} .nc-st__item:not(:last-child)::after{content:"";position:absolute;left:27px;top:62px;bottom:6px;` +
      `border-left:2px dotted #C9CFD6}` +
      `${s} .nc-st__badge{width:56px;height:56px;border-radius:50%;background:${color};color:${inkOn(color)};` +
      `display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1;` +
      `box-shadow:0 0 0 4px ${shade(color, 0.85)}}` +
      `${s} .nc-st__label{font-size:9.5px;font-weight:800;letter-spacing:.12em;margin-bottom:2px}` +
      `${s} .nc-st__num{font-size:21px;font-weight:800;font-variant-numeric:tabular-nums}` +
      `${s} .nc-st__content{min-width:0;padding-top:6px}` +
      `${s} .nc-st__title{font-size:17px;font-weight:800;line-height:1.5;margin:0 0 4px}` +
      `${s} .nc-st__body{font-size:14.5px;line-height:1.8;color:#3A4452}` +
      `${s} .nc-st__img{margin-top:12px;border-radius:10px;width:100%}`

    const list = items(data, 'items')
      .map((item, i) => step(item, i, label))
      .join('')
    const body = titleHtml(str(data, 'title')) + `<ol class="nc-st__list">${list}</ol>`
    return wrapWidget({ uid, type: 'steps', css, body })
  },
}
