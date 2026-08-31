import { describe, it, expect } from 'vitest'
import { applyDictionary, type ScrubMap } from '../tools/scrub/dictionary.ts'

const map: ScrubMap = {
  'a-bull': { category: 'campaign', replacement: 'サンプル施策861' },
  大山: { category: 'person', replacement: 'サンプル人物001' },
}

/**
 * ASCIIの短い実名が、無関係な識別子の一部に一致して置換を起こしていた。
 * 実際に FontAwesome の `.fa-bullhorn` が `.fサンプル施策861horn` に化けた。
 */
describe('ASCIIの辞書キーは語の境界でだけ置換する', () => {
  it('単語の一部には一致させない', () => {
    expect(applyDictionary('.fa-bullhorn::before', map)).toBe('.fa-bullhorn::before')
  })

  it('独立した語としてなら置換する', () => {
    expect(applyDictionary('brand: a-bull', map)).toBe('brand: サンプル施策861')
  })

  it('引用符やカンマに囲まれていても置換する', () => {
    expect(applyDictionary('["a-bull", "x"]', map)).toBe('["サンプル施策861", "x"]')
  })

  it('日本語のキーは境界を要求しない（語の区切りが無いため）', () => {
    expect(applyDictionary('担当は大山です', map)).toBe('担当はサンプル人物001です')
  })
})
