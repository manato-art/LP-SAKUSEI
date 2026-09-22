/**
 * 型「よくある質問」（2026-09-22・ノーコードでWidgetを作る③）。
 *
 * 1問ずつ開け閉めできる（<details>）。スクリプトは使わない（どのブラウザでも動き、読み上げにも対応）。
 * 箱を並べず、1問ごとに細い線で区切る（ui-forge anti-ai-look：同じ箱の繰り返しを避ける）。
 * 並んだ1問は Widget編集の「複製・上へ・下へ・消す」（②）でそのまま増やせる。
 */
import { baseCss, esc, safeColor, shade, textHtml, titleHtml, wrapWidget } from './kit.ts'
import { ACCENT_PRESETS, bool, items, str, type NocodeTemplate } from './types.ts'

export const FAQ_TEMPLATE: NocodeTemplate = {
  id: 'faq',
  name: 'よくある質問',
  summary: '質問を押すと答えが開きます。質問はいくつでも足せます',
  icon:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M4 6h16M4 12h16M4 18h10"/><path d="M18 16l2 2 2-2"/></svg>',
  fields: [
    { kind: 'text', key: 'title', label: '見出し', placeholder: 'よくある質問', note: '空にすると出しません' },
    {
      kind: 'list',
      key: 'items',
      label: '質問と答え',
      itemLabel: '質問',
      min: 1,
      max: 20,
      fields: [
        { kind: 'text', key: 'q', label: '質問', placeholder: '送料はかかりますか？' },
        { kind: 'textarea', key: 'a', label: '答え', rows: 3 },
      ],
      newItem: () => ({ q: '', a: '' }),
    },
    { kind: 'toggle', key: 'openFirst', label: '最初の質問は開いておく' },
    { kind: 'color', key: 'color', label: '「Q」の色', presets: ACCENT_PRESETS },
  ],
  defaults: () => ({
    title: 'よくある質問',
    items: [
      { q: '送料はかかりますか？', a: '全国どこでも送料無料でお届けします。' },
      { q: '届くまでにどれくらいかかりますか？', a: 'ご注文から2〜4日でお届けします。\nお届け日の指定もできます。' },
      { q: '解約はいつでもできますか？', a: 'はい。マイページから、いつでも1分ほどで手続きできます。' },
    ],
    openFirst: false,
    color: '#E5573F',
  }),
  validate: (data) => {
    const list = items(data, 'items')
    if (list.length === 0) return '質問を1つ以上入れてください'
    if (list.some((item) => str(item, 'q').trim() === '')) return '空の質問があります。質問を書くか、その質問を消してください'
    return null
  },
  render: (data, uid) => {
    const s = `.${uid}`
    const color = safeColor(str(data, 'color'), '#E5573F')
    const markColor = shade(color, -0.2)

    const css =
      baseCss(s) +
      `${s} .nc-faq__list{border-bottom:1px solid #E3E6EA}` +
      `${s} .nc-faq__item{border-top:1px solid #E3E6EA}` +
      `${s} .nc-faq__q{display:block;list-style:none;cursor:pointer;padding:16px 4px;-webkit-tap-highlight-color:transparent}` +
      `${s} .nc-faq__q::-webkit-details-marker{display:none}` +
      `${s} .nc-faq__q:focus-visible{outline:2px solid ${markColor};outline-offset:2px}` +
      `${s} .nc-faq__row{display:grid;grid-template-columns:26px minmax(0,1fr) 18px;gap:10px;align-items:start}` +
      `${s} .nc-faq__mark{font-size:18px;font-weight:800;line-height:1.45;color:${markColor}}` +
      `${s} .nc-faq__mark--a{color:#8A94A3}` +
      `${s} .nc-faq__qtext{font-size:15.5px;font-weight:700;line-height:1.6}` +
      // ＋ と − は線で描く（絵文字や記号の文字にしない）
      `${s} .nc-faq__icon{position:relative;width:18px;height:18px;margin-top:4px}` +
      `${s} .nc-faq__icon::before,${s} .nc-faq__icon::after{content:"";position:absolute;left:3px;right:3px;top:8px;height:2px;` +
      `border-radius:1px;background:#8A94A3;transition:transform .2s ease,opacity .2s ease}` +
      `${s} .nc-faq__icon::after{transform:rotate(90deg)}` +
      `${s} .nc-faq__item[open] .nc-faq__icon::after{transform:rotate(0deg);opacity:0}` +
      `${s} .nc-faq__a{display:grid;grid-template-columns:26px minmax(0,1fr);gap:10px;padding:0 4px 18px}` +
      `${s} .nc-faq__atext{font-size:14.5px;line-height:1.8;color:#3A4452}` +
      `@media (prefers-reduced-motion:reduce){${s} .nc-faq__icon::before,${s} .nc-faq__icon::after{transition:none}}`

    const openFirst = bool(data, 'openFirst')
    const list = items(data, 'items')
      .map((item, i) => {
        const open = openFirst && i === 0 ? ' open' : ''
        return (
          `<details class="nc-faq__item"${open}>` +
          `<summary class="nc-faq__q"><span class="nc-faq__row"><span class="nc-faq__mark">Q</span>` +
          `<span class="nc-faq__qtext">${esc(str(item, 'q').trim())}</span><span class="nc-faq__icon" aria-hidden="true"></span></span></summary>` +
          `<div class="nc-faq__a"><span class="nc-faq__mark nc-faq__mark--a">A</span>` +
          `<p class="nc-faq__atext">${textHtml(str(item, 'a'))}</p></div>` +
          `</details>`
        )
      })
      .join('')
    const body = titleHtml(str(data, 'title')) + `<div class="nc-faq__list">${list}</div>`
    return wrapWidget({ uid, type: 'faq', css, body })
  },
}
