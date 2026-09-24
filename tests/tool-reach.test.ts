/**
 * ツール4画面（一括タグ / マジック置換 / メディア / 審査・審査対象）に、
 * スマホ・タッチのタブレット・PCのどれからでも行けることの機械証明。
 *
 * 以前の行き止まり:
 *   - 各画面が `.ehppitp0` を丸ごと空にして描いていたので、その中にあるサブナビまで消えていた
 *   - スマホ用の横並びサブナビは、採取物では PC 用の枠（hidden md:flex）の中にあり、スマホでは枠ごと消えていた
 *   - サイドバーの「ツール」はマウスを載せたときしか開かなかった（タッチでは開かない）
 *   - 下のタブバーの「ツール」は一括タグにしか行けず、今いる場所の判定も実在しないパスを見ていた
 *   - 審査対象へは閉じられる案内帯からしか行けなかった
 */
import { readFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'
import {
  INSPECTION_SCREENS,
  TOOL_SUBNAV_PATHS,
  matchToolPage,
  prepareToolLayout,
} from '../src/app/pages/tool-subnav.ts'
import { stripGlobalSidebar } from '../src/app/pages/sidebar-shell.ts'
import { isActiveTab } from '../src/app/mobile/bottom-nav.ts'

const FRAGMENTS = [
  'teams__tags__default.html',
  'articles__bulk_replaces__default.html',
  'teams__product_search_forms__default.html',
  'inspections__folders__default.html',
]

function mount(file: string): HTMLElement {
  const html = readFileSync(`src/app/fragments/${file}`, 'utf8')
  const { document } = parseHTML(`<html><body><div id="root">${stripGlobalSidebar(html)}</div></body></html>`)
  const root = document.getElementById('root')
  if (root === null) throw new Error('root が作れません')
  return root as unknown as HTMLElement
}

function hasHiddenAncestor(node: Element, stop: Element): boolean {
  let cur = node.parentElement
  while (cur !== null && cur !== stop) {
    if (cur.classList.contains('hidden')) return true
    cur = cur.parentElement
  }
  return false
}

describe('画面の中身を描いてもサブナビが残る', () => {
  for (const file of FRAGMENTS) {
    it(`${file}: 中身の場所を空にしてもサブナビ5つが残る`, () => {
      const root = mount(file)
      const host = prepareToolLayout(root)
      expect(host).not.toBeNull()
      host?.replaceChildren()
      for (const path of TOOL_SUBNAV_PATHS) {
        expect(root.querySelectorAll(`a[href="${path}"]`).length).toBeGreaterThan(0)
      }
    })

    it(`${file}: スマホ用のサブナビが、スマホで消える枠の外に出る`, () => {
      const root = mount(file)
      prepareToolLayout(root)
      const mobileNavs = [...root.querySelectorAll('nav')].filter((n) => n.classList.contains('md:hidden'))
      expect(mobileNavs.length).toBe(1)
      for (const nav of mobileNavs) expect(hasHiddenAncestor(nav, root)).toBe(false)
    })
  }
})

describe('審査と審査対象を行き来できる（案内帯を閉じても）', () => {
  it('2画面の切り替えがあり、どちらも審査のページに解決する', () => {
    expect(INSPECTION_SCREENS.map((s) => s.label)).toEqual(['審査', '審査対象'])
    for (const s of INSPECTION_SCREENS) expect(matchToolPage(s.hash.replace(/^#/, ''))).toBe('inspections')
  })

  it('切り替えは案内帯（閉じられる）とは別に、2画面とも常に出す', () => {
    const src = readFileSync('src/app/pages/inspections-page.ts', 'utf8')
    expect(src.match(/screenSwitch\(/g)?.length ?? 0).toBeGreaterThanOrEqual(3)
  })
})

describe('サイドバーの「ツール」はタッチでも開く', () => {
  it('ホバーできない端末でも、開いたアコーディオンを見せる', () => {
    const src = readFileSync('src/app/shell.ts', 'utf8')
    const block = /@media \(hover:none\)\{[^`]*`[\s\S]*?\.sb-accordion-sub\.sb-accordion-open/.exec(src)
    expect(block).not.toBeNull()
  })
})

describe('下のタブバーの「ツール」', () => {
  it('ツール4画面のどれにいても「ツール」が今いる場所になる', () => {
    for (const hash of [
      '#/teams/tags',
      '#/articles/bulk_replaces',
      '#/teams/product_search_forms',
      '#/inspections',
      '#/inspections/folders',
    ]) {
      expect(isActiveTab(hash, '#/teams/tags')).toBe(true)
    }
  })

  it('ツール以外では「ツール」にならない', () => {
    expect(isActiveTab('#/folders', '#/teams/tags')).toBe(false)
    expect(isActiveTab('#/teams/domains', '#/teams/tags')).toBe(false)
  })
})
