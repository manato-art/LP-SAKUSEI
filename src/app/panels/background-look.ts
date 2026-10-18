/**
 * Versionの編集画面の「背景色」の見た目（色・不透明度・余白・2026-10-18 本人「背景の幅や不透明度調整できるようにして」）。
 *
 * - 色と不透明度は Quill 標準の `background`（background-color）の値に持たせる。不透明度100%は `#rrggbb`、
 *   それ以外は `rgba(…)`。Quill の色の読み取りは `rgb(` だけを #rrggbb に直し、`rgba(` はそのまま返すので消えない。
 * - 余白（本人の言う「背景の幅」）は `bgpad`＝文字の塊（span）の padding。色と同じ span に付くので、
 *   余白の部分にも色が付く。2行に折り返しても行ごとに余白が付くよう、box-decoration-break: clone を一緒に書く。
 * - どれも span 自身の style として保存され、配信のLPでもそのまま効く。
 *
 * Quill を読み込まない（node のテストから読めるように）。Quill への登録は background-padding-format.ts。
 */
import { Scope, StyleAttributor } from 'parchment'
import { colorWithOpacityOf } from './underline-look.ts'

export interface BackgroundLook {
  /** 背景の色（#rrggbb） */
  color: string
  /** 不透明度（0〜100%） */
  opacity: number
}

/** 背景色が付いていない文字を選んだときに欄へ出す見た目（今までの欄の初めの値と同じ白） */
export const DEFAULT_BACKGROUND_LOOK: BackgroundLook = { color: '#ffffff', opacity: 100 }

export const BACKGROUND_PADDING_MIN = 0
export const BACKGROUND_PADDING_MAX = 40

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, Math.round(n)))

/** 範囲の中で見た目が混ざったとき、Quill は配列で返す（先頭の見た目を出す） */
const firstOf = (value: unknown): unknown => (Array.isArray(value) ? value[0] : value)

/** 見た目を Quill の `background` の値にする */
export function backgroundValue(look: BackgroundLook): string {
  const parsed = colorWithOpacityOf(look.color)
  const color = parsed?.color ?? DEFAULT_BACKGROUND_LOOK.color
  const opacity = clamp(look.opacity, 0, 100)
  if (opacity === 100) return color
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16))
  return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`
}

/** Quill の `background` の値から見た目を読む。読めなければ初めの見た目 */
export function backgroundLookOf(value: unknown): BackgroundLook {
  const first = firstOf(value)
  if (typeof first !== 'string') return DEFAULT_BACKGROUND_LOOK
  return colorWithOpacityOf(first) ?? DEFAULT_BACKGROUND_LOOK
}

/** Quill の `bgpad` の値（`8px`）から余白の数字を読む。付いていなければ 0 */
export function paddingOf(value: unknown): number {
  const first = firstOf(value)
  const px = typeof first === 'string' ? /^([\d.]+)px$/.exec(first.trim())?.[1] : undefined
  return px === undefined ? 0 : clamp(Number(px), BACKGROUND_PADDING_MIN, BACKGROUND_PADDING_MAX)
}

const CLONE_PROPS = ['box-decoration-break', '-webkit-box-decoration-break'] as const

/** 余白（padding）を付ける Quill の飾り。付けるときに、折り返した行ごとの余白の指定も一緒に書く */
class PaddingWithCloneAttributor extends StyleAttributor {
  override add(node: HTMLElement, value: unknown): boolean {
    if (!super.add(node, value)) return false
    for (const prop of CLONE_PROPS) node.style.setProperty(prop, 'clone')
    return true
  }

  /** 余白と行ごとの指定だけを取り除く（同じ span の背景色・文字色は残す）。何も残らなければ style ごと外す */
  override remove(node: HTMLElement): void {
    for (const prop of [this.keyName, ...CLONE_PROPS]) node.style.removeProperty(prop)
    if (!node.getAttribute('style')) node.removeAttribute('style')
  }
}

export const BackgroundPaddingAttributor = new PaddingWithCloneAttributor('bgpad', 'padding', {
  scope: Scope.INLINE,
})
