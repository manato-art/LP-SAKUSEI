/**
 * ダークモードの色変換（2026-09-13・本人指示「ダークモードの実装。デフォルトはライト」）。
 *
 * 採取した実物CSS（約971KB・色の宣言4,108箇所）は書き換えられないので、
 * ダークのときだけ読み込む上書きCSSを、このルールで機械的に作る。
 *   - 灰色系（彩度が低い色）は明るさを反転する＝白地が暗くなり、黒文字が明るくなる
 *   - ブランド色（青・オレンジなど彩度のある色）はそのまま残す＝見た目の印象を変えない
 *   - ただし「薄い色の地」は暗い地に置き換える（そのままだと暗い画面で眩しい）
 *   - 影（box-shadow）は黒のまま＝暗い画面で白い影になると光って見える
 */
import { describe, expect, it } from 'vitest'
import { mapDarkDeclaration } from '../src/shared/dark-color.ts'

describe('灰色系は明るさを反転する', () => {
  it('白い地は暗くなる（真っ黒にはしない）', () => {
    const out = mapDarkDeclaration('background-color', 'rgb(255, 255, 255)')
    expect(out).not.toBeNull()
    expect(out).toMatch(/^rgb\(/)
    const [r, g, b] = (out ?? '').match(/\d+/g)?.map(Number) ?? []
    expect(r).toBeLessThan(45)
    expect(r).toBeGreaterThan(10)
    expect(r).toBe(g)
    expect(g).toBe(b)
  })

  it('黒い文字は明るくなる（真っ白にはしない）', () => {
    const out = mapDarkDeclaration('color', '#151515')
    const [r] = (out ?? '').match(/\d+/g)?.map(Number) ?? []
    expect(r).toBeGreaterThan(200)
    expect(r).toBeLessThan(250)
  })

  it('画面の地色 #ECECEC は暗いグレーになる', () => {
    const out = mapDarkDeclaration('background', '#ECECEC')
    const [r] = (out ?? '').match(/\d+/g)?.map(Number) ?? []
    expect(r).toBeLessThan(60)
  })
})

describe('明るさの向きを見て、必要な方だけ反転する', () => {
  it('もともと暗い地はそのまま（反転すると暗い画面で白い板になる）', () => {
    expect(mapDarkDeclaration('background-color', '#333333')).toBeNull()
    expect(mapDarkDeclaration('background', 'rgb(42, 56, 70)')).toBeNull()
  })

  it('もともと明るい文字はそのまま（暗い地の上に載っているので反転すると読めなくなる）', () => {
    expect(mapDarkDeclaration('color', '#B0B0B0')).toBeNull()
    expect(mapDarkDeclaration('color', 'rgb(255, 255, 255)')).toBeNull()
  })

  it('罫線は明るいものだけ暗くする', () => {
    expect(mapDarkDeclaration('border-color', '#DDDDDD')).not.toBeNull()
    expect(mapDarkDeclaration('border-color', '#333333')).toBeNull()
  })
})

describe('灰色に近い色（スレート系）も灰色として扱う', () => {
  it('濃いスレートの文字は明るくする（#1F2937 のような、わずかに青みのある黒に近い色）', () => {
    expect(mapDarkDeclaration('color', '#1F2937')).not.toBeNull()
    expect(mapDarkDeclaration('color', '#374151')).not.toBeNull()
  })

  it('鮮やかな色は、暗くても明るくしない', () => {
    expect(mapDarkDeclaration('color', '#0B3D91')).toBeNull()
  })
})

describe('ブランド色は変えない', () => {
  it('実物の青はそのまま', () => {
    expect(mapDarkDeclaration('color', 'rgb(0, 134, 255)')).toBeNull()
  })

  it('警告の赤もそのまま', () => {
    expect(mapDarkDeclaration('color', 'rgb(255, 82, 82)')).toBeNull()
  })

  it('薄い色の地は、同じ色味の暗い地にする（眩しくならないように）', () => {
    const out = mapDarkDeclaration('background-color', '#E6F4FF')
    expect(out).not.toBeNull()
    const [r = 0, g = 0, b = 0] = (out ?? '').match(/\d+/g)?.map(Number) ?? []
    expect(Math.max(r, g, b)).toBeLessThan(120) // 暗い
    expect(b).toBeGreaterThan(r) // 青みは残す
  })
})

describe('そのまま残すもの', () => {
  it('影は変えない（暗い画面で白く光らないように）', () => {
    expect(mapDarkDeclaration('box-shadow', '0 1px 4px rgba(0, 0, 0, 0.12)')).toBeNull()
    expect(mapDarkDeclaration('text-shadow', '0 1px 0 #FFFFFF')).toBeNull()
  })

  it('色が入っていない値は対象外', () => {
    expect(mapDarkDeclaration('padding', '10px 12px')).toBeNull()
    expect(mapDarkDeclaration('background', 'none')).toBeNull()
  })

  it('見た目が変わらない色は出力しない（上書きCSSを無駄に太らせない）', () => {
    expect(mapDarkDeclaration('color', 'transparent')).toBeNull()
    expect(mapDarkDeclaration('background-color', 'inherit')).toBeNull()
  })
})

describe('透明度と書き方', () => {
  it('rgba の透明度は保つ', () => {
    const out = mapDarkDeclaration('background-color', 'rgba(255, 255, 255, 0.8)')
    expect(out).toContain('0.8')
  })

  it('値の中に色が複数あっても全部変える', () => {
    const out = mapDarkDeclaration('border', '1px solid #FFFFFF')
    expect(out).toContain('1px solid')
    expect(out).not.toContain('#FFFFFF')
  })
})
