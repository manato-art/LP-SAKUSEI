/**
 * Versionの編集画面の「マーカー」の見た目（色・太さ・不透明度・2026-10-18 本人「下線だけではなくマーカー機能もほしい」）。
 *
 * - 文字の下側に敷く太い帯（LPでよく使う蛍光ペンの線）。`background-image` の linear-gradient で描く
 *   （「背景色」＝background-color とは別。両方を同時に付けられる）。
 * - 見た目は Quill の `marker` の値（`#rrggbb,太さ,不透明度`）に持たせ、`<span class="sb-marker">` に書く。
 *   値の正本は `data-marker`。style はブラウザが書き直すので読み戻しには使わない。配信のLPは style だけで帯が出る。
 * - 太さは文字の高さに対しての割合（文字の大きさを変えても同じ見え方になる）。
 *
 * Quill を読み込まない（node のテストから読めるように）。Quill の部品は marker-blot.ts。
 */
import { hexColorOf } from './underline-look.ts'

export interface MarkerLook {
  /** 帯の色（#rrggbb） */
  color: string
  /** 太さ（文字の高さに対して 10〜100%） */
  thickness: number
  /** 不透明度（0〜100%） */
  opacity: number
}

export const DEFAULT_MARKER_LOOK: MarkerLook = { color: '#ffe45c', thickness: 40, opacity: 100 }

export const MARKER_THICKNESS_MIN = 10
export const MARKER_THICKNESS_MAX = 100

export const MARKER_ATTR = 'data-marker'

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, Math.round(n)))

function normalize(look: MarkerLook): MarkerLook {
  return {
    color: hexColorOf(look.color) ?? DEFAULT_MARKER_LOOK.color,
    thickness: clamp(look.thickness, MARKER_THICKNESS_MIN, MARKER_THICKNESS_MAX),
    opacity: clamp(look.opacity, 0, 100),
  }
}

/** 見た目を Quill の値にする（いつも同じ書き方＝隣どうしの同じマーカーを Quill が1つにまとめられる） */
export function encodeMarker(look: MarkerLook): string {
  const { color, thickness, opacity } = normalize(look)
  return `${color},${thickness},${opacity}`
}

/** Quill の値（見た目の文字列・混ざったときの配列）から見た目を読む。読めなければ初めの見た目 */
export function markerLookOf(value: unknown): MarkerLook {
  const first: unknown = Array.isArray(value) ? value[0] : value
  if (typeof first !== 'string') return DEFAULT_MARKER_LOOK
  const [color, thickness, opacity] = first.split(',')
  const t = Number(thickness)
  const o = Number(opacity)
  if (hexColorOf(color ?? '') === null || !Number.isFinite(t) || !Number.isFinite(o)) return DEFAULT_MARKER_LOOK
  return normalize({ color: color ?? '', thickness: t, opacity: o })
}

/** 帯の CSS（文字の下から太さの分だけ色を敷く） */
export function markerBackground(look: MarkerLook): string {
  const { color, thickness, opacity } = normalize(look)
  const r = parseInt(color.slice(1, 3), 16)
  const g = parseInt(color.slice(3, 5), 16)
  const b = parseInt(color.slice(5, 7), 16)
  const fill = opacity === 100 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${opacity / 100})`
  const edge = `${100 - thickness}%`
  return `linear-gradient(transparent ${edge}, ${fill} ${edge})`
}

/** `<span class="sb-marker">` へ見た目を書く（文字色などほかの指定はそのまま） */
export function applyMarkerLook(el: HTMLElement, value: unknown): void {
  const look = markerLookOf(value)
  el.setAttribute(MARKER_ATTR, encodeMarker(look))
  el.style.setProperty('background-image', markerBackground(look))
}

/** 要素から Quill の値を読む（保存してあったHTMLを開いたときも同じ） */
export function markerValueOfElement(el: Element): string {
  return encodeMarker(markerLookOf(el.getAttribute(MARKER_ATTR)))
}
