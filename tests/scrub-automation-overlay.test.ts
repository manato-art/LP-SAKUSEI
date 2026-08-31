import { describe, it, expect } from 'vitest'
import { scrubText } from '../tools/scrub/scrub.ts'

const NO_HOST = { productionHostPattern: /(?!x)x/g }
const strip = (html: string): string => scrubText(html, {}, NO_HOST).text

describe('採取に使ったブラウザ自動化のオーバーレイを土台から除く', () => {
  it('発光枠の要素を消す', () => {
    const html = '<div id="claude-agent-glow-border" style="border:1px"></div><main>本文</main>'
    expect(strip(html)).toBe('<main>本文</main>')
  })

  it('偽カーソルの要素を消す（中身があっても消す）', () => {
    const html = '<div id="claude-phantom-cursor"><svg><path d="M0 0"/></svg></div><main>本文</main>'
    expect(strip(html)).toBe('<main>本文</main>')
  })

  it('注入されたstyleタグを消す', () => {
    const html = '<style id="claude-agent-animation-styles">.x{color:red}</style><main>本文</main>'
    expect(strip(html)).toBe('<main>本文</main>')
  })

  it('実物のstyleタグは消さない', () => {
    const html = '<style>.real{color:blue}</style>'
    expect(strip(html)).toBe(html)
  })

  it('実物のdivは消さない', () => {
    const html = '<div id="root"><p>本文</p></div>'
    expect(strip(html)).toBe(html)
  })
})

describe('アセットのファイル名をトークンと誤認しない', () => {
  it('長い英数のファイル名を置換しない（参照が切れて画像が出なくなる）', () => {
    const css = '.x{background:url(/assets/abcdefghijklmnopqrstuvwxyz0123456789.svg)}'
    expect(strip(css)).toBe(css)
  })

  it('拡張子が続かない長いトークンはこれまでどおり置換する', () => {
    const out = strip('token: abcdefghijklmnopqrstuvwxyz0123456789')
    expect(out).not.toContain('abcdefghijklmnopqrstuvwxyz0123456789')
  })
})
