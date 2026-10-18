/**
 * 右の「プロパティ」の「背景色」と、その下の「余白」「不透明度」（2026-10-18 本人「背景の幅や不透明度調整できるようにして」）。
 *
 * 色と不透明度は Quill の `background`、余白は `bgpad` として選んだ文字へ当てる（値の形は background-look.ts）。
 * ラベルの幅（54px）に収めるため下の2行は短い名前にし、背景色の続きと分かるよう少し字下げする。
 */
import { colorPicker, numberInput, row, unit } from './properties-parts.ts'
import {
  BACKGROUND_PADDING_MAX,
  BACKGROUND_PADDING_MIN,
  DEFAULT_BACKGROUND_LOOK,
  backgroundLookOf,
  backgroundValue,
  paddingOf,
  type BackgroundLook,
} from './background-look.ts'
import { hexColorOf } from './underline-look.ts'

export interface BackgroundApply {
  /** 色と不透明度（`#rrggbb` か `rgba(…)`） */
  background: (value: string) => void
  /** 余白（`8px`）。0 にしたら false＝外す */
  padding: (value: string | false) => void
}

export interface BackgroundRows {
  /** 背景色・余白・不透明度の3行（この順に並べる） */
  rows: HTMLElement[]
  /** 選んだ文字の `background`・`bgpad` の値で、欄の中身をそろえる */
  sync: (background: unknown, padding: unknown) => void
}

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, Math.round(n)))

/** 入力欄の数字（空・数字でなければ null） */
function numberOf(input: HTMLInputElement): number | null {
  const text = input.value.trim()
  const value = Number(text)
  return text === '' || !Number.isFinite(value) ? null : value
}

/** 背景色の続きの行（ラベルを少し字下げ・幅は他の行と同じ） */
function subRow(labelText: string): HTMLElement {
  const r = row(labelText)
  const label = r.querySelector<HTMLElement>('.sb-pr-label')
  if (label !== null) label.style.cssText = 'padding-left:8px;box-sizing:border-box'
  return r
}

export function buildBackgroundRows(apply: BackgroundApply): BackgroundRows {
  let look: BackgroundLook = DEFAULT_BACKGROUND_LOOK

  const update = (patch: Partial<BackgroundLook>): void => {
    look = { ...look, ...patch }
    apply.background(backgroundValue(look))
  }

  // ── 背景色 ──
  const colorRow = row('背景色')
  const { wrap, swatch, picker, hex } = colorPicker(DEFAULT_BACKGROUND_LOOK.color.toUpperCase())
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

  // ── 余白（色を文字のまわりに広げる幅） ──
  const paddingRow = subRow('余白')
  const paddingInput = numberInput(BACKGROUND_PADDING_MIN, BACKGROUND_PADDING_MAX, '0')
  paddingInput.value = '0'
  paddingInput.title = '背景の色を、文字のまわり（上下左右）に広げる幅'
  paddingInput.addEventListener('change', () => {
    const value = numberOf(paddingInput)
    if (value === null) return
    const px = clamp(value, BACKGROUND_PADDING_MIN, BACKGROUND_PADDING_MAX)
    paddingInput.value = String(px)
    apply.padding(px === 0 ? false : `${px}px`)
  })
  paddingRow.append(paddingInput, unit('px'))

  // ── 不透明度（背景の色の濃さ） ──
  const opacityRow = subRow('不透明度')
  const opacityInput = numberInput(0, 100, '100')
  opacityInput.value = '100'
  opacityInput.title = '背景の色の濃さ（0で透明・100で塗りつぶし）'
  opacityInput.addEventListener('change', () => {
    const value = numberOf(opacityInput)
    if (value === null) return
    const opacity = clamp(value, 0, 100)
    opacityInput.value = String(opacity)
    update({ opacity })
  })
  opacityRow.append(opacityInput, unit('%'))

  const sync = (background: unknown, padding: unknown): void => {
    look = backgroundLookOf(background)
    showColor(look.color)
    opacityInput.value = String(look.opacity)
    paddingInput.value = String(paddingOf(padding))
  }

  return { rows: [colorRow, paddingRow, opacityRow], sync }
}
