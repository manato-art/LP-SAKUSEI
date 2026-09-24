/**
 * 左の列の「部品を足す」（2026-09-24・本人「ここに表示するのは11個＋もっと見る。
 * もっと見るを押したら、同じ左のツールバーのままでサムネ付きで全部表示」。11個は本人の選択「今の10種＋移行先」）。
 */
import { describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'
import { PALETTE_FIRST, PALETTE_GROUPS, createPalette } from '../src/app/panels/nocode/palette.ts'
import { ALL_BLOCK_TYPES, BUILDER_TEMPLATE } from '../src/app/panels/nocode/templates/builder.ts'
import type { ScreensField } from '../src/app/panels/nocode/templates/types.ts'
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

  it('部品（型を除く）は増えて、全部で23種になった', () => {
    expect(ALL_BLOCK_TYPES.filter((t) => t.type !== 'sample' && !isTemplateBlock(t.type)).length).toBe(23)
  })
})

describe('まとまった型は、部品とは別の段（2026-09-24・本人「部品とまとまった型は違う機能。消えたまとまった型の項目を復活」）', () => {
  const field = BUILDER_TEMPLATE.fields.find((f): f is ScreensField => f.kind === 'screens') as ScreensField
  const templates = ALL_BLOCK_TYPES.filter((t) => isTemplateBlock(t.type))

  it('部品を足す（11個＋もっと見る）の下に「まとまった型」の段があり、型が全部2列の並びで出る', () => {
    const { document } = parseHTML('<!doctype html><html><body></body></html>')
    ;(globalThis as unknown as Record<string, unknown>)['document'] = document
    const el = createPalette().render(field, 0, { add: () => undefined, canPickSample: true })
    const titles = [...el.querySelectorAll('.ncf-palette__title')].map((t) => t.textContent)
    expect(titles).toEqual(['部品を足す', 'まとまった型'])
    const chips = [...el.querySelectorAll('.ncf-palette__tpl > button')].map((b) => b.textContent)
    expect(chips).toEqual(templates.map((t) => t.label))
    // 型は部品のタイルの中には入らない（型の「ボタン」と部品の「ボタン」は名前が同じなので、形で見分ける）
    expect(el.querySelectorAll('.ncf-palette__grid > button').length).toBe(12)
    expect(el.querySelectorAll('.ncf-palette__grid > .ncf-palette__chip').length).toBe(0)
    // いちばん下はライブラリの見本
    expect(el.lastElementChild?.textContent).toBe('ライブラリの見本から選ぶ')
  })

  it('もっと見る（すべての部品）には型を入れない', () => {
    const grouped = PALETTE_GROUPS.flatMap((g) => g.types)
    for (const t of templates) expect(grouped).not.toContain(t.type)
  })
})
