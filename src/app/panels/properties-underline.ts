/**
 * 右の「プロパティ」の「下線の見た目」（色・太さ・不透明度・2026-10-18 本人指定）。
 *
 * 文字を選んで「書式」の U で下線を付けたときだけ出す。変えた見た目は Quill の `underline` の値として
 * 選んだ文字の下線へ当てる（値の形は underline-look.ts）。
 * 色を変えていない下線は文字と同じ色。そのまま不透明度だけ下げたときは、文字の色を薄くした線にする。
 */
import { colorPicker, group, numberInput, row, unit } from './properties-parts.ts'
import {
  DEFAULT_UNDERLINE_LOOK,
  UNDERLINE_THICKNESS_MAX,
  UNDERLINE_THICKNESS_MIN,
  encodeUnderline,
  hexColorOf,
  isFormatOn,
  underlineLookOf,
  type UnderlineFormatValue,
  type UnderlineLook,
} from './underline-look.ts'

export interface UnderlineLookGroup {
  el: HTMLElement
  /** 選んだ文字の `underline` の値と文字の色で、出す・出さないと中身をそろえる */
  sync: (underline: unknown, textColor: string) => void
}

export function buildUnderlineLookGroup(apply: (value: UnderlineFormatValue) => void): UnderlineLookGroup {
  const el = group('下線の見た目')
  el.style.display = 'none'

  let look: UnderlineLook = DEFAULT_UNDERLINE_LOOK
  let textColor = '#000000'

  const update = (patch: Partial<UnderlineLook>): void => {
    look = { ...look, ...patch }
    apply(encodeUnderline(look))
  }

  // ── 色 ──
  const colorRow = row('色')
  const { wrap, swatch, picker, hex } = colorPicker(textColor)
  const showColor = (color: string): void => {
    swatch.style.background = color
    picker.value = color
    hex.value = color.toUpperCase()
  }
  picker.addEventListener('input', () => {
    const color = hexColorOf(picker.value)
    if (color === null) return
    showColor(color)
    update({ color })
  })
  hex.addEventListener('change', () => {
    const value = hex.value.trim()
    if (!/^#[0-9a-f]{6}$/i.test(value)) return
    const color = value.toLowerCase()
    showColor(color)
    update({ color })
  })
  colorRow.append(wrap)

  // ── 太さ（空にすると標準の太さ） ──
  const thicknessRow = row('太さ')
  const thicknessInput = numberInput(UNDERLINE_THICKNESS_MIN, UNDERLINE_THICKNESS_MAX, '標準')
  thicknessInput.addEventListener('change', () => {
    const text = thicknessInput.value.trim()
    if (text === '') {
      update({ thickness: null })
      return
    }
    const value = Number(text)
    if (!Number.isFinite(value)) return
    update({ thickness: value })
  })
  thicknessRow.append(thicknessInput, unit('px'))

  // ── 不透明度（色を変えていなければ、文字の色を薄くする） ──
  const opacityRow = row('不透明度')
  const opacityInput = numberInput(0, 100, '100')
  opacityInput.addEventListener('change', () => {
    const value = Number(opacityInput.value.trim())
    if (opacityInput.value.trim() === '' || !Number.isFinite(value)) return
    update({ opacity: value, color: look.color ?? textColor })
  })
  opacityRow.append(opacityInput, unit('%'))

  el.append(colorRow, thicknessRow, opacityRow)

  const sync = (underline: unknown, currentTextColor: string): void => {
    const isOn = isFormatOn(underline)
    el.style.display = isOn ? '' : 'none'
    if (!isOn) return
    textColor = hexColorOf(currentTextColor) ?? '#000000'
    look = underlineLookOf(underline)
    showColor(look.color ?? textColor)
    thicknessInput.value = look.thickness === null ? '' : String(look.thickness)
    opacityInput.value = String(look.opacity)
  }

  return { el, sync }
}
