/**
 * Versionの編集画面の「下線」の見た目（色・太さ・不透明度・2026-10-18 本人指定）。
 *
 * - 見た目は Quill の `underline` の値に持たせる。`true`＝今までどおりの線（文字と同じ色・標準の太さ）、
 *   文字列＝見た目つき（`text-decoration-color: …; text-decoration-thickness: …px`）。
 * - 値は `<u>` 自身の style として保存され、配信のLPでもそのまま効く。
 *   線の色・太さは外側の要素からは効かない（継がれない）ので、太字などの内側でも必ず `<u>` 自身に書く。
 * - 不透明度は線の色の透明度（rgba）として持つ。CSS に「線だけの不透明度」は無い。
 *
 * Quill を読み込まない（node のテストから読めるように）。Quill の部品は underline-blot.ts。
 */

export interface UnderlineLook {
  /** 線の色（#rrggbb）。null は文字と同じ色 */
  color: string | null
  /** 不透明度（0〜100%） */
  opacity: number
  /** 太さ（px）。null は標準の太さ */
  thickness: number | null
}

/** Quill の `underline` の値 */
export type UnderlineFormatValue = true | string

export const DEFAULT_UNDERLINE_LOOK: UnderlineLook = { color: null, opacity: 100, thickness: null }

export const UNDERLINE_THICKNESS_MIN = 1
export const UNDERLINE_THICKNESS_MAX = 30

const COLOR_PROP = 'text-decoration-color'
const THICKNESS_PROP = 'text-decoration-thickness'

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n))

/** 書式が付いているか（見た目つきの下線＝文字列、選んだ範囲で見た目が混ざる＝配列も「付いている」） */
export function isFormatOn(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0
  return value === true || (typeof value === 'string' && value !== '')
}

interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

function parseColor(text: string): Rgba | null {
  const value = text.trim().toLowerCase()
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(value)?.[1]
  if (hex !== undefined) {
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
      a: 1,
    }
  }
  // rgb(1, 2, 3) / rgba(1, 2, 3, 0.5) / rgb(1 2 3 / 0.5)
  const m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*(?:[,/]\s*([\d.]+)\s*)?\)$/.exec(value)
  if (m === null) return null
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: m[4] === undefined ? 1 : Number(m[4]) }
}

const toHex = ({ r, g, b }: Rgba): string => `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`

/** `#rrggbb`（読めない色は null） */
export function hexColorOf(text: string): string | null {
  const rgba = parseColor(text)
  return rgba === null ? null : toHex(rgba)
}

/** 色（#rrggbb）と不透明度（0〜100%）。読めない色は null（背景色の rgba を読むのにも使う） */
export function colorWithOpacityOf(text: string): { color: string; opacity: number } | null {
  const rgba = parseColor(text)
  return rgba === null ? null : { color: toHex(rgba), opacity: Math.round(clamp(rgba.a, 0, 1) * 100) }
}

/** style の文字列（`a: b; c: d`）を読む */
function declarationsOf(styleText: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const part of styleText.split(';')) {
    const colon = part.indexOf(':')
    if (colon <= 0) continue
    map.set(part.slice(0, colon).trim().toLowerCase(), part.slice(colon + 1).trim())
  }
  return map
}

function lookOfStyle(styleText: string): UnderlineLook {
  const decl = declarationsOf(styleText)
  const rgba = parseColor(decl.get(COLOR_PROP) ?? '')
  const thickness = /^([\d.]+)px$/.exec(decl.get(THICKNESS_PROP) ?? '')?.[1]
  return {
    color: rgba === null ? null : toHex(rgba),
    opacity: rgba === null ? 100 : Math.round(clamp(rgba.a, 0, 1) * 100),
    thickness: thickness === undefined ? null : clamp(Math.round(Number(thickness)), UNDERLINE_THICKNESS_MIN, UNDERLINE_THICKNESS_MAX),
  }
}

/** Quill の値（true・見た目の文字列・混ざったときの配列）から見た目を読む */
export function underlineLookOf(value: unknown): UnderlineLook {
  const first: unknown = Array.isArray(value) ? value[0] : value
  return typeof first === 'string' ? lookOfStyle(first) : DEFAULT_UNDERLINE_LOOK
}

function colorCss(color: string, opacity: number): string | null {
  const rgba = parseColor(color)
  if (rgba === null) return null
  const alpha = clamp(Math.round(opacity), 0, 100) / 100
  return alpha === 1 ? `rgb(${rgba.r}, ${rgba.g}, ${rgba.b})` : `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${alpha})`
}

/** 見た目の CSS の組（何も変えていなければ空） */
function declarationsFor(look: UnderlineLook): Array<[string, string]> {
  const out: Array<[string, string]> = []
  const color = look.color === null ? null : colorCss(look.color, look.opacity)
  if (color !== null) out.push([COLOR_PROP, color])
  if (look.thickness !== null) {
    out.push([THICKNESS_PROP, `${clamp(Math.round(look.thickness), UNDERLINE_THICKNESS_MIN, UNDERLINE_THICKNESS_MAX)}px`])
  }
  return out
}

/**
 * 見た目を Quill の値にする。何も変えていなければ `true`（今までどおりの下線）。
 * いつも同じ書き方にする（隣どうしの同じ見た目の下線を Quill が1つにまとめられるように）。
 */
export function encodeUnderline(look: UnderlineLook): UnderlineFormatValue {
  const decl = declarationsFor(look)
  return decl.length === 0 ? true : decl.map(([prop, value]) => `${prop}: ${value}`).join('; ')
}

/** `<u>` 自身の style へ見た目を書く（文字色などほかの指定はそのまま） */
export function applyUnderlineLook(el: HTMLElement, value: unknown): void {
  el.style.removeProperty(COLOR_PROP)
  el.style.removeProperty(THICKNESS_PROP)
  for (const [prop, css] of declarationsFor(underlineLookOf(value))) el.style.setProperty(prop, css)
}

/** `<u>` の style から Quill の値を読む（保存してあったHTMLを開いたときも同じ） */
export function underlineValueOfElement(el: Element): UnderlineFormatValue {
  return encodeUnderline(lookOfStyle(el.getAttribute('style') ?? ''))
}
