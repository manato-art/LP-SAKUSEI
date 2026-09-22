/**
 * 型「お悩みチェック」（2026-09-22・ノーコードでWidgetを作る③）。
 *
 * 「こんなお悩みありませんか？」＋チェックの印つきの項目＋下のまとめ。
 * 印は固定のSVG（絵文字にしない）。印と文字は別々の要素に包む
 * （flexの中に生の文字を置くと、折り返したとき1語ずつに砕ける＝ui-forge flex-grid-anonymous-item）。
 */
import { baseCss, esc, safeColor, shade, titleHtml, wrapWidget } from './kit.ts'
import { ACCENT_PRESETS, items, str, type NocodeTemplate } from './types.ts'

const CHECK =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" fill="none" stroke="currentColor" stroke-width="2"/>' +
  '<path d="M7 12.5l3.2 3.2L17.5 8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'

export const CHECKLIST_TEMPLATE: NocodeTemplate = {
  id: 'checklist',
  name: 'お悩みチェック',
  summary: '「こんなお悩みありませんか？」と、当てはまる項目をチェックの印で並べます',
  icon:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="3" y="4" width="6" height="6" rx="1.5"/><path d="M4.5 7l1.2 1.2L8 5.8M12 7h9"/>' +
    '<rect x="3" y="14" width="6" height="6" rx="1.5"/><path d="M4.5 17l1.2 1.2L8 15.8M12 17h9"/></svg>',
  fields: [
    { kind: 'text', key: 'title', label: '見出し', placeholder: 'こんなお悩みありませんか？', note: '空にすると出しません' },
    {
      kind: 'list',
      key: 'items',
      label: 'お悩み',
      itemLabel: 'お悩み',
      min: 1,
      max: 10,
      fields: [{ kind: 'text', key: 'text', label: '文', placeholder: '朝はいつもバタバタしてしまう' }],
      newItem: () => ({ text: '' }),
    },
    { kind: 'text', key: 'closing', label: '下のまとめ', note: '空にすると出しません' },
    { kind: 'color', key: 'color', label: '印の色', presets: ACCENT_PRESETS },
  ],
  defaults: () => ({
    title: 'こんなお悩みありませんか？',
    items: [
      { text: '朝はいつもバタバタしてしまう' },
      { text: '何を選べばいいのか分からない' },
      { text: '試してみても、なかなか続かない' },
    ],
    closing: 'ひとつでも当てはまったら、ぜひこの先をお読みください',
    color: '#E5573F',
  }),
  validate: (data) => {
    const list = items(data, 'items')
    if (list.length === 0) return 'お悩みを1つ以上入れてください'
    if (list.some((item) => str(item, 'text').trim() === '')) return '空の項目があります。文を書くか、その項目を消してください'
    return null
  },
  render: (data, uid) => {
    const s = `.${uid}`
    const color = safeColor(str(data, 'color'), '#E5573F')

    const css =
      baseCss(s) +
      `${s} .nc-ck__panel{background:#F5F6F8;border-radius:14px;padding:18px 18px 16px}` +
      `${s} .nc-ck__list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}` +
      `${s} .nc-ck__item{display:flex;align-items:flex-start;gap:10px}` +
      `${s} .nc-ck__box{flex:0 0 22px;width:22px;height:22px;margin-top:2px;color:${shade(color, -0.15)}}` +
      `${s} .nc-ck__box svg{width:100%;height:100%;display:block}` +
      `${s} .nc-ck__text{min-width:0;font-size:15.5px;font-weight:700;line-height:1.6}` +
      `${s} .nc-ck__closing{margin:18px 0 0;text-align:center;font-size:16px;font-weight:800;line-height:1.6;` +
      `color:${shade(color, -0.35)};text-wrap:balance}`

    const list = items(data, 'items')
      .map(
        (item) =>
          `<li class="nc-ck__item"><span class="nc-ck__box">${CHECK}</span>` +
          `<span class="nc-ck__text">${esc(str(item, 'text').trim())}</span></li>`,
      )
      .join('')
    const closing = str(data, 'closing').trim()
    const body =
      titleHtml(str(data, 'title')) +
      `<div class="nc-ck__panel"><ul class="nc-ck__list">${list}</ul></div>` +
      (closing === '' ? '' : `<p class="nc-ck__closing">${esc(closing)}</p>`)
    return wrapWidget({ uid, type: 'checklist', css, body })
  },
}
