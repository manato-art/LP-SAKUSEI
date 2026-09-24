/**
 * 数字をドラッグで変える計算（2026-09-23・Widget編集 第2弾・Canva風）。
 */
import { describe, expect, it } from 'vitest'
import {
  clamp,
  dragValue,
  handleKindOf,
  nearestSnap,
  placeGuideX,
  placeLeft,
  SNAP_PX,
  scrubValue,
  sliderRange,
  snapPlace,
  snapThreshold,
  snapToStep,
  widthAtEdge,
  widthEdgeX,
  widthGuideXs,
  widthSnaps,
} from '../src/app/panels/drag-math.ts'

describe('刻みにそろえる', () => {
  it('小数の刻みでも誤差が出ない', () => {
    expect(snapToStep(0.1 + 0.2, 0.1)).toBe(0.3)
    expect(snapToStep(1.24, 0.5)).toBe(1)
    expect(snapToStep(1.26, 0.5)).toBe(1.5)
    expect(snapToStep(250, 50)).toBe(250)
    expect(snapToStep(274, 50)).toBe(250)
  })

  it('範囲に収める', () => {
    expect(clamp(5, 0, 3)).toBe(3)
    expect(clamp(-1, 0, 3)).toBe(0)
  })
})

describe('数字の欄を左右にドラッグ', () => {
  it('4px 動くごとに1刻み。範囲があれば端で止まる', () => {
    expect(scrubValue(10, 0, 1)).toBe(10)
    expect(scrubValue(10, 8, 1)).toBe(12)
    expect(scrubValue(10, -8, 1)).toBe(8)
    expect(scrubValue(10, 3, 1)).toBe(11) // 四捨五入
    expect(scrubValue(1.5, 8, 0.1)).toBe(1.7)
    expect(scrubValue(98, 40, 1, { min: 0, max: 100 })).toBe(100)
    expect(scrubValue(1, -40, 1, { min: 0, max: 100 })).toBe(0)
  })
})

describe('選択枠のハンドルをドラッグ', () => {
  it('マウスの動きを単位に直して範囲に収める', () => {
    const pct = { min: 10, max: 100, step: 1 }
    // 1% が 6.2px（620px の幅）のとき、31px 動かすと 5%
    expect(dragValue(80, 31, 6.2, pct)).toBe(85)
    expect(dragValue(80, -620, 6.2, pct)).toBe(10)
    // 文字の大きさは 3px 動かして 1px
    expect(dragValue(21, 9, 3, { min: 12, max: 48, step: 1 })).toBe(24)
    expect(dragValue(21, 200, 3, { min: 12, max: 48, step: 1 })).toBe(48)
    expect(dragValue(21, 5, 0, { min: 12, max: 48, step: 1 })).toBe(21)
  })
})

describe('スライダーの範囲', () => {
  it('単位ごとの決まった範囲。今の値が端に来ないよう上限を広げる', () => {
    expect(sliderRange('%', 'width', 80)).toEqual({ min: 0, max: 100, step: 1 })
    expect(sliderRange('px', 'width', 100)).toEqual({ min: 0, max: 200, step: 1 })
    expect(sliderRange('px', 'width', 300)).toEqual({ min: 0, max: 600, step: 1 })
    expect(sliderRange('px', 'margin-top', -20)).toEqual({ min: -20, max: 200, step: 1 })
    expect(sliderRange('px', 'font-size', 12.5)).toEqual({ min: 0, max: 200, step: 0.5 })
    expect(sliderRange('s', 'transition', 1.5)).toEqual({ min: 0, max: 5, step: 0.1 })
    expect(sliderRange('ms', 'transition', 6000)).toEqual({ min: 0, max: 12000, step: 50 })
    expect(sliderRange('deg', 'transform', 45)).toEqual({ min: -360, max: 360, step: 1 })
    expect(sliderRange('em', 'letter-spacing', 0.1)).toEqual({ min: 0, max: 5, step: 0.1 })
  })

  it('単位が無いものは、決まっている性質だけ', () => {
    expect(sliderRange('', 'opacity', 0.5)).toEqual({ min: 0, max: 1, step: 0.05 })
    expect(sliderRange('', 'line-height', 1.5)).toEqual({ min: 0.8, max: 3, step: 0.05 })
    expect(sliderRange('', 'font-weight', 700)).toEqual({ min: 100, max: 900, step: 100 })
    expect(sliderRange('', 'z-index', 3)).toBeNull()
    expect(sliderRange('ch', 'width', 40)).toBeNull()
  })
})

describe('CSSの設定をどのハンドルで動かすか', () => {
  const setting = (over: Partial<{ kind: 'number' | 'color' | 'text'; property: string; label: string; isVariable: boolean; unit: string }>) => ({
    kind: 'number' as const,
    property: 'width',
    label: '幅',
    isVariable: false,
    unit: 'px',
    ...over,
  })

  it('幅・高さ・文字の大きさの宣言はそのまま。色や時間は動かせない', () => {
    expect(handleKindOf(setting({ property: 'width' }))).toBe('width')
    expect(handleKindOf(setting({ property: 'max-width', unit: '%' }))).toBe('width')
    expect(handleKindOf(setting({ property: 'height' }))).toBe('height')
    expect(handleKindOf(setting({ property: 'font-size', label: '文字の大きさ' }))).toBe('font')
    expect(handleKindOf(setting({ property: 'padding-top', label: '内側の余白・上' }))).toBeNull()
    expect(handleKindOf(setting({ kind: 'color', property: 'color', label: '文字色' }))).toBeNull()
    expect(handleKindOf(setting({ property: 'width', unit: 's' }))).toBeNull()
  })

  it('CSS変数は名前（コメント）か変数名で見分ける（本人の矢印Widget）', () => {
    expect(handleKindOf(setting({ isVariable: true, property: '--arrow-w', label: '1本の幅（padding込み）' }))).toBe('width')
    expect(handleKindOf(setting({ isVariable: true, property: '--arrow-h', label: '1本の高さ' }))).toBe('height')
    expect(handleKindOf(setting({ isVariable: true, property: '--arrow-gap', label: '矢印同士の間隔' }))).toBeNull()
    expect(handleKindOf(setting({ isVariable: true, property: '--arrow-lift', label: '浮き上がる量' }))).toBeNull()
    expect(handleKindOf(setting({ isVariable: true, property: '--title-size', label: 'title-size' }))).toBe('font')
    expect(handleKindOf(setting({ isVariable: true, property: '--box-width', label: 'box-width' }))).toBe('width')
  })
})

/* ── 補助線（2026-09-24・本人「補助線もやって」） ── */
describe('部品をつかんで横に動かす（左・中央・右へ吸い付く）', () => {
  const box = { left: 0, right: 400 }

  it('置く位置ごとの左端と補助線の位置', () => {
    expect(placeLeft('left', 100, box)).toBe(0)
    expect(placeLeft('center', 100, box)).toBe(150)
    expect(placeLeft('right', 100, box)).toBe(300)
    expect(placeGuideX('left', box)).toBe(0)
    expect(placeGuideX('center', box)).toBe(200)
    expect(placeGuideX('right', box)).toBe(400)
  })

  it('近くまで来たら吸い付き、そうでなければ手の位置のまま（離すと一番近い位置に収まる）', () => {
    expect(snapPlace(146, 100, box)).toEqual({ side: 'center', left: 150, snapped: true })
    expect(snapPlace(100, 100, box)).toEqual({ side: 'center', left: 100, snapped: false })
    expect(snapPlace(60, 100, box)).toEqual({ side: 'left', left: 60, snapped: false })
    expect(snapPlace(5, 100, box)).toEqual({ side: 'left', left: 0, snapped: true })
    expect(snapPlace(296, 100, box)).toEqual({ side: 'right', left: 300, snapped: true })
  })

  it('枠の外へは出ない', () => {
    expect(snapPlace(-80, 100, box)).toEqual({ side: 'left', left: 0, snapped: true })
    expect(snapPlace(900, 100, box)).toEqual({ side: 'right', left: 300, snapped: true })
  })

  it('吸い付く距離は変えられる', () => {
    expect(snapPlace(130, 100, box, 30).snapped).toBe(true)
    expect(snapPlace(130, 100, box, 10).snapped).toBe(false)
  })
})

describe('幅のつまみ（辺の位置と幅%の行き来・吸い付き先）', () => {
  const box = { left: 100, right: 500 } // 幅 400px

  it('動かす辺の位置（右に置いた部品は左の辺・中央は右の辺）', () => {
    expect(widthEdgeX(50, 'left', box)).toBe(300)
    expect(widthEdgeX(50, 'right', box)).toBe(300)
    expect(widthEdgeX(50, 'center', box)).toBe(400)
  })

  it('辺の位置から幅%を逆算する（中央はどちらの辺でも同じ幅）', () => {
    expect(widthAtEdge(300, 'left', box)).toBe(50)
    expect(widthAtEdge(300, 'right', box)).toBe(50)
    expect(widthAtEdge(400, 'center', box)).toBe(50)
    expect(widthAtEdge(200, 'center', box)).toBe(50)
  })

  it('補助線を引く位置（中央に置いた部品は両側の辺）', () => {
    expect(widthGuideXs(50, 'left', box)).toEqual([300])
    expect(widthGuideXs(50, 'right', box)).toEqual([300])
    expect(widthGuideXs(50, 'center', box)).toEqual([400, 200])
  })

  it('吸い付き先＝ほかの部品の端に辺がそろう幅＋よく使う幅（範囲の外・重なりは除く）', () => {
    // 左に置いた部品: 右の辺が x=260（40%）や x=180（20%）にそろう幅。x=100 は 0% なので範囲外
    expect(widthSnaps('left', box, [260, 180, 100], { min: 10, max: 100 })).toEqual([20, 25, 40, 50, 75, 100])
    // 中央に置いた部品: 左右どちらの端も同じ幅になる（x=200 と x=400 はどちらも 50%）
    expect(widthSnaps('center', box, [200, 400], { min: 10, max: 100 })).toEqual([25, 50, 75, 100])
  })

  it('いまの値から手の動きで一定の距離の内にある、一番近い吸い付き先', () => {
    const points = [{ value: 25 }, { value: 50 }, { value: 100 }]
    expect(nearestSnap(48, points, 4)).toEqual({ value: 50 }) // 2% × 4px = 8px
    expect(nearestSnap(47, points, 4)).toBeNull() // 12px は遠い
    expect(nearestSnap(26, points, 4, 3)).toBeNull()
    expect(nearestSnap(70, [], 4)).toBeNull()
  })
})

describe('Alt（Mac は option）を押しながらだと吸い付かない', () => {
  it('吸い付く距離は、押していれば 0（ぴったり重なったときだけ線）', () => {
    expect(snapThreshold(false)).toBe(SNAP_PX)
    expect(snapThreshold(true)).toBe(0)
  })

  it('距離 0 なら、近くても吸い付かず手の位置のまま', () => {
    const box = { left: 0, right: 400 }
    expect(snapPlace(146, 100, box, 0)).toEqual({ side: 'center', left: 146, snapped: false })
    expect(snapPlace(150, 100, box, 0)).toEqual({ side: 'center', left: 150, snapped: true })
    const points = [{ value: 50 }]
    expect(nearestSnap(49, points, 4, 0)).toBeNull()
    expect(nearestSnap(50, points, 4, 0)).toEqual({ value: 50 })
  })
})
