/**
 * 型「お客様の声」（2026-09-22・ノーコードでWidgetを作る③）。
 *
 * ひとこと（太字）＋本文＋お名前・属性＋星＋写真。最後に注意書き（「※個人の感想です」など）。
 * 同じ箱を並べず、大きな引用符と細い線で区切る（ui-forge anti-ai-look）。
 * 星は飾りの文字なので琥珀色でよい（contrast-discipline の例外）。読み上げでは「5段階中4」と伝える。
 */
import { baseCss, esc, safeColor, safeImage, shade, textHtml, titleHtml, wrapWidget } from './kit.ts'
import { ACCENT_PRESETS, items, pick, str, type ItemData, type NocodeTemplate } from './types.ts'
import { RATING_ICONS } from './option-icons.ts'

const RATINGS = ['5', '4', '3', 'none'] as const

/** 写真が無いときの人の形（固定のSVG） */
const SILHOUETTE =
  '<svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="22" fill="#E3E6EA"/>' +
  '<circle cx="22" cy="17" r="7" fill="#AEB6C1"/><path d="M8 38c2.5-7 8-10 14-10s11.5 3 14 10" fill="#AEB6C1"/></svg>'

function stars(rating: (typeof RATINGS)[number]): string {
  if (rating === 'none') return ''
  const n = Number(rating)
  return `<span class="nc-rv__stars" role="img" aria-label="5段階中${n}">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span>`
}

function review(item: ItemData): string {
  const image = safeImage(str(item, 'image'))
  const avatar = image === '' ? SILHOUETTE : `<img src="${image}" alt="">`
  const headline = str(item, 'headline').trim()
  return (
    `<figure class="nc-rv__item">` +
    `<blockquote class="nc-rv__quote">` +
    (headline === '' ? '' : `<p class="nc-rv__head">${esc(headline)}</p>`) +
    `<p class="nc-rv__body">${textHtml(str(item, 'body'))}</p>` +
    `</blockquote>` +
    `<figcaption class="nc-rv__who"><span class="nc-rv__avatar">${avatar}</span>` +
    `<span class="nc-rv__meta"><span class="nc-rv__name">${esc(str(item, 'name').trim())}</span>` +
    `${stars(pick(item, 'rating', RATINGS, '5'))}</span></figcaption>` +
    `</figure>`
  )
}

export const REVIEWS_TEMPLATE: NocodeTemplate = {
  id: 'reviews',
  name: 'お客様の声',
  summary: '口コミを写真・星・お名前と一緒に並べます。注意書きも付けられます',
  icon:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M4 5h16v10H9l-4 4v-4H4z"/><path d="M8 9h8M8 12h5"/></svg>',
  fields: [
    { kind: 'text', key: 'title', label: '見出し', placeholder: 'お客様の声', note: '空にすると出しません' },
    {
      kind: 'list',
      key: 'items',
      label: '口コミ',
      itemLabel: '口コミ',
      min: 1,
      max: 12,
      fields: [
        { kind: 'text', key: 'headline', label: 'ひとこと（太字）', placeholder: '朝の支度が10分早くなりました' },
        { kind: 'textarea', key: 'body', label: '本文', rows: 3 },
        { kind: 'text', key: 'name', label: 'お名前・属性', placeholder: '30代・女性' },
        {
          kind: 'select',
          key: 'rating',
          label: '星',
          options: [
            { value: '5', label: '星5つ', short: '5', icon: RATING_ICONS['5'] },
            { value: '4', label: '星4つ', short: '4', icon: RATING_ICONS['4'] },
            { value: '3', label: '星3つ', short: '3', icon: RATING_ICONS['3'] },
            { value: 'none', label: '出さない', icon: RATING_ICONS.none },
          ],
        },
        { kind: 'image', key: 'image', label: '写真（無ければ人の形のアイコン）' },
      ],
      newItem: () => ({ headline: '', body: '', name: '', rating: '5', image: '' }),
    },
    { kind: 'text', key: 'note', label: '注意書き', note: '空にすると出しません' },
    { kind: 'color', key: 'color', label: '引用符の色', presets: ACCENT_PRESETS },
  ],
  defaults: () => ({
    title: 'お客様の声',
    items: [
      {
        headline: '朝の支度が10分早くなりました',
        body: '使い始めて2週間。迷う時間が減って、子どもを送り出すまでがとても楽になりました。',
        name: '30代・女性',
        rating: '5',
        image: '',
      },
      {
        headline: '続けやすいのがいちばん',
        body: '三日坊主の私でも、気づけば3か月続いています。',
        name: '40代・男性',
        rating: '4',
        image: '',
      },
    ],
    note: '※個人の感想であり、効果を保証するものではありません。',
    color: '#E5573F',
  }),
  validate: (data) => {
    const list = items(data, 'items')
    if (list.length === 0) return '口コミを1つ以上入れてください'
    if (list.some((item) => str(item, 'body').trim() === '' && str(item, 'headline').trim() === '')) {
      return '中身が空の口コミがあります。ひとことか本文を書くか、その口コミを消してください'
    }
    return null
  },
  render: (data, uid) => {
    const s = `.${uid}`
    const color = safeColor(str(data, 'color'), '#E5573F')

    const css =
      baseCss(s) +
      `${s} .nc-rv__list{display:flex;flex-direction:column}` +
      `${s} .nc-rv__item{margin:0;padding:22px 4px;border-top:1px solid #E3E6EA}` +
      `${s} .nc-rv__item:last-child{border-bottom:1px solid #E3E6EA}` +
      `${s} .nc-rv__quote{position:relative;margin:0;padding:0 0 0 34px}` +
      // 大きな引用符（文字の “ 。絵文字ではない）
      `${s} .nc-rv__quote::before{content:"\\201C";position:absolute;left:0;top:-10px;font-size:48px;line-height:1;` +
      `font-family:Georgia,"Times New Roman",serif;color:${shade(color, -0.1)}}` +
      `${s} .nc-rv__head{font-size:17px;font-weight:800;line-height:1.55;margin:0 0 6px;text-wrap:balance}` +
      `${s} .nc-rv__body{font-size:14.5px;line-height:1.85;color:#3A4452}` +
      `${s} .nc-rv__who{display:flex;align-items:center;gap:12px;margin:14px 0 0 34px}` +
      `${s} .nc-rv__avatar{flex:0 0 44px;width:44px;height:44px;border-radius:50%;overflow:hidden;background:#E3E6EA}` +
      `${s} .nc-rv__avatar img,${s} .nc-rv__avatar svg{width:100%;height:100%;object-fit:cover;display:block}` +
      `${s} .nc-rv__meta{display:flex;flex-direction:column;min-width:0}` +
      `${s} .nc-rv__name{font-size:13px;font-weight:700;color:#3A4452}` +
      `${s} .nc-rv__stars{font-size:14px;letter-spacing:.08em;color:#E0A100;line-height:1.4}` +
      `${s} .nc-rv__note{margin:14px 0 0;font-size:11.5px;line-height:1.7;color:#6B7480}`

    const note = str(data, 'note').trim()
    const body =
      titleHtml(str(data, 'title')) +
      `<div class="nc-rv__list">${items(data, 'items').map(review).join('')}</div>` +
      (note === '' ? '' : `<p class="nc-rv__note">${esc(note)}</p>`)
    return wrapWidget({ uid, type: 'reviews', css, body })
  },
}
