/**
 * スマホ向けの画面かどうか（2026-09-13・本人指示「ただ小さくするのでなくスマホ用に合わせる」）。
 *
 * 判定はここ1か所に置き、CSS（`@media (max-width: 768px)`）と同じ幅で切り替える。
 * ずれると「見た目はスマホなのに中身はPC」という噛み合わない状態になる。
 */

/** この幅以下をスマホ扱いにする（CSSのブレークポイントと同じ値） */
export const MOBILE_MAX_WIDTH = 768

/** その幅がスマホ扱いか */
export function isMobileWidth(width: number): boolean {
  return width <= MOBILE_MAX_WIDTH
}

/** 今開いている画面がスマホ扱いか */
export function isMobileViewport(): boolean {
  return isMobileWidth(window.innerWidth)
}
