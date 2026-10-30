/**
 * 追従型ポップアップを、つまんで好きな場所へ置く（2026-10-30 本人「表示位置を動かしたい」→「つまんで好きな場所へ」
 * 「スマホとPCで同じ位置」）。
 *
 * 置いた場所は「画面の中で動ける幅の何％か」で覚える（0＝上・左の端、100＝下・右の端）。画面の大きさが違っても、
 * スマホとPCで同じ割合の所に出て、画面からはみ出さない。
 *  - 上の帯・下の帯（画面の幅いっぱい）＝上下だけ（左右は動かない）
 *  - 右下・左下の小さい物＝上下左右。今までどおり画面の端から16px あける
 * 編集画面（popup-free-drag.ts）は px で置き、配信（delivery-popup-html.ts）は同じ割合を CSS で置く。
 */

export interface FreePosition {
  /** 左右（0＝左の端・100＝右の端）。帯では使わない */
  readonly x: number
  /** 上下（0＝上の端・100＝下の端） */
  readonly y: number
}

export type FreeKind = 'bar' | 'corner'

/** 小さい物と画面の端のあき（配信の右下・左下と同じ 16px） */
export const FREE_EDGE = 16

/** 帯の左右（使わないが、覚える値はまん中にそろえる） */
const BAR_X = 50

interface Size {
  readonly w: number
  readonly h: number
}

interface BoxPlace {
  readonly left: number
  readonly top: number
}

/** 選んだ表示位置から、動き方を決める（右下・左下は小さい物、それ以外は帯） */
export function freeKindOf(position: string): FreeKind {
  return position === 'bottom-right' || position === 'bottom-left' ? 'corner' : 'bar'
}

const clampPct = (value: number): number => Math.min(100, Math.max(0, value))
const round1 = (value: number): number => Math.round(value * 10) / 10

/** 割合で置いた中身の、画面（stage）の中の左上の位置（px） */
export function freeBoxPlace(kind: FreeKind, stage: Size, box: Size, place: FreePosition): BoxPlace {
  const edge = kind === 'corner' ? FREE_EDGE : 0
  const roomW = Math.max(0, stage.w - edge * 2 - box.w)
  const roomH = Math.max(0, stage.h - edge * 2 - box.h)
  const left = kind === 'bar' ? Math.max(0, stage.w - box.w) / 2 : edge + (roomW * clampPct(place.x)) / 100
  return { left, top: edge + (roomH * clampPct(place.y)) / 100 }
}

/** つまんで動かした先（画面の中の左上の位置 px）を割合にする。画面の外へ出した分は端で止める */
export function freePositionAt(kind: FreeKind, stage: Size, box: Size, at: BoxPlace): FreePosition {
  const edge = kind === 'corner' ? FREE_EDGE : 0
  const pct = (offset: number, room: number): number => (room <= 0 ? 0 : round1(clampPct(((offset - edge) / room) * 100)))
  return {
    x: kind === 'bar' ? BAR_X : pct(at.left, stage.w - edge * 2 - box.w),
    y: pct(at.top, stage.h - edge * 2 - box.h),
  }
}

/**
 * 配信で置くCSS（position:fixed の箱に足す）。top/left の割合から箱の大きさの同じ割合を引く（translate）と、
 * 0％で端・100％で反対の端にぴったり付く（箱の高さを知らなくてよい）。animation の transform とは別の translate を使う
 */
export function freePlaceCss(kind: FreeKind, place: FreePosition): string {
  const y = round1(clampPct(place.y))
  if (kind === 'bar') return `top:${y}%;left:0;right:0;translate:0 -${y}%`
  const x = round1(clampPct(place.x))
  const along = (pct: number): string => `calc(${FREE_EDGE}px + (100% - ${FREE_EDGE * 2}px) * ${round1(pct) / 100})`
  return `top:${along(y)};left:${along(x)};translate:-${x}% -${y}%`
}

/** 受け取った値（API の free_position）。null＝置いた場所を消す */
export function parseFreePosition(
  value: unknown,
): { readonly ok: true; readonly value: FreePosition | null } | { readonly ok: false; readonly message: string } {
  if (value === null) return { ok: true, value: null }
  const message = '置いた場所は、0〜100 の数（x・y）で送ってください'
  if (typeof value !== 'object' || Array.isArray(value)) return { ok: false, message }
  const { x, y } = value as Record<string, unknown>
  const valid = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100
  if (!valid(x) || !valid(y)) return { ok: false, message }
  return { ok: true, value: { x: round1(x), y: round1(y) } }
}
