/**
 * 「部品を積んで作る」（2026-09-22・本人の依頼。ノーコードでWidgetを作る④）。
 *
 * 見出し・文章・画像・ボタン・余白・区切り線・箇条書き・画像と文章 を上から順に積んで、自由にWidgetを作る。
 * Widget全体の背景の色・上下の余白・印の色も選べる。
 *
 * - 部品ごとの色などは、その部品だけのクラス（nc-b-1, nc-b-2…）に書く。Widget編集の②で並べ替えても複製しても、
 *   クラスは部品と一緒に動くので見た目が崩れない
 * - 本文サイズの色文字は暗い色だけを候補にする（ui-forge contrast-discipline）
 * - ボタンは「ボタン」の型と同じ見た目（pressButtonCss）
 * - 書き出しの安全さは「型から作る」と同じ（kit.ts。文字はエスケープ・リンクは使えるものだけ・画像は選んだファイルだけ）
 */
import { ARROW_SVG, pressButtonCss } from './cta.ts'
import { baseCss, esc, linkAttrs, safeColor, safeImage, shade, textHtml, wrapWidget } from './kit.ts'
import { ACCENT_PRESETS, bool, items, pick, str, type BlockType, type ItemData, type NocodeTemplate } from './types.ts'

/** 文字の色の候補（本文にも使えるよう、暗い色だけ） */
const TEXT_PRESETS: readonly string[] = ['#1F2A37', '#B83A26', '#A8264F', '#155BB0', '#0B7A3E', '#8A6414']
/** 背景の色の候補（白と、淡い地） */
const BACKGROUND_PRESETS: readonly string[] = ['#FFFFFF', '#F7F8FA', '#FFF8E7', '#FDF1EE', '#EEF6FF', '#EEF8F1']

const ALIGNS = ['left', 'center'] as const
const ALIGN_OPTIONS = [
  { value: 'left', label: '左に寄せる' },
  { value: 'center', label: '真ん中' },
]
const PADDING: Readonly<Record<string, number>> = { s: 24, m: 40, l: 56 }
const SPACER: Readonly<Record<string, number>> = { s: 16, m: 32, l: 56 }

const svg = (body: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`

const CHECK_MARK =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" ' +
  'stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>'

export const BLOCK_TYPES: readonly BlockType[] = [
  {
    type: 'heading',
    label: '見出し',
    icon: svg('<path d="M6 5v14M18 5v14M6 12h12"/>'),
    fields: [
      { kind: 'text', key: 'text', label: '文字', placeholder: 'はじめての方へ' },
      {
        kind: 'select',
        key: 'size',
        label: '大きさ',
        options: [
          { value: 'l', label: '大' },
          { value: 'm', label: '中' },
          { value: 's', label: '小' },
        ],
      },
      { kind: 'select', key: 'align', label: '寄せ', options: ALIGN_OPTIONS },
      { kind: 'color', key: 'color', label: '文字の色', presets: TEXT_PRESETS },
    ],
    newItem: () => ({ type: 'heading', text: '', size: 'm', align: 'center', color: '#1F2A37' }),
  },
  {
    type: 'text',
    label: '文章',
    icon: svg('<path d="M4 6h16M4 10h16M4 14h16M4 18h10"/>'),
    fields: [
      { kind: 'textarea', key: 'text', label: '文章', rows: 4 },
      {
        kind: 'select',
        key: 'size',
        label: '文字の大きさ',
        options: [
          { value: 'm', label: '標準' },
          { value: 's', label: '小さめ（注意書きなど）' },
        ],
      },
      { kind: 'select', key: 'align', label: '寄せ', options: ALIGN_OPTIONS },
    ],
    newItem: () => ({ type: 'text', text: '', size: 'm', align: 'left' }),
  },
  {
    type: 'image',
    label: '画像',
    icon: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/>'),
    fields: [
      { kind: 'image', key: 'image', label: '画像' },
      { kind: 'text', key: 'alt', label: '画像の説明（読み上げ用）' },
      {
        kind: 'select',
        key: 'width',
        label: '幅',
        options: [
          { value: '100', label: '横いっぱい' },
          { value: '80', label: '少し小さく（8割）' },
          { value: '60', label: '小さく（6割）' },
        ],
      },
      { kind: 'toggle', key: 'round', label: '角を丸くする' },
      { kind: 'url', key: 'url', label: '押したときに開くページ（任意）', placeholder: 'https://' },
    ],
    newItem: () => ({ type: 'image', image: '', alt: '', width: '100', round: false, url: '' }),
  },
  {
    type: 'button',
    label: 'ボタン',
    icon: svg('<rect x="3" y="8" width="18" height="8" rx="4"/><path d="M13 12h4"/>'),
    fields: [
      { kind: 'text', key: 'label', label: 'ボタンの文字', placeholder: '今すぐ申し込む', maxLength: 40 },
      { kind: 'url', key: 'url', label: '押したときに開くページ', placeholder: 'https://' },
      { kind: 'toggle', key: 'track', label: 'クリック数をレポートで数える' },
      { kind: 'color', key: 'color', label: 'ボタンの色', presets: ACCENT_PRESETS },
    ],
    newItem: () => ({ type: 'button', label: '', url: '', track: true, color: '#E5573F' }),
  },
  {
    type: 'list',
    label: '箇条書き',
    icon: svg('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>'),
    fields: [
      { kind: 'textarea', key: 'text', label: '1行に1つ書きます', rows: 4 },
      {
        kind: 'select',
        key: 'marker',
        label: '頭の印',
        options: [
          { value: 'check', label: 'チェック' },
          { value: 'dot', label: '点' },
          { value: 'number', label: '番号（1. 2. 3.）' },
        ],
      },
    ],
    newItem: () => ({ type: 'list', text: '', marker: 'check' }),
  },
  {
    type: 'imageText',
    label: '画像と文章',
    icon: svg('<rect x="3" y="6" width="8" height="12" rx="1.5"/><path d="M14 8h7M14 12h7M14 16h5"/>'),
    fields: [
      { kind: 'image', key: 'image', label: '画像' },
      { kind: 'text', key: 'heading', label: '見出し（任意）' },
      { kind: 'textarea', key: 'text', label: '文章', rows: 3 },
      {
        kind: 'select',
        key: 'side',
        label: '画像を置く側',
        options: [
          { value: 'left', label: '左' },
          { value: 'right', label: '右' },
        ],
      },
    ],
    newItem: () => ({ type: 'imageText', image: '', heading: '', text: '', side: 'left' }),
  },
  {
    type: 'spacer',
    label: '余白',
    icon: svg('<path d="M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4"/>'),
    fields: [
      {
        kind: 'select',
        key: 'size',
        label: '高さ',
        options: [
          { value: 's', label: '小' },
          { value: 'm', label: '中' },
          { value: 'l', label: '大' },
        ],
      },
    ],
    newItem: () => ({ type: 'spacer', size: 'm' }),
  },
  {
    type: 'divider',
    label: '区切り線',
    icon: svg('<path d="M3 12h18"/>'),
    fields: [
      {
        kind: 'select',
        key: 'style',
        label: '線',
        options: [
          { value: 'solid', label: '細い線' },
          { value: 'dotted', label: '点線' },
        ],
      },
    ],
    newItem: () => ({ type: 'divider', style: 'solid' }),
  },
]

/** 1つの部品のHTMLと、その部品だけのCSS */
function block(item: ItemData, i: number, s: string): { html: string; css: string } {
  const cls = `nc-b-${i}`
  const align = pick(item, 'align', ALIGNS, 'left')
  switch (str(item, 'type')) {
    case 'heading': {
      const size = pick(item, 'size', ['l', 'm', 's'] as const, 'm')
      return {
        html: `<h2 class="nc-b nc-b-heading nc-b-heading--${size} nc-b--${align} ${cls}">${esc(str(item, 'text').trim())}</h2>`,
        css: `${s} .${cls}{color:${safeColor(str(item, 'color'), '#1F2A37')}}`,
      }
    }
    case 'text': {
      const size = pick(item, 'size', ['m', 's'] as const, 'm')
      return { html: `<p class="nc-b nc-b-text nc-b-text--${size} nc-b--${align} ${cls}">${textHtml(str(item, 'text'))}</p>`, css: '' }
    }
    case 'image': {
      const image = safeImage(str(item, 'image'))
      const width = pick(item, 'width', ['100', '80', '60'] as const, '100')
      const round = bool(item, 'round') ? ' nc-b-image--round' : ''
      const picture = image === '' ? '' : `<img src="${image}" alt="${esc(str(item, 'alt').trim())}">`
      const url = str(item, 'url').trim()
      const inner = picture !== '' && url !== '' ? `<a class="nc-b-image__link"${linkAttrs(url, { track: true, newTab: false })}>${picture}</a>` : picture
      return { html: `<figure class="nc-b nc-b-image nc-b-image--w${width}${round} ${cls}">${inner}</figure>`, css: '' }
    }
    case 'button': {
      const color = safeColor(str(item, 'color'), '#E5573F')
      const link = linkAttrs(str(item, 'url'), { track: bool(item, 'track'), newTab: false })
      return {
        html:
          `<div class="nc-b nc-b-button ${cls}"><a class="nc-b-button__a"${link}>` +
          `<span class="nc-b-button__label">${esc(str(item, 'label').trim())}</span>${ARROW_SVG}</a></div>`,
        css: pressButtonCss(`${s} .${cls} .nc-b-button__a`, { color, radius: '12px', full: true }),
      }
    }
    case 'list': {
      const marker = pick(item, 'marker', ['check', 'dot', 'number'] as const, 'check')
      const lines = str(item, 'text')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line !== '')
      const tag = marker === 'number' ? 'ol' : 'ul'
      const mark = (n: number): string =>
        marker === 'check' ? CHECK_MARK : marker === 'number' ? `${n}.` : '<span class="nc-b-list__dot"></span>'
      const lis = lines
        .map(
          (line, n) =>
            `<li class="nc-b-list__item"><span class="nc-b-list__mark" aria-hidden="true">${mark(n + 1)}</span>` +
            `<span class="nc-b-list__text">${esc(line)}</span></li>`,
        )
        .join('')
      return { html: `<${tag} class="nc-b nc-b-list nc-b-list--${marker} ${cls}">${lis}</${tag}>`, css: '' }
    }
    case 'imageText': {
      const image = safeImage(str(item, 'image'))
      const side = pick(item, 'side', ['left', 'right'] as const, 'left')
      const heading = str(item, 'heading').trim()
      return {
        html:
          `<div class="nc-b nc-b-imageText nc-b-imageText--${side} ${cls}">` +
          `<div class="nc-b-imageText__img">${image === '' ? '' : `<img src="${image}" alt="">`}</div>` +
          `<div class="nc-b-imageText__body">` +
          (heading === '' ? '' : `<h3 class="nc-b-imageText__heading">${esc(heading)}</h3>`) +
          `<p class="nc-b-imageText__text">${textHtml(str(item, 'text'))}</p></div></div>`,
        css: '',
      }
    }
    case 'spacer': {
      const size = pick(item, 'size', ['s', 'm', 'l'] as const, 'm')
      return { html: `<div class="nc-b nc-b-spacer nc-b-spacer--${size} ${cls}" aria-hidden="true"></div>`, css: '' }
    }
    case 'divider': {
      const style = pick(item, 'style', ['solid', 'dotted'] as const, 'solid')
      return { html: `<hr class="nc-b nc-b-divider nc-b-divider--${style} ${cls}">`, css: '' }
    }
    default:
      return { html: '', css: '' }
  }
}

/** 見本の中身（そのまま入れられる例） */
const DEFAULT_BLOCKS: readonly ItemData[] = [
  { type: 'heading', text: 'はじめての方へ', size: 'l', align: 'center', color: '#1F2A37' },
  { type: 'text', text: 'ご購入の前に知っておいてほしいことを、ここにまとめました。', size: 'm', align: 'center' },
  { type: 'list', text: '全国どこでも送料無料\n届いてから30日は返品できます\nチャットでいつでも相談できます', marker: 'check' },
  { type: 'spacer', size: 's' },
  { type: 'button', label: '詳しく見る', url: '', track: true, color: '#E5573F' },
]

export const BUILDER_TEMPLATE: NocodeTemplate = {
  id: 'builder',
  name: '組み立てたWidget',
  summary: '見出し・文章・画像・ボタンなどを上から順に積んで、自由に作ります',
  icon: svg('<rect x="4" y="3" width="16" height="5" rx="1.5"/><rect x="4" y="10" width="16" height="5" rx="1.5"/><path d="M12 17v4M10 19h4"/>'),
  fields: [
    { kind: 'blocks', key: 'blocks', label: '部品（上から順に並びます）', min: 1, max: 30, types: BLOCK_TYPES },
    { kind: 'color', key: 'background', label: '背景の色', presets: BACKGROUND_PRESETS },
    {
      kind: 'select',
      key: 'padding',
      label: '上下の余白',
      options: [
        { value: 's', label: '狭い' },
        { value: 'm', label: '普通' },
        { value: 'l', label: '広い' },
      ],
    },
    { kind: 'color', key: 'accent', label: '箇条書きの印の色', presets: ACCENT_PRESETS },
  ],
  defaults: () => ({
    blocks: DEFAULT_BLOCKS,
    background: '#FFFFFF',
    padding: 'm',
    accent: '#E5573F',
  }),
  validate: (data) => {
    const blocks = items(data, 'blocks')
    if (blocks.length === 0) return '部品を1つ以上積んでください'
    for (const item of blocks) {
      const type = str(item, 'type')
      if (type === 'button' && str(item, 'label').trim() === '') return 'ボタンの文字が空の部品があります。文字を書くか、その部品を消してください'
      if ((type === 'image' || type === 'imageText') && safeImage(str(item, 'image')) === '') {
        return '画像が選ばれていない部品があります。画像を選ぶか、その部品を消してください'
      }
      if ((type === 'heading' || type === 'text' || type === 'list') && str(item, 'text').trim() === '') {
        return '文字が空の部品があります。文字を書くか、その部品を消してください'
      }
    }
    return null
  },
  render: (data, uid) => {
    const s = `.${uid}`
    const background = safeColor(str(data, 'background'), '#FFFFFF')
    const accent = safeColor(str(data, 'accent'), '#E5573F')
    const padding = PADDING[pick(data, 'padding', ['s', 'm', 'l'] as const, 'm')] ?? 40
    const parts = items(data, 'blocks').map((item, index) => block(item, index + 1, s))

    const css =
      baseCss(s) +
      `${s}{padding:${padding}px 16px;background:${background}}` +
      `${s} .nc-b+.nc-b{margin-top:14px}` +
      `${s} .nc-b--center{text-align:center}` +
      `${s} .nc-b-heading{font-weight:800;line-height:1.45}` +
      `${s} .nc-b-heading--l{font-size:26px}` +
      `${s} .nc-b-heading--m{font-size:21px}` +
      `${s} .nc-b-heading--s{font-size:17px}` +
      // 最後の行に数文字だけ残さない（真ん中寄せは行の長さもそろえる）
      `${s} .nc-b-text{font-size:15px;line-height:1.85;color:#3A4452;text-wrap:pretty}` +
      `${s} .nc-b-text.nc-b--center{text-wrap:balance}` +
      `${s} .nc-b-text--s{font-size:12.5px;line-height:1.75;color:#5B6572}` +
      `${s} .nc-b-image{margin-left:0;margin-right:0}` +
      `${s} .nc-b-image img{margin:0 auto}` +
      `${s} .nc-b-image--w80 img{width:80%}` +
      `${s} .nc-b-image--w60 img{width:60%}` +
      `${s} .nc-b-image--round img{border-radius:12px}` +
      `${s} .nc-b-image__link{display:block}` +
      `${s} .nc-b-button{margin-top:22px}` +
      `${s} .nc-b-button__label{min-width:0}` +
      `${s} .nc-b-button__a svg{flex:0 0 auto;width:18px;height:18px}` +
      `${s} .nc-b-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}` +
      `${s} .nc-b-list__item{display:flex;align-items:flex-start;gap:10px}` +
      `${s} .nc-b-list__mark{flex:0 0 22px;width:22px;height:22px;margin-top:2px;color:${shade(accent, -0.15)};` +
      `display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px}` +
      `${s} .nc-b-list__mark svg{width:20px;height:20px;display:block}` +
      `${s} .nc-b-list__dot{width:7px;height:7px;border-radius:50%;background:currentColor}` +
      `${s} .nc-b-list__text{min-width:0;font-size:15px;line-height:1.7;font-weight:600}` +
      `${s} .nc-b-imageText{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);gap:16px;align-items:center}` +
      `${s} .nc-b-imageText--right .nc-b-imageText__img{order:2}` +
      `${s} .nc-b-imageText__img img{border-radius:10px;width:100%}` +
      `${s} .nc-b-imageText__heading{font-size:17px;font-weight:800;line-height:1.5;margin:0 0 6px}` +
      `${s} .nc-b-imageText__text{font-size:14.5px;line-height:1.8;color:#3A4452}` +
      `${s} .nc-b-spacer,${s} .nc-b+.nc-b-spacer,${s} .nc-b-spacer+.nc-b{margin-top:0}` +
      Object.entries(SPACER)
        .map(([size, px]) => `${s} .nc-b-spacer--${size}{height:${px}px}`)
        .join('') +
      `${s} .nc-b-divider{border:0;border-top:1px solid #D5DAE0;margin:22px 0}` +
      `${s} .nc-b-divider--dotted{border-top:2px dotted #C9CFD6}` +
      `${s} .nc-b+.nc-b-divider,${s} .nc-b-divider+.nc-b{margin-top:22px}` +
      // 狭い画面では画像と文章を縦に並べる（画像が上）
      `@media (max-width:480px){${s} .nc-b-imageText{grid-template-columns:minmax(0,1fr)}` +
      `${s} .nc-b-imageText--right .nc-b-imageText__img{order:0}}` +
      parts.map((p) => p.css).join('')

    return wrapWidget({ uid, type: 'builder', css, body: parts.map((p) => p.html).join('') })
  },
}
