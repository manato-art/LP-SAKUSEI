/**
 * 数字をドラッグで変える計算（2026-09-23・Widget編集 第2弾・Canva風）。
 */
import { describe, expect, it } from 'vitest'
import { clamp, dragValue, handleKindOf, scrubValue, sliderRange, snapToStep } from '../src/app/panels/drag-math.ts'

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
