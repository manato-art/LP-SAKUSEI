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

/**
 * 広告のIDは本文にそのまま出る（`utm_campaign=120251863095430695`）。
 * 実在の広告アカウントの識別子なので土台には持ち込まない。
 * 桁数は見た目に効くので保つ。
 */
describe('本文に出てくる長い数字のID', () => {
  it('12桁以上の数字を架空値へ置き換える（桁数は保つ）', () => {
    const out = scrubDomNumbers('<span>utm_campaign=120251863095430695</span>')
    expect(out).not.toContain('120251863095430695')
    expect(out).toMatch(/^<span>utm_campaign=\d{18}<\/span>$/)
  })

  it('同じIDは常に同じ架空値になる（表の中で食い違わない）', () => {
    const a = scrubDomNumbers('<td>120251863095430695</td>')
    const b = scrubDomNumbers('<div>120251863095430695</div>')
    expect(a.replace(/td/g, 'X')).toBe(b.replace(/div/g, 'X'))
  })

  it('PVや日付のような短い数字は触らない', () => {
    expect(scrubDomNumbers('<span>PV: 47</span>')).toBe('<span>PV: 47</span>')
    expect(scrubDomNumbers('<span>2026-09-08</span>')).toBe('<span>2026-09-08</span>')
  })

  it('属性の中の長い数字は触らない（識別に使われる）', () => {
    const input = '<div data-id="120251863095430695">x</div>'
    expect(scrubDomNumbers(input)).toBe(input)
  })
})
