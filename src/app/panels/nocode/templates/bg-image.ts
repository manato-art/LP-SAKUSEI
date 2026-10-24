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
 * bgSize＝free のときの横幅に対する%／bgX・bgY＝位置（%）
 */
import { safeImage } from './kit.ts'
import { BG_FIT_ICONS } from './option-icons.ts'
import { int, pick, str, type Field, type ItemData } from './types.ts'

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
  const image = safeImage(str(item, 'bgImage'))
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

/** selector の面に背景の画像を敷くCSS。画像が無ければ '' */
export function bgCss(selector: string, item: ItemData): string {
  const look = bgLookOf(item)
  if (look === null) return ''
  const body = Object.entries(bgDeclarations(look))
    .map(([property, value]) => `${property}:${value}!important`)
    .join(';')
  return `${selector}{${body}}`
}

/** 部品1つの背景の画像のCSS（吹き出しの形の図形は、しっぽ＝::after が背景を受け継ぐので外す） */
export function blockBgCss(s: string, cls: string, item: ItemData): string {
  const target = bgTargetOf(str(item, 'type'))
  if (target === null) return ''
  const css = bgCss(`${s} .${cls}${target}`, item)
  if (css === '') return ''
  const tail = str(item, 'type') === 'shape' && str(item, 'shape') === 'bubble' ? `${s} .${cls}::after{background-image:none!important}` : ''
  return css + tail
}

/** 背景の画像を選んでいるか */
export function hasBgImage(value: ItemData): boolean {
  return safeImage(str(value, 'bgImage')) !== ''
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
    { kind: 'image', key: 'bgImage', label: '背景の画像', note: '文字はこの画像の上に出ます', section: 'background' },
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
    { kind: 'number', key: 'bgSize', label: '大きさ（横幅に対して）', min: BG_SIZE_MIN, max: BG_SIZE_MAX, unit: '%', fallback: 100, section: 'background', ...when(isFree) },
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
