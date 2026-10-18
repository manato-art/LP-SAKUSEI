/**
 * 右の「プロパティ」の「マーカーの見た目」（色・太さ・不透明度・2026-10-18 本人「下線だけではなくマーカー機能もほしい」）。
 *
 * 文字を選んで「書式」のマーカーのボタンで引いたときだけ出す。変えた見た目は Quill の `marker` の値として
 * 選んだ文字のマーカーへ当てる（値の形は marker-look.ts）。太さは文字の高さに対しての割合。
 */
import { colorPicker, group, numberInput, row, unit } from './properties-parts.ts'
import {
  DEFAULT_MARKER_LOOK,
  MARKER_THICKNESS_MAX,
  MARKER_THICKNESS_MIN,
  encodeMarker,
  markerLookOf,
  type MarkerLook,
} from './marker-look.ts'
import { hexColorOf, isFormatOn } from './underline-look.ts'

export interface MarkerLookGroup {
  el: HTMLElement
  /** 選んだ文字の `marker` の値で、出す・出さないと中身をそろえる */
  sync: (marker: unknown) => void
}

export function buildMarkerLookGroup(apply: (value: string) => void): MarkerLookGroup {
  const el = group('マーカーの見た目')
  el.style.display = 'none'

  let look: MarkerLook = DEFAULT_MARKER_LOOK

  const update = (patch: Partial<MarkerLook>): void => {
    look = { ...look, ...patch }
    apply(encodeMarker(look))
  }

  /** 入力欄の数字（空・数字でなければ null） */
  const numberOf = (input: HTMLInputElement): number | null => {
    const text = input.value.trim()
    const value = Number(text)
    return text === '' || !Number.isFinite(value) ? null : value
  }

  // ── 色 ──
  const colorRow = row('色')
  const { wrap, swatch, picker, hex } = colorPicker(DEFAULT_MARKER_LOOK.color)
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

  // ── 太さ（文字の高さに対しての割合） ──
  const thicknessRow = row('太さ')
  const thicknessInput = numberInput(MARKER_THICKNESS_MIN, MARKER_THICKNESS_MAX, String(DEFAULT_MARKER_LOOK.thickness))
  thicknessInput.title = '文字の高さに対しての割合（100で文字の後ろ全体）'
  thicknessInput.addEventListener('change', () => {
    const value = numberOf(thicknessInput)
    if (value !== null) update({ thickness: value })
  })
  thicknessRow.append(thicknessInput, unit('%'))

  // ── 不透明度 ──
  const opacityRow = row('不透明度')
  const opacityInput = numberInput(0, 100, '100')
  opacityInput.addEventListener('change', () => {
    const value = numberOf(opacityInput)
    if (value !== null) update({ opacity: value })
  })
  opacityRow.append(opacityInput, unit('%'))

  el.append(colorRow, thicknessRow, opacityRow)

  const sync = (marker: unknown): void => {
    const isOn = isFormatOn(marker)
    el.style.display = isOn ? '' : 'none'
    if (!isOn) return
    look = markerLookOf(marker)
    showColor(look.color)
    thicknessInput.value = String(look.thickness)
    opacityInput.value = String(look.opacity)
  }

  return { el, sync }
}
