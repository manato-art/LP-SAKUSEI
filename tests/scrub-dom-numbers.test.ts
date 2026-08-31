import { describe, it, expect } from 'vitest'
import { scrubDomNumbers } from '../tools/scrub/dom-numbers.ts'

/**
 * 採取したDOMの本文に出る金額・件数は、JSONのようなフィールド名の手がかりが無い。
 * 実際にダッシュボードの実売上がそのままコミットされていた。
 */
describe('DOM本文の金額・数値を架空値へ置き換える', () => {
  it('円記号つきの金額を置き換える', () => {
    const out = scrubDomNumbers('<td>¥1,234,567</td>')
    expect(out).not.toContain('1,234,567')
    expect(out).toMatch(/<td>¥[\d,]+<\/td>/)
  })

  it('同じ金額は同じ架空値になる（表の合計が破綻しないように）', () => {
    const out = scrubDomNumbers('<td>¥123,456</td><td>¥123,456</td>')
    const found = [...out.matchAll(/¥([\d,]+)/g)].map((m) => m[1])
    expect(found[0]).toBe(found[1])
  })

  it('別の金額は別の架空値になる', () => {
    const out = scrubDomNumbers('<td>¥123,456</td><td>¥765,432</td>')
    const found = [...out.matchAll(/¥([\d,]+)/g)].map((m) => m[1])
    expect(found[0]).not.toBe(found[1])
  })

  it('桁区切りの形を保つ（見た目が変わらないように）', () => {
    const out = scrubDomNumbers('<td>¥1,234,567</td>')
    expect(out).toMatch(/¥\d{1,3}(,\d{3}){2}/)
  })

  it('パーセント表示も置き換える', () => {
    const out = scrubDomNumbers('<span>12.34%</span>')
    expect(out).not.toContain('12.34%')
    expect(out).toMatch(/<span>\d+\.\d{2}%<\/span>/)
  })

  it('0 と 0.00% は変えない（空アカウントの見た目を壊さない）', () => {
    expect(scrubDomNumbers('<td>¥0</td>')).toBe('<td>¥0</td>')
    expect(scrubDomNumbers('<span>0.00%</span>')).toBe('<span>0.00%</span>')
  })

  it('HTMLの属性や日付は触らない', () => {
    const html = '<div data-x="1,234" title="2026-08-31">本文</div>'
    expect(scrubDomNumbers(html)).toBe(html)
  })

  it('小さい数字（順位・件数の1〜3桁）は触らない', () => {
    expect(scrubDomNumbers('<td>12</td>')).toBe('<td>12</td>')
  })
})
