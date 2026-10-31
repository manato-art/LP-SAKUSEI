/**
 * 「LPの上で決める」画面（指示39・2026-10-31 本人「ポップアップの表示位置なんだけど、実際にLPの中を自由に移動して決めたい。
 * ここまで読んだら表示とか、その際にここの位置に表示とか。実際のLPの中をさわりながら位置決めることができる感じ」
 * → 本人の選択「つまんで好きな位置」「ここまで読んだら表示は離脱防止と追従型」）。
 *
 * スマホの大きさの LP を実際にスクロールして「ここまで読んだら出す」を押すと、その時の読んだ割合が出すきっかけになる。
 * 割合は配信と同じ数え方（スクロールした量 ÷ スクロールできる量・delivery-popup-html.ts の scrolledPct）。
 */
import { describe, expect, it } from 'vitest'
import { gridPlaceOfExit, gridPlaceOfFollow, scrollPctOf, scrollYForPct } from '../src/app/pages/popup-lp-placer.ts'

describe('読んだ割合（配信と同じ数え方）', () => {
  it('いちばん上は 0%、いちばん下は 100%、途中は割合（整数）', () => {
    expect(scrollPctOf(0, 3000, 600)).toBe(0)
    expect(scrollPctOf(2400, 3000, 600)).toBe(100)
    expect(scrollPctOf(1200, 3000, 600)).toBe(50)
    expect(scrollPctOf(1000, 3000, 600)).toBe(42)
  })

  it('LP が画面より短い（スクロールできない）ときは 100%（配信もすぐ出す）', () => {
    expect(scrollPctOf(0, 500, 600)).toBe(100)
  })

  it('割合から、その所までのスクロール量に戻せる（決めてある所を開いたときに見せる）', () => {
    expect(scrollYForPct(50, 3000, 600)).toBe(1200)
    expect(scrollYForPct(0, 3000, 600)).toBe(0)
    expect(scrollYForPct(100, 500, 600)).toBe(0)
  })
})

describe('つまんで置く前の場所（9か所・表示位置から）', () => {
  it('離脱防止・表示直後は、9か所の割合そのまま（昔の自由な値は近い方へ）', () => {
    expect(gridPlaceOfExit(50, 50)).toEqual({ x: 50, y: 50 })
    expect(gridPlaceOfExit(100, 0)).toEqual({ x: 100, y: 0 })
    expect(gridPlaceOfExit(80, 10)).toEqual({ x: 100, y: 0 })
  })

  it('追従型は、上の帯＝上・下の帯＝下・右下・左下', () => {
    expect(gridPlaceOfFollow('top')).toEqual({ x: 50, y: 0 })
    expect(gridPlaceOfFollow('bottom')).toEqual({ x: 50, y: 100 })
    expect(gridPlaceOfFollow('bottom-right')).toEqual({ x: 100, y: 100 })
    expect(gridPlaceOfFollow('bottom-left')).toEqual({ x: 0, y: 100 })
  })
})
