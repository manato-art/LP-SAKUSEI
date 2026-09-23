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
import { esc, inkOn, linkAttrs, newUid, safeColor, safeImage, safeVideo, shade, textHtml } from './kit.ts'
import { TEMPLATES } from './list.ts'
import { ACCENT_PRESETS, bool, int, pick, str, type BlockType, type Field, type ItemData, type NocodeTemplate } from './types.ts'

/** 文字の色の候補（本文にも使えるよう、暗い色だけ） */
const TEXT_PRESETS: readonly string[] = ['#1F2A37', '#B83A26', '#A8264F', '#155BB0', '#0B7A3E', '#8A6414']
/** 図形の色の候補（地の色） */
const SHAPE_PRESETS: readonly string[] = ['#E5573F', '#F2A516', '#06C755', '#1F7AE0', '#1F2A37', '#F4F1EC']

/** 画面のid（s1, s2…）。これ以外は移る先にしない */
export const SCREEN_ID = /^s\d{1,4}$/

/**
 * 大きさの数（px・%）。以前の「大/中/小」「s/m/l」の選びは presets で数に読み替える
 * （2026-09-23・Canva風に数字でドラッグできるようにした。古い中身もそのまま読める）。
 * 範囲の外は端に、読めない値は fallback。0.5 刻み
 */
export function sizeOf(item: ItemData, key: string, presets: Readonly<Record<string, number>>, min: number, max: number, fallback: number): number {
  const value = item[key]
  const preset = typeof value === 'string' ? presets[value] : undefined
  const n = preset ?? (typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n * 2) / 2)) : fallback
}

/** 以前の選び（大/中/小・s/m/l）を px に読み替える表 */
export const HEADING_SIZES: Readonly<Record<string, number>> = { l: 26, m: 21, s: 17 }
export const TEXT_SIZES: Readonly<Record<string, number>> = { m: 15, s: 12.5 }
export const SPACER_SIZES: Readonly<Record<string, number>> = { s: 16, m: 32, l: 56 }

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
      // 大きさは数で持つ（以前の 大/中/小 は 26/21/17px として読める）。左の選択枠の角でもドラッグできる
      { kind: 'number', key: 'size', label: '文字の大きさ', min: 12, max: 48, unit: 'px', legacy: HEADING_SIZES },
      { kind: 'select', key: 'align', label: '寄せ', options: ALIGN_OPTIONS },
      { kind: 'color', key: 'color', label: '文字の色', presets: TEXT_PRESETS },
    ],
    newItem: () => ({ type: 'heading', text: '', size: 21, align: 'center', color: '#1F2A37' }),
  },
  {
    type: 'text',
    label: '文章',
    icon: svg('<path d="M4 6h16M4 10h16M4 14h16M4 18h10"/>'),
    fields: [
      { kind: 'textarea', key: 'text', label: '文章', rows: 4 },
      // 数で持つ（以前の 標準/小さめ は 15/12.5px として読める）。14px未満は注意書きの見た目（薄い色）
      { kind: 'number', key: 'size', label: '文字の大きさ', min: 10, max: 24, unit: 'px', legacy: TEXT_SIZES },
      { kind: 'select', key: 'align', label: '寄せ', options: ALIGN_OPTIONS },
    ],
    newItem: () => ({ type: 'text', text: '', size: 15, align: 'left' }),
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
      // 幅は数で持つ（10〜100%。以前の「横いっぱい／8割／6割」の選びは 100・80・60 として読める）
      { kind: 'number', key: 'width', label: '幅', min: 10, max: 100, unit: '%' },
      { kind: 'toggle', key: 'round', label: '角を丸くする' },
      ...actionFields(),
    ],
    newItem: () => ({ type: 'image', image: '', alt: '', width: 100, round: false, ...NO_ACTION }),
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
      // 幅は数で持つ（10〜100%。以前の「横いっぱい／8割／6割／4割」の選びは 100・80・60・40 として読める）
      { kind: 'number', key: 'size', label: '幅', min: 10, max: 100, unit: '%' },
      { kind: 'color', key: 'color', label: '色', presets: SHAPE_PRESETS },
      { kind: 'text', key: 'text', label: '中の文字（任意）' },
      ...actionFields(),
    ],
    newItem: () => ({ type: 'shape', shape: 'round', size: 100, color: '#1F7AE0', text: '', ...NO_ACTION }),
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
    // 高さは数で持つ（以前の 小/中/大 は 16/32/56px として読める）。左の選択枠の下の辺でもドラッグできる
    fields: [{ kind: 'number', key: 'size', label: '高さ', min: 0, max: 160, unit: 'px', legacy: SPACER_SIZES }],
    newItem: () => ({ type: 'spacer', size: 32 }),
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

/**
 * 型の部品（本人の決定 2026-09-23「同じ画面と部品に型が入る」）。
 * 「型から作る」の型8種を、画面の中に1つの部品として置けるようにする。入力欄は型のものをそのまま使う。
 * 中身は型と同じ形なので、この部品だけのWidgetの名前（uid）を持たせて、型の render にそのまま渡す。
 */
const TEMPLATE_PREFIX = 'tpl-'

/** その部品の型（型の部品でなければ undefined） */
export function templateOfBlock(type: string): NocodeTemplate | undefined {
  return type.startsWith(TEMPLATE_PREFIX) ? TEMPLATES.find((t) => `${TEMPLATE_PREFIX}${t.id}` === type) : undefined
}

/** 型の部品かどうか（部品を足すところで、ふつうの部品と分けて並べる） */
export function isTemplateBlock(type: string): boolean {
  return templateOfBlock(type) !== undefined
}

const TEMPLATE_BLOCKS: readonly BlockType[] = TEMPLATES.map((template) => ({
  type: `${TEMPLATE_PREFIX}${template.id}`,
  label: template.name,
  icon: template.icon,
  // 押したときは、型の中の最初のボタン（リンク）に効かせる（ボタンの型など）
  fields: template.partPress === true ? [...template.fields, ...actionFields()] : template.fields,
  newItem: () => ({ type: `${TEMPLATE_PREFIX}${template.id}`, uid: newUid(), ...template.defaults(new Date()) }),
}))

/** 積める部品（ふつうの部品＋型の部品） */
export const ALL_BLOCK_TYPES: readonly BlockType[] = [...BLOCK_TYPES, ...TEMPLATE_BLOCKS]

export function blockLabel(type: string): string {
  return ALL_BLOCK_TYPES.find((t) => t.type === type)?.label ?? '部品'
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

/**
 * 型の部品で「画面へ移る」を選んだとき、型が書き出したHTMLの最初のリンクに移る先を付ける
 * （ボタンの型など、押す所が1つの型だけ。リンクが無ければ何もしない）。
 */
function withGoIn(html: string, target: string | null): string {
  if (target === null || !/<a\s/.test(html)) return html
  return html.replace(/<a\s/, `<a data-nc-go="${target}" `)
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

/** 見本の中の <style>・<script>（同じ見本を分けた部品には、どれにも同じものが入っている） */
const SAMPLE_ASSET = /<(style|script)\b[^>]*>[\s\S]*?<\/\1\s*>/gi

/**
 * 見本を設問ごとに画面①②③へ分けると、どの部品にも同じ <style>・<script> が入る。
 * そのまま出すと見本のスクリプトが画面の数だけ動き、押すと二重に進む → 同じ中身は最初の1つだけ残す。
 */
function dedupeSampleAssets(html: string, seen: Set<string>): string {
  return html.replace(SAMPLE_ASSET, (block) => {
    if (seen.has(block)) return ''
    seen.add(block)
    return block
  })
}

/** 1つの部品のHTMLと、その部品だけのCSS（i は Widget 全体で通しの番号。seen は見本の重なりを消すのに使う） */
export function renderBlock(
  item: ItemData,
  i: number,
  s: string,
  screenIds: ReadonlySet<string>,
  seen: Set<string> = new Set<string>(),
): { html: string; css: string } {
  const cls = `nc-b-${i}`
  const align = pick(item, 'align', ALIGNS, 'left')
  const target = goTarget(item, screenIds)
  switch (str(item, 'type')) {
    case 'heading': {
      const size = sizeOf(item, 'size', HEADING_SIZES, 12, 48, 21)
      return {
        html: `<h2 class="nc-b nc-b-heading nc-b--${align} ${cls}">${esc(str(item, 'text').trim())}</h2>`,
        css: `${s} .${cls}{color:${safeColor(str(item, 'color'), '#1F2A37')};font-size:${size}px}`,
      }
    }
    case 'text': {
      const size = sizeOf(item, 'size', TEXT_SIZES, 10, 24, 15)
      // 小さい文字は注意書きの見た目（薄い色・詰めた行間）
      const small = size < 14 ? ' nc-b-text--s' : ''
      return {
        html: `<p class="nc-b nc-b-text${small} nc-b--${align} ${cls}">${textHtml(str(item, 'text'))}</p>`,
        css: `${s} .${cls}{font-size:${size}px}`,
      }
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
      const width = int(item, 'width', 10, 100, 100)
      const round = bool(item, 'round') ? ' nc-b-image--round' : ''
      const picture = image === '' ? '' : `<img src="${image}" alt="${esc(str(item, 'alt').trim())}">`
      return {
        html: `<figure class="nc-b nc-b-image${round} ${cls}"${goAttrs(target, false)}>${withLink(item, 'nc-b-image__link', picture)}</figure>`,
        css: `${s} .${cls} img{width:${width}%}`,
      }
    }
    case 'shape': {
      const shape = pick(item, 'shape', ['round', 'rect', 'circle', 'pill'] as const, 'round')
      const size = int(item, 'size', 10, 100, 100)
      const color = safeColor(str(item, 'color'), '#1F7AE0')
      const text = str(item, 'text').trim()
      const inner = text === '' ? '' : `<span class="nc-b-shape__text">${esc(text)}</span>`
      const shapeClass = `nc-b nc-b-shape nc-b-shape--${shape} ${cls}`
      const html =
        actionOf(item) === 'link' && str(item, 'url').trim() !== ''
          ? `<a class="${shapeClass}"${linkAttrs(str(item, 'url'), { track: bool(item, 'track'), newTab: false })}>${inner}</a>`
          : `<div class="${shapeClass}"${goAttrs(target, false)}>${inner}</div>`
      return { html, css: `${s} .${cls}{background:${color};color:${inkOn(color)};width:${size}%}` }
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
      const size = sizeOf(item, 'size', SPACER_SIZES, 0, 160, 32)
      return { html: `<div class="nc-b nc-b-spacer ${cls}" aria-hidden="true"></div>`, css: `${s} .${cls}{height:${size}px}` }
    }
    case 'divider': {
      const style = pick(item, 'style', ['solid', 'dotted'] as const, 'solid')
      return { html: `<hr class="nc-b nc-b-divider nc-b-divider--${style} ${cls}">`, css: '' }
    }
    case 'sample':
      // ライブラリの見本（採取した見本のHTML。style・script ごとそのまま）。中身は入力の画面で直してある
      return { html: `<div class="nc-b nc-b-sample ${cls}">${dedupeSampleAssets(str(item, 'html'), seen)}</div>`, css: '' }
    default: {
      // 型の部品（型が自分でHTMLとCSSを書き出す。この部品だけのWidgetの名前で、ほかの型とまざらない）
      const template = templateOfBlock(str(item, 'type'))
      if (template === undefined) return { html: '', css: '' }
      const sub = /^nc-[a-z0-9]{8}$/.test(str(item, 'uid')) ? str(item, 'uid') : `${s.slice(1)}t${i}`
      const inner = template.render(item, sub)
      return { html: `<div class="nc-b nc-b-tpl ${cls}">${withGoIn(inner, target)}</div>`, css: '' }
    }
  }
}
