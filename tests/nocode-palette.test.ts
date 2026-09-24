/**
 * 左の列の「部品を足す」（2026-09-24・本人「ここに表示するのは11個＋もっと見る。
 * もっと見るを押したら、同じ左のツールバーのままでサムネ付きで全部表示」。11個は本人の選択「今の10種＋移行先」）。
 */
import { describe, expect, it } from 'vitest'
import { PALETTE_FIRST, PALETTE_GROUPS } from '../src/app/panels/nocode/palette.ts'
import { ALL_BLOCK_TYPES } from '../src/app/panels/nocode/templates/builder.ts'
import { isTemplateBlock } from '../src/app/panels/nocode/templates/builder-blocks.ts'

describe('部品を足す', () => {
  it('ふだん見せるのは11個（今の10種＋移行先）', () => {
    expect(PALETTE_FIRST).toEqual(['heading', 'text', 'button', 'image', 'hotspot', 'imageText', 'list', 'shape', 'video', 'spacer', 'divider'])
    for (const type of PALETTE_FIRST) expect(ALL_BLOCK_TYPES.some((t) => t.type === type), type).toBe(true)
  })

  it('もっと見るには、見本（ライブラリから選ぶ）と型の部品（まとまった型）以外の全部の部品が、どこかの分類に1回だけ入る', () => {
    const grouped = PALETTE_GROUPS.flatMap((g) => g.types)
    expect(new Set(grouped).size).toBe(grouped.length)
    const parts = ALL_BLOCK_TYPES.filter((t) => t.type !== 'sample' && !isTemplateBlock(t.type)).map((t) => t.type)
    expect([...grouped].sort()).toEqual([...parts].sort())
  })

  it('部品は増えて、全部で30種以上になった（型の部品を含む）', () => {
    expect(ALL_BLOCK_TYPES.filter((t) => t.type !== 'sample').length).toBeGreaterThanOrEqual(30)
  })
})
