/**
 * 「部品を積んで作る」の部品（2026-09-22・本人の依頼。ノーコードでWidgetを作る④）。
 *
 * 見出し・文章・画像・ボタン・図形・動画・箇条書き・画像と文章・余白・区切り線。
 * ボタン・画像・図形・動画・画像と文章は「押したとき」を選べる:
 *   なし ／ 画面②③…へ移る（data-nc-go。builder.ts のスクリプトが瞬時に切り替える）／ リンクを開く
 *
 * - 部品ごとの色などは、その部品だけのクラス（nc-b-1, nc-b-2…）に書く（②で並べ替え・複製しても崩れない）
 * - 本文サイズの色文字は暗い色だけを候補にする（ui-forge contrast-discipline）
 * - 移る先は決まった形のid（s1, s2…）で、今ある画面だけ。入力の文字は属性にエスケープして入れる
 */
import { ARROW_SVG, pressButtonCss } from './cta.ts'
import { esc, inkOn, linkAttrs, safeColor, safeImage, safeVideo, shade, textHtml } from './kit.ts'
import { ACCENT_PRESETS, bool, pick, str, type BlockType, type Field, type ItemData } from './types.ts'

/** 文字の色の候補（本文にも使えるよう、暗い色だけ） */
const TEXT_PRESETS: readonly string[] = ['#1F2A37', '#B83A26', '#A8264F', '#155BB0', '#0B7A3E', '#8A6414']
/** 図形の色の候補（地の色） */
const SHAPE_PRESETS: readonly string[] = ['#E5573F', '#F2A516', '#06C755', '#1F7AE0', '#1F2A37', '#F4F1EC']

/** 画面のid（s1, s2…）。これ以外は移る先にしない */
export const SCREEN_ID = /^s\d{1,4}$/

const ALIGNS = ['left', 'center'] as const
const ALIGN_OPTIONS = [
  { value: 'left', label: '左に寄せる' },
  { value: 'center', label: '真ん中' },
]
const ACTIONS = ['none', 'screen', 'link'] as const
type Action = (typeof ACTIONS)[number]

const svg = (body: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`

const CHECK_MARK =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" ' +
  'stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>'

/**
 * 「押したとき」の入力（ボタン・画像・図形・動画・画像と文章）。
 * なし・画面②③…・＋新しい画面・リンクを開く をボタンで選ぶ（本人の依頼「画面2・3・4・5…として簡単に設定」）
 */
function actionFields(): readonly Field[] {
  return [
    { kind: 'goto', key: 'action', label: '押したとき' },
    { kind: 'url', key: 'url', label: '開くページ', placeholder: 'https://', showIfItem: (item) => str(item, 'action') === 'link' },
    { kind: 'toggle', key: 'track', label: 'クリック数をレポートで数える', showIfItem: (item) => str(item, 'action') === 'link' },
  ]
}

const NO_ACTION = { action: 'none', target: '', url: '', track: true }

export const BLOCK_TYPES: readonly BlockType[] = [
  {
    type: 'sample',
    label: '見本',
    icon: svg('<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><path d="M17 14v6M14 17h6"/>'),
    fields: [{ kind: 'sample', key: 'html', label: '見本' }],
    newItem: () => ({ type: 'sample', title: '', html: '' }),
  },
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
    type: 'button',
    label: 'ボタン',
    icon: svg('<rect x="3" y="8" width="18" height="8" rx="4"/><path d="M13 12h4"/>'),
    fields: [
      { kind: 'text', key: 'label', label: 'ボタンの文字', placeholder: '今すぐ申し込む', maxLength: 40 },
      {
        kind: 'select',
        key: 'look',
        label: '見た目',
        options: [
          { value: 'cta', label: '目立つボタン（申し込みなど）' },
          { value: 'choice', label: '選択肢（白地に枠・アンケート向き）' },
        ],
      },
      { kind: 'color', key: 'color', label: 'ボタンの色', presets: ACCENT_PRESETS },
      ...actionFields(),
    ],
    newItem: () => ({ type: 'button', label: '', look: 'cta', color: '#E5573F', ...NO_ACTION }),
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
      ...actionFields(),
    ],
    newItem: () => ({ type: 'image', image: '', alt: '', width: '100', round: false, ...NO_ACTION }),
  },
  {
    type: 'shape',
    label: '図形',
    icon: svg('<rect x="3" y="4" width="8" height="8" rx="1.5"/><circle cx="17" cy="8" r="4"/><rect x="4" y="15" width="16" height="5" rx="2.5"/>'),
    fields: [
      {
        kind: 'select',
        key: 'shape',
        label: '形',
        options: [
          { value: 'round', label: '角の丸い四角' },
          { value: 'rect', label: '四角' },
          { value: 'circle', label: '丸' },
          { value: 'pill', label: '横長の丸（カプセル）' },
        ],
      },
      {
        kind: 'select',
        key: 'size',
        label: '幅',
        options: [
          { value: '100', label: '横いっぱい' },
          { value: '80', label: '8割' },
          { value: '60', label: '6割' },
          { value: '40', label: '4割' },
        ],
      },
      { kind: 'color', key: 'color', label: '色', presets: SHAPE_PRESETS },
      { kind: 'text', key: 'text', label: '中の文字（任意）' },
      ...actionFields(),
    ],
    newItem: () => ({ type: 'shape', shape: 'round', size: '100', color: '#1F7AE0', text: '', ...NO_ACTION }),
  },
  {
    type: 'video',
    label: '動画',
    icon: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9.5v5l4.5-2.5z"/>'),
    fields: [
      { kind: 'video', key: 'video', label: '動画（mp4・webm、30MBまで）' },
      { kind: 'toggle', key: 'autoplay', label: '自動で再生する（音なし・くり返し）' },
      ...actionFields(),
    ],
    newItem: () => ({ type: 'video', video: '', autoplay: true, ...NO_ACTION }),
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
      ...actionFields(),
    ],
    newItem: () => ({ type: 'imageText', image: '', heading: '', text: '', side: 'left', ...NO_ACTION }),
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

export function blockLabel(type: string): string {
  return BLOCK_TYPES.find((t) => t.type === type)?.label ?? '部品'
}

export function actionOf(item: ItemData): Action {
  return pick(item, 'action', ACTIONS, 'none')
}

/** 押したら移る先（今ある画面だけ。無ければ null） */
export function goTarget(item: ItemData, screenIds: ReadonlySet<string>): string | null {
  const target = str(item, 'target')
  return actionOf(item) === 'screen' && SCREEN_ID.test(target) && screenIds.has(target) ? target : null
}

/** 押したら移る印（ボタン・リンク以外には「押せる」印と、キーボードで選べる印も付ける） */
function goAttrs(target: string | null, isControl: boolean): string {
  if (target === null) return ''
  return ` data-nc-go="${target}"${isControl ? '' : ' role="button" tabindex="0"'}`
}

/** リンクで包む（「リンクを開く」のとき） */
function withLink(item: ItemData, className: string, inner: string): string {
  if (actionOf(item) !== 'link' || str(item, 'url').trim() === '') return inner
  return `<a class="${className}"${linkAttrs(str(item, 'url'), { track: bool(item, 'track'), newTab: false })}>${inner}</a>`
}

/** 選択肢のボタン（白地に色の枠。押すと少し沈む） */
function choiceButtonCss(sel: string, color: string): string {
  return (
    `${sel}{display:flex;width:100%;max-width:520px;margin:0 auto;align-items:center;justify-content:center;gap:8px;` +
    `min-height:56px;padding:14px 20px;border:2px solid ${color};border-radius:12px;background:#FFFFFF;` +
    `color:${shade(color, -0.25)};font-size:16.5px;font-weight:800;line-height:1.4;text-decoration:none;cursor:pointer;` +
    `box-shadow:0 3px 0 ${shade(color, 0.55)};transition:transform .12s ease,box-shadow .12s ease,background .12s ease;` +
    `-webkit-tap-highlight-color:transparent}` +
    `${sel}:active{transform:translateY(2px);box-shadow:0 1px 0 ${shade(color, 0.55)};background:${shade(color, 0.92)}}` +
    `${sel}:focus-visible{outline:3px solid ${shade(color, -0.4)};outline-offset:3px}` +
    `@media (prefers-reduced-motion:reduce){${sel}{transition:none}}`
  )
}

/** 1つの部品のHTMLと、その部品だけのCSS（i は Widget 全体で通しの番号） */
export function renderBlock(item: ItemData, i: number, s: string, screenIds: ReadonlySet<string>): { html: string; css: string } {
  const cls = `nc-b-${i}`
  const align = pick(item, 'align', ALIGNS, 'left')
  const target = goTarget(item, screenIds)
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
    case 'button': {
      const color = safeColor(str(item, 'color'), '#E5573F')
      const look = pick(item, 'look', ['cta', 'choice'] as const, 'cta')
      const aClass = `nc-b-button__a nc-b-button__a--${look}`
      const label = `<span class="nc-b-button__label">${esc(str(item, 'label').trim())}</span>${look === 'cta' ? ARROW_SVG : ''}`
      const action = actionOf(item)
      const anchor =
        action === 'link'
          ? `<a class="${aClass}"${linkAttrs(str(item, 'url'), { track: bool(item, 'track'), newTab: false })}>${label}</a>`
          : target !== null
            ? `<a class="${aClass}" href="#"${goAttrs(target, true)}>${label}</a>`
            : `<span class="${aClass}">${label}</span>`
      const sel = `${s} .${cls} .nc-b-button__a`
      return {
        html: `<div class="nc-b nc-b-button nc-b-button--${look} ${cls}">${anchor}</div>`,
        css: look === 'cta' ? pressButtonCss(sel, { color, radius: '12px', full: true }) : choiceButtonCss(sel, color),
      }
    }
    case 'image': {
      const image = safeImage(str(item, 'image'))
      const width = pick(item, 'width', ['100', '80', '60'] as const, '100')
      const round = bool(item, 'round') ? ' nc-b-image--round' : ''
      const picture = image === '' ? '' : `<img src="${image}" alt="${esc(str(item, 'alt').trim())}">`
      return {
        html: `<figure class="nc-b nc-b-image nc-b-image--w${width}${round} ${cls}"${goAttrs(target, false)}>${withLink(item, 'nc-b-image__link', picture)}</figure>`,
        css: '',
      }
    }
    case 'shape': {
      const shape = pick(item, 'shape', ['round', 'rect', 'circle', 'pill'] as const, 'round')
      const size = pick(item, 'size', ['100', '80', '60', '40'] as const, '100')
      const color = safeColor(str(item, 'color'), '#1F7AE0')
      const text = str(item, 'text').trim()
      const inner = text === '' ? '' : `<span class="nc-b-shape__text">${esc(text)}</span>`
      const shapeClass = `nc-b nc-b-shape nc-b-shape--${shape} nc-b-shape--w${size} ${cls}`
      const html =
        actionOf(item) === 'link' && str(item, 'url').trim() !== ''
          ? `<a class="${shapeClass}"${linkAttrs(str(item, 'url'), { track: bool(item, 'track'), newTab: false })}>${inner}</a>`
          : `<div class="${shapeClass}"${goAttrs(target, false)}>${inner}</div>`
      return { html, css: `${s} .${cls}{background:${color};color:${inkOn(color)}}` }
    }
    case 'video': {
      const video = safeVideo(str(item, 'video'))
      const autoplay = bool(item, 'autoplay') ? ' autoplay muted loop' : ''
      // 押したら移る・開くときは操作ボタンを出さない（押すと再生ではなく、移る・開くにする）
      const controls = actionOf(item) === 'none' ? ' controls' : ''
      const player = video === '' ? '' : `<video class="nc-b-video__v" src="${video}" playsinline preload="metadata"${autoplay}${controls}></video>`
      return {
        html: `<div class="nc-b nc-b-video ${cls}"${goAttrs(target, false)}>${withLink(item, 'nc-b-video__link', player)}</div>`,
        css: '',
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
      const inner =
        `<div class="nc-b-imageText__img">${image === '' ? '' : `<img src="${image}" alt="">`}</div>` +
        `<div class="nc-b-imageText__body">` +
        (heading === '' ? '' : `<h3 class="nc-b-imageText__heading">${esc(heading)}</h3>`) +
        `<p class="nc-b-imageText__text">${textHtml(str(item, 'text'))}</p></div>`
      return {
        html: `<div class="nc-b nc-b-imageText nc-b-imageText--${side} ${cls}"${goAttrs(target, false)}>${withLink(item, 'nc-b-imageText__link', inner)}</div>`,
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
    case 'sample':
      // ライブラリの見本（採取した見本のHTML。style・script ごとそのまま）。中身は入力の画面で直してある
      return { html: `<div class="nc-b nc-b-sample ${cls}">${str(item, 'html')}</div>`, css: '' }
    default:
      return { html: '', css: '' }
  }
}
