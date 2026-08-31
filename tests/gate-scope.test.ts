import { describe, it, expect } from 'vitest'
import { SCAN_DIRS, SUSPICIOUS_MONEY_PATTERN } from '../tools/gate/denylist.ts'

describe('ゲートの走査範囲', () => {
  it('docs と tests とリポジトリ直下も走査する（実名はそこにも書かれる）', () => {
    expect(SCAN_DIRS).toContain('docs')
    expect(SCAN_DIRS).toContain('tests')
    expect(SCAN_DIRS).toContain('.')
  })
})

describe('金額らしき値の検出', () => {
  const find = (text: string): string[] => text.match(new RegExp(SUSPICIOUS_MONEY_PATTERN)) ?? []

  it('カンマ1組の金額も見つける（6桁を見逃していた）', () => {
    expect(find('¥123,456')).toEqual(['¥123,456'])
  })

  it('カンマ2組以上も引き続き見つける', () => {
    expect(find('¥1,234,567')).toEqual(['¥1,234,567'])
  })

  it('全角の円記号も見つける', () => {
    expect(find('￥123,456')).toEqual(['￥123,456'])
  })

  it('カンマ無しの4桁以上も見つける', () => {
    expect(find('¥12345')).toEqual(['¥12345'])
  })

  it('少額の表示（3桁以下）は誤検知しない', () => {
    expect(find('¥0')).toEqual([])
    expect(find('¥980')).toEqual([])
  })
})

describe('長い不透明トークンの検出', () => {
  const PATTERN = /\b(?![A-Z]+_\d{4}\b)(?=[A-Za-z0-9]*\d)[A-Za-z0-9]{32,}\b/g
  const find = (t: string): string[] => t.match(new RegExp(PATTERN)) ?? []

  it('英単語をつなげただけの識別子を誤検知しない', () => {
    expect(find('forceConsistentCasingInFileNames')).toEqual([])
  })

  it('数字を含む長いトークンは検知する', () => {
    expect(find('n4KqkOQrraxHJcgjM1RvwbigfQKIKJVpM7xp')).toEqual([
      'n4KqkOQrraxHJcgjM1RvwbigfQKIKJVpM7xp',
    ])
  })
})
