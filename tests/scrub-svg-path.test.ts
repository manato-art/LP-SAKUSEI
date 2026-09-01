import { describe, it, expect } from 'vitest'
import { scrubText } from '../tools/scrub/scrub.ts'

const NO_HOST = { productionHostPattern: /(?!x)x/g }
const strip = (html: string): string => scrubText(html, {}, NO_HOST).text

describe('SVGパスのd属性は幾何情報なのでスクラブしない', () => {
  it('長いトークンを含むパスデータをそのまま残す', () => {
    const html = '<path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 abcdefghijklmnopqrstuvwxyz012345.11 0-2z"/>'
    expect(strip(html)).toBe(html)
  })

  it('通常のアイコンパスを壊さない', () => {
    const html = '<path fill-rule="evenodd" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10z"/>'
    expect(strip(html)).toBe(html)
  })

  it('d属性の外の長いトークンは引き続きスクラブする', () => {
    const out = strip('<span>token n4KqkOQrraxHJcgjM1RvwbigfQKIKJVpM7xp here</span>')
    expect(out).not.toContain('n4KqkOQrraxHJcgjM1RvwbigfQKIKJVpM7xp')
  })
})
