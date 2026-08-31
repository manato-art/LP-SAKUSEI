import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { NAV_ACTIVE_CLASS, NAV_INACTIVE_CLASS } from '../src/app/shell-nav.ts'

/**
 * サイドバーの選択状態は、手書きの色ではなく**実物のクラスの入れ替え**で表す。
 * 実物は css-1glhrva（非選択）↔ css-122fq35（選択）を差し替えている。
 */
const SIDEBAR = 'src/app/templates/sidebar.html'
const CSSOM = 'capture/clean/folders/empty-selection/cssom.css'

describe('サイドバーの選択状態は採取物のクラスで表す', () => {
  const html = readFileSync(SIDEBAR, 'utf8')
  const css = readFileSync(CSSOM, 'utf8')

  it('選択・非選択のクラスが採取した実DOMに存在する', () => {
    expect(html).toContain(NAV_ACTIVE_CLASS)
    expect(html).toContain(NAV_INACTIVE_CLASS)
  })

  it('実物では選択が1件・非選択が11件（12項目のうち1つだけ選択）', () => {
    const count = (needle: string): number => html.split(needle).length - 1
    expect(count(NAV_ACTIVE_CLASS)).toBe(1)
    expect(count(NAV_INACTIVE_CLASS)).toBe(11)
  })

  it('選択クラスの背景色が採取CSSに定義されている（手書きしない）', () => {
    expect(css).toMatch(new RegExp(`\\.${NAV_ACTIVE_CLASS}[^}]*background:[^;}]+`))
  })

  it('shell.ts に色を直書きしていない', () => {
    expect(readFileSync('src/app/shell.ts', 'utf8')).not.toContain('#FDF3E3')
  })
})
