/**
 * 部品・Widget全体・画面ごとの「背景の画像」（2026-10-24 本人「ボタンの背景だったり枠の背景だったり、そういったものを全部
 * 添付してその画像にできるようにしたい。そしてその画像も位置だったり大きさは自由に決めれる」）。
 *
 * 本人の選択: 対象＝色を持つ部品すべて＋Widget全体・画面ごと（＋見本の中の箱）／文字は上に残す／位置と大きさは見たまま画面でつかんで動かす。
 *
 * 画像はその面の「背景」に敷く（要素も並びも増やさない）。だから見た目の箱の形・角の丸みで切り取られ、文字はその上に出て、
 * もとの色は画像の無い所に見える。部品の型のCSSは `background:` でまとめて書いているので、こちらは !important で上に重ねる
 * （押したとき・選んだ答えの色が変わっても画像は残る）。位置は背景の決まり（0＝左端・50＝真ん中・100＝右端）のまま持つ。
 *
 * 持ち方（部品・Widget全体・画面のどれも同じ名前）: bgImage＝画像／bgFit＝cover（枠いっぱいに覆う）か free（大きさを自分で決める）／
 * bgSize＝free のときの「枠いっぱいに覆う大きさ」に対する%／bgX・bgY＝位置（%）
 *
 * free の大きさ（2026-10-25 本人「スマホで確認すると、画像入れるところがおかしい」）: 横幅に対する%だと、スマホで枠が細くなっても
 * 高さ（ボタンの高さ・文字の量）は縮まないので、画像の上下に色が出た。CSSだけでは「覆う大きさ×%」を書けないので、
 * 面に印（--nc-bgfree＝大きさ%）を付け、配信では bg-fit-script.ts が枠と画像を測って px で当てる。
 * スクリプトが動くまで（LPの編集画面の中も）は横幅に対する%で出す（横長の枠＝PCではほぼ同じ見え方）
 *
 * 背景に動画も敷ける（2026-10-27 本人「背景を追加とかで、画像を入れられる場所は動画も入ればいい」）。動画は CSS の背景にできないので、
 * 面のいちばん後ろに動画の層（.nc-bgv・自動で再生・音なし・くり返し）を入れる（bgVideoLayer・withBlockBgVideo）。
 * 層は面と同じ大きさ・同じ角の丸みで切り取り、文字はその上に出る。位置と大きさは画像と同じ数字（bgVideoDeclarations）。
 * 書き出した層は保存する中身には入れない（見たまま画面から読み戻すときに外す＝canvas-sync.ts）
 */
import { isVideoMedia, safeMedia } from './kit.ts'
import { BG_FIT_ICONS } from './option-icons.ts'
import { int, items, pick, str, type Field, type ItemData } from './types.ts'

export const BG_FITS = ['cover', 'free'] as const
export type BgFit = (typeof BG_FITS)[number]

/** 位置・大きさの範囲（はみ出して置くこともできる） */
export const BG_POSITION_MIN = -100
export const BG_POSITION_MAX = 200
export const BG_SIZE_MIN = 10
export const BG_SIZE_MAX = 400

/** 画像を敷かない部品（画像・動画そのもの、余白・線・矢印・進み具合などの飾り、見本の部品＝中の箱ごとに敷く） */
const NO_BG: ReadonlySet<string> = new Set([
  'image', 'video', 'gallery', 'beforeAfter', 'cover', 'spacer', 'divider', 'hotspot', 'ornament', 'cue', 'progress', 'loading', 'sample',
])

/** 色の付いた面が部品の中の要素にある部品（ボタンなら押す所） */
const INNER_SURFACE: Readonly<Record<string, string>> = {
  button: ' .nc-b-button__a',
  tel: ' .nc-b-tel__a',
  badge: ' .nc-b-badge__in',
  band: ' .nc-b-band__text',
  coupon: ' .nc-b-coupon__ticket',
  speech: ' .nc-b-speech__bubble',
}

/** 背景の画像を敷く面（部品の要素から見たセレクター。'' は部品そのもの）。敷かない部品は null */
export function bgTargetOf(type: string): string | null {
  if (NO_BG.has(type) || type.startsWith('tpl-')) return null
  return INNER_SURFACE[type] ?? ''
}

export interface BgLook {
  readonly image: string
  readonly fit: BgFit
  readonly size: number
  readonly x: number
  readonly y: number
}

/** 背景の画像の今の設定（画像が無い・決まった形でなければ null） */
export function bgLookOf(item: ItemData): BgLook | null {
  const image = safeMedia(str(item, 'bgImage'))
  if (image === '') return null
  return {
    image,
    fit: pick(item, 'bgFit', BG_FITS, 'cover'),
    size: int(item, 'bgSize', BG_SIZE_MIN, BG_SIZE_MAX, 100),
    x: int(item, 'bgX', BG_POSITION_MIN, BG_POSITION_MAX, 50),
    y: int(item, 'bgY', BG_POSITION_MIN, BG_POSITION_MAX, 50),
  }
}

/** 背景の画像の見え方（画像の決まりと同じ値）。見たまま画面で動かしている間もこれを使う */
export function bgDeclarations(look: BgLook): Readonly<Record<string, string>> {
  return {
    'background-image': `url("${look.image}")`,
    'background-repeat': 'no-repeat',
    // 位置は枠の外側（線を含む）から測る（見たまま画面でつかむ枠と同じ）
    'background-origin': 'border-box',
    'background-size': look.fit === 'cover' ? 'cover' : `${look.size}% auto`,
    'background-position': `${look.x}% ${look.y}%`,
  }
}

/** 自由な大きさの面に付ける印（大きさ%。中の要素は受け継がない＝ BG_FREE_RESET） */
export const BG_FREE_MARK = '--nc-bgfree'

/** Widgetの中の要素に印を受け継がせない（印は面ごとに !important で付く） */
export const bgFreeReset = (s: string): string => `${s} *{${BG_FREE_MARK}:initial}`

/** 背景が動画か */
export const isBgVideo = (look: BgLook): boolean => isVideoMedia(look.image)

/**
 * 背景の動画の見え方（動画の要素に当てる）。位置は背景の画像と同じ決まり（0＝左端・50＝真ん中・100＝右端＝object-position）。
 * 大きさは「枠いっぱいに覆う大きさ」に対する%で、その位置を中心に大きく・小さくする（transform）。
 * 100%以上は背景の画像とまったく同じ見え方。100%より小さいときは、枠の形に切った動画が小さくなる
 * （書き出すときには動画の縦横の比が分からないため）
 */
export function bgVideoDeclarations(look: BgLook): Readonly<Record<string, string>> {
  const scale = look.fit === 'cover' ? 1 : look.size / 100
  return {
    'object-position': `${look.x}% ${look.y}%`,
    'transform-origin': `${look.x}% ${look.y}%`,
    transform: scale === 1 ? 'none' : `scale(${scale})`,
  }
}

/** 背景の動画の層の目印 */
export const BG_VIDEO_CLASS = 'nc-bgv'

/**
 * selector の面の背景の動画のCSS。面がもともと位置を決めていなければ（ふつうの並び）、層の基準にする（:where＝見本・部品のCSSが決めた位置が勝つ）。
 * 層は面の中で重なりを閉じ（isolation）、いちばん後ろ（面の色の上・文字の下）に置く
 */
function bgVideoCss(selector: string, look: BgLook): string {
  const video = Object.entries(bgVideoDeclarations(look))
    .map(([property, value]) => `${property}:${value}`)
    .join(';')
  return (
    `:where(${selector}){position:relative;isolation:isolate}` +
    `${selector}>.${BG_VIDEO_CLASS}{position:absolute;inset:0;overflow:hidden;border-radius:inherit;z-index:-1;pointer-events:none}` +
    `${selector}>.${BG_VIDEO_CLASS}>video{position:absolute;inset:0;width:100%;height:100%;max-width:none;margin:0;object-fit:cover;${video}}`
  )
}

/** 背景が動画のとき、面のいちばん後ろに入れる層（自動で再生・音なし・くり返し）。動画でなければ '' */
export function bgVideoLayer(item: ItemData): string {
  const look = bgLookOf(item)
  if (look === null || !isBgVideo(look)) return ''
  return (
    `<span class="${BG_VIDEO_CLASS}" aria-hidden="true" contenteditable="false">` +
    `<video src="${look.image}" autoplay muted loop playsinline preload="metadata"></video></span>`
  )
}

/** html の中で、opening に当たる最初の開始タグのすぐ後ろに layer を入れる（見つからなければそのまま） */
function insertAfterOpenTag(html: string, opening: RegExp, layer: string): string {
  const found = opening.exec(html)
  if (found === null) return html
  const end = found.index + found[0].length
  return html.slice(0, end) + layer + html.slice(end)
}

/**
 * 部品1つの背景の動画の層を、背景を敷く面（bgTargetOf）に入れる。見本の部品は、中の箱（印の付いた要素）ごと。
 * 面が部品そのものなら部品のいちばん外の要素、ボタンなどは色の付いた要素（ボタンなら押す所）
 */
export function withBlockBgVideo(item: ItemData, html: string): string {
  if (str(item, 'type') === 'sample') {
    return items(item, 'bgs').reduce((out, entry) => {
      const id = str(entry, 'id')
      const layer = SAMPLE_BG_ID.test(id) ? bgVideoLayer(entry) : ''
      return layer === '' ? out : insertAfterOpenTag(out, new RegExp(`<[a-zA-Z][^>]*\\sdata-nc-bg="${id}"[^>]*>`), layer)
    }, html)
  }
  const target = bgTargetOf(str(item, 'type'))
  const layer = target === null ? '' : bgVideoLayer(item)
  if (target === null || layer === '') return html
  const opening = target === '' ? /^\s*<[a-zA-Z][^>]*>/ : new RegExp(`<[a-zA-Z][^>]*\\sclass="(?:[^"]*\\s)?${target.trim().slice(1)}(?:\\s[^"]*)?"[^>]*>`)
  return insertAfterOpenTag(html, opening, layer)
}

/** selector の面に背景の画像を敷くCSS（動画なら層のCSS）。画像も動画も無ければ '' */
export function bgCss(selector: string, item: ItemData): string {
  const look = bgLookOf(item)
  if (look === null) return ''
  if (isBgVideo(look)) return bgVideoCss(selector, look)
  const mark: Readonly<Record<string, string>> = look.fit === 'free' ? { [BG_FREE_MARK]: String(look.size) } : {}
  const body = Object.entries({ ...bgDeclarations(look), ...mark })
    .map(([property, value]) => `${property}:${value}!important`)
    .join(';')
  return `${selector}{${body}}`
}

/** 中身のどこか（Widget全体・画面・部品・見本の中の箱）に、自由な大きさの背景の画像があるか */
export function usesFreeBg(value: ItemData): boolean {
  // 動画は CSS の % で大きさを決める（配信のスクリプトで測らない）
  const look = bgLookOf(value)
  if (look !== null && look.fit === 'free' && !isBgVideo(look)) return true
  return Object.values(value).some(
    (child) => Array.isArray(child) && child.some((entry: unknown) => typeof entry === 'object' && entry !== null && usesFreeBg(entry as ItemData)),
  )
}

/** 部品1つの背景の画像のCSS（吹き出しの形の図形は、しっぽ＝::after が背景を受け継ぐので外す） */
export function blockBgCss(s: string, cls: string, item: ItemData): string {
  // 見本の部品は、中の箱ごと（印の付いた要素）
  if (str(item, 'type') === 'sample') return sampleBgCss(s, cls, item)
  const target = bgTargetOf(str(item, 'type'))
  if (target === null) return ''
  const css = bgCss(`${s} .${cls}${target}`, item)
  if (css === '') return ''
  const tail = str(item, 'type') === 'shape' && str(item, 'shape') === 'bubble' ? `${s} .${cls}::after{background-image:none!important}` : ''
  return css + tail
}

/* ── 見本の部品の中の箱（2026-10-24 本人の選択「見本の中の箱も」） ──
 * 見本の中の要素には印（data-nc-bg="b1"）を付け、設定は見本の部品の bgs（{ id, bgImage, bgFit, … } の並び）に持つ。
 * 要素は増やさない（見本の要素の番号がずれない）。書き出しは「その部品の中の、その印の要素」にだけ効く */

const SAMPLE_BG_ID = /^b\d{1,4}$/

/** 見本の部品の中の箱の背景の画像のCSS */
export function sampleBgCss(s: string, cls: string, item: ItemData): string {
  return items(item, 'bgs')
    .map((entry) => {
      const id = str(entry, 'id')
      return SAMPLE_BG_ID.test(id) ? bgCss(`${s} .${cls} [data-nc-bg="${id}"]`, entry) : ''
    })
    .join('')
}

/** 次に付ける印の名前（設定にも見本の中にも無い b1・b2…） */
export function nextSampleBgId(bgs: readonly ItemData[], html: string): string {
  const used = new Set([...bgs.map((entry) => str(entry, 'id')), ...[...html.matchAll(/data-nc-bg="(b\d{1,4})"/g)].map((m) => m[1] ?? '')])
  let n = 1
  while (used.has(`b${n}`)) n += 1
  return `b${n}`
}

/** 印 id の設定を直した並び（無ければ足す）。画像を外したら、その印の設定ごと外す */
export function withSampleBg(bgs: readonly ItemData[], id: string, values: ItemData): readonly ItemData[] {
  const found = bgs.some((entry) => str(entry, 'id') === id)
  const next = found ? bgs.map((entry) => (str(entry, 'id') === id ? { ...entry, ...values } : entry)) : [...bgs, { id, ...values }]
  return next.filter((entry) => str(entry, 'id') !== id || hasBgImage(entry))
}

/** 背景の画像（か動画）を選んでいるか */
export function hasBgImage(value: ItemData): boolean {
  return safeMedia(str(value, 'bgImage')) !== ''
}
const hasImage = hasBgImage
const isFree = (value: ItemData): boolean => hasImage(value) && str(value, 'bgFit') === 'free'

/**
 * 背景の画像の入力（画像を選ぶ・合わせ方・大きさ・位置）。合わせ方などは画像を選んでから出す。
 * scope: item＝並びの中（部品・画面）／root＝Widget全体
 */
export function bgFields(scope: 'item' | 'root'): readonly Field[] {
  const when = (test: (value: ItemData) => boolean): Pick<Field, 'showIf' | 'showIfItem'> =>
    scope === 'item' ? { showIfItem: test } : { showIf: test }
  return [
    { kind: 'image', key: 'bgImage', label: '背景の画像', note: '画像でも動画でも入ります（動画は自動で再生・音なし・くり返し）。文字はこの上に出ます', section: 'background' },
    {
      kind: 'select',
      key: 'bgFit',
      label: '合わせ方',
      options: [
        { value: 'cover', label: '枠いっぱいに覆う', short: 'いっぱい', icon: BG_FIT_ICONS.cover },
        { value: 'free', label: '大きさを自分で決める', short: '自由', icon: BG_FIT_ICONS.free },
      ],
      fallback: 'cover',
      section: 'background',
      ...when(hasImage),
    },
    {
      kind: 'number',
      key: 'bgSize',
      label: '大きさ',
      note: '100＝枠いっぱい。スマホで枠が細くなっても、100以上なら枠を覆います',
      min: BG_SIZE_MIN,
      max: BG_SIZE_MAX,
      unit: '%',
      fallback: 100,
      section: 'background',
      ...when(isFree),
    },
    {
      kind: 'number',
      key: 'bgX',
      label: '左右の位置',
      note: '0＝左端・50＝真ん中・100＝右端',
      min: BG_POSITION_MIN,
      max: BG_POSITION_MAX,
      unit: '%',
      fallback: 50,
      section: 'background',
      ...when(hasImage),
    },
    {
      kind: 'number',
      key: 'bgY',
      label: '上下の位置',
      note: '0＝上端・50＝真ん中・100＝下端',
      min: BG_POSITION_MIN,
      max: BG_POSITION_MAX,
      unit: '%',
      fallback: 50,
      section: 'background',
      ...when(hasImage),
    },
  ]
}
