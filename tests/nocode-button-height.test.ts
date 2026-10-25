/**
 * ボタンの縦の大きさ（2026-10-25 本人「ボタンの縦の大きさも変えたい」）。
 * 右の「レイアウト」の「高さ」（目立つボタンは 62px・選択肢は 56px が今の大きさ）と、見たまま画面の下の辺のつまみで変える。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ALL_BLOCK_TYPES, BUILDER_TEMPLATE } from '../src/app/panels/nocode/templates/builder.ts'
import type { ItemData } from '../src/app/panels/nocode/templates/types.ts'

const UID = 'nc-btnheig1'
const render = (block: ItemData): string =>
  BUILDER_TEMPLATE.render({ ...BUILDER_TEMPLATE.defaults(new Date(0)), screens: [{ id: 's1', name: '画面①', blocks: [block] }] }, UID)
const button = (extra: ItemData = {}): ItemData => ({ type: 'button', label: '申し込む', look: 'cta', color: '#E5573F', action: 'none', target: '', url: '', ...extra })

describe('ボタンの高さ', () => {
  it('右の「レイアウト」に「高さ」（今の大きさを見せる: 目立つ 62px・選択肢 56px）', () => {
    const fields = ALL_BLOCK_TYPES.find((t) => t.type === 'button')?.fields.filter((f) => f.key === 'height') ?? []
    expect(fields.map((f) => f.section)).toEqual(['layout', 'layout'])
    const shown = (look: string): number | undefined => {
      const f = fields.find((field) => field.showIfItem?.({ look }) === true)
      return f?.kind === 'number' ? f.fallback : undefined
    }
    expect(shown('cta')).toBe(62)
    expect(shown('choice')).toBe(56)
  })

  it('高さを決めると、その高さ（文字は真ん中・上下の余白は詰める）', () => {
    expect(render(button({ height: 44 }))).toContain(`.${UID} .nc-b-1 .nc-b-button__a{min-height:44px;padding-top:4px;padding-bottom:4px}`)
    expect(render(button({ look: 'choice', height: 90 }))).toContain('min-height:90px;padding-top:4px;padding-bottom:4px')
  })

  it('決めていなければ今までどおり（高さの決まりを書かない）', () => {
    expect(render(button())).not.toContain('padding-top:4px;padding-bottom:4px')
  })

  it('見たまま画面でも、ボタンの下の辺のつまみで高さを変えられる', () => {
    const builder = readFileSync('src/app/panels/widget-studio-builder.ts', 'utf8')
    expect(builder).toMatch(/type === 'button'[\s\S]{0,900}commitField\(path, 'height', n\)/)
  })
})
