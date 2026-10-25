/**
 * 部品ごとに色を分けて決める（2026-10-25 本人「ボタンの色と文字の色は別で決めたい。文字はストロークとか不透明度とかも
 * 決めたい」→ 本人の選択「ボタンと文字の部品全部」「部品ごとに分解」「不透明度はそれぞれ決めれるように」）。
 *
 * - ボタン（目立つ・選択肢）・電話ボタン: 地の色（今の「ボタンの色」）とは別に、枠の色・影の色。決めなければ自動（今の見た目）
 * - 文字を出す部品: 「文字の見た目」の段に 文字の色（決めなければ自動）・縁取りの色・縁取りの太さ
 * - 色はどれも不透明度つき（#RRGGBBAA・kit.ts の safeColor）。右の欄の色の下に「不透明度」が出る（form-controls.ts）
 *
 * 書き出しは部品の型のCSSのあとに重ねる（同じ強さなら後が勝つ）。部品の色の欄で決めた所（価格の数字の色など・
 * 部品の中の要素に当てた強いCSS）はそのまま残り、文字の色は部品のふつうの文字に効く。
 */
import { safeColor } from './kit.ts'
import { ACCENT_PRESETS, str, type Field, type ItemData } from './types.ts'

/** 文字の色の候補（濃い字・白・よく使う色） */
const TEXT_PRESETS: readonly string[] = ['#1F2A37', '#FFFFFF', ...ACCENT_PRESETS.filter((c) => c !== '#1F2A37')]

/** 文字を出さない部品（画像・動画そのもの、余白・線・飾り・進み具合、見本の部品、型の部品） */
const NO_TEXT: ReadonlySet<string> = new Set(['image', 'video', 'gallery', 'spacer', 'divider', 'hotspot', 'ornament', 'cue', 'progress', 'sample'])

/** 色の付いた面に文字が載る部品（その面の文字に効かせる） */
const TEXT_SURFACE: Readonly<Record<string, string>> = {
  button: ' .nc-b-button__a',
  tel: ' .nc-b-tel__a',
  badge: ' .nc-b-badge__in',
  band: ' .nc-b-band__text',
  speech: ' .nc-b-speech__bubble',
  coupon: ' .nc-b-coupon__ticket',
}

/** 枠の色・影の色を分けて決められる部品（押す面） */
const FACE: Readonly<Record<string, string>> = { button: ' .nc-b-button__a', tel: ' .nc-b-tel__a' }

/** 縁取りの太さ（見た目の太さ・px） */
export const STROKE_MAX = 8

export function hasTextLook(type: string): boolean {
  return !NO_TEXT.has(type) && !type.startsWith('tpl-')
}

/** 枠の色・影の色（中身の段・ボタンの色のすぐ下） */
export function faceFields(type: string): readonly Field[] {
  if (FACE[type] === undefined) return []
  return [
    { kind: 'color', key: 'borderColor', label: '枠の色', presets: [...ACCENT_PRESETS, '#FFFFFF'], auto: '自動' },
    { kind: 'color', key: 'shadowColor', label: '影の色', presets: [...ACCENT_PRESETS, '#FFFFFF'], auto: '自動' },
  ]
}

/** 「文字の見た目」の段（見出しは今の「文字の色」を使うので縁取りだけ） */
export function textLookFields(type: string): readonly Field[] {
  if (!hasTextLook(type)) return []
  const stroke: readonly Field[] = [
    { kind: 'color', key: 'strokeColor', label: '縁取りの色', presets: TEXT_PRESETS, section: 'text' },
    {
      kind: 'number',
      key: 'strokeWidth',
      label: '縁取りの太さ',
      note: '0 で縁取りなし',
      min: 0,
      max: STROKE_MAX,
      step: 0.5,
      unit: 'px',
      fallback: 0,
      section: 'text',
    },
  ]
  if (type === 'heading') return stroke
  return [{ kind: 'color', key: 'textColor', label: '文字の色', presets: TEXT_PRESETS, auto: '自動', section: 'text' }, ...stroke]
}

/** 決めた色（決めていない・形の違う値は null） */
function colorOf(item: ItemData, key: string): string | null {
  const color = safeColor(str(item, key), '')
  return color === '' ? null : color
}

/** 押す面の枠の色・影の色（ボタンは目立つ・選択肢で形が違う） */
function faceCss(face: string, item: ItemData): string {
  const type = str(item, 'type')
  const choice = type === 'button' && str(item, 'look') === 'choice'
  const border = colorOf(item, 'borderColor')
  const shadow = colorOf(item, 'shadowColor')
  const borderCss = border === null ? '' : choice ? `${face}{border-color:${border}}` : `${face}{border:2px solid ${border}}`
  const shadowCss =
    shadow === null
      ? ''
      : choice
        ? `${face}{box-shadow:0 3px 0 ${shadow}}${face}:active{box-shadow:0 1px 0 ${shadow}}`
        : type === 'tel'
          ? `${face}{box-shadow:0 3px 0 ${shadow}}`
          : `${face}{box-shadow:0 6px 0 ${shadow},0 12px 22px rgba(0,0,0,.14)}${face}:active{box-shadow:0 1px 0 ${shadow},0 4px 10px rgba(0,0,0,.12)}`
  return borderCss + shadowCss
}

/** 部品の文字（ふつうの部品は部品の中の文字。飾りの印・アイコンは除く・強さは部品の色の欄より弱い） */
const plainText = (part: string): string =>
  `${part},${part} :where(:not([class*="__mark"],[class*="__icon"],[class*="__mark"] *,[class*="__icon"] *))`

/** 部品ごとに分けた色のCSS（枠・影・文字の色・縁取り）。決めていなければ '' */
export function partColorsCss(s: string, cls: string, item: ItemData): string {
  const type = str(item, 'type')
  const part = `${s} .${cls}`
  const face = FACE[type] === undefined ? '' : faceCss(`${part}${FACE[type]}`, item)
  if (!hasTextLook(type)) return face
  const surface = TEXT_SURFACE[type]
  const target = surface === undefined ? part : `${part}${surface}`
  const text = type === 'heading' ? null : colorOf(item, 'textColor')
  // 色の付いた面の文字は、読みやすくするための影を外す（決めた色のまま見せる）
  const textCss = text === null ? '' : surface === undefined ? `${plainText(part)}{color:${text}}` : `${target}{color:${text};text-shadow:none}`
  const raw = item['strokeWidth']
  // 0.5px きざみ（数でない値は縁取りなし）
  const width = typeof raw === 'number' && Number.isFinite(raw) ? Math.round(Math.min(STROKE_MAX, Math.max(0, raw)) * 2) / 2 : 0
  // 縁取りは文字の後ろに描く（paint-order）ので、見た目の太さの2倍で書く（文字が細くならない）
  const strokeCss = width > 0 ? `${target}{-webkit-text-stroke:${width * 2}px ${colorOf(item, 'strokeColor') ?? '#FFFFFF'};paint-order:stroke fill}` : ''
  return face + textCss + strokeCss
}
