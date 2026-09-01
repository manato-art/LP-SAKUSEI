import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { normalizeDotsMenuHtml } from '../src/app/panels/dots-menu-normalize.ts'

/**
 * 「…」メニューの構造正規化。採取物は先頭2項目が span 内 li の不正入れ子で、
 * innerHTML に入れると「複製」1項目しか残らない（実測）。正規化で5項目を平らにする。
 */
const MENU = 'src/app/fragments/ab_tests__UID__articles__version-dots-menu.portals.html'

/** バランス走査で ul 直下の <li>（入れ子でない葉）を数える */
function topLevelMenuItems(html: string): string[] {
  const ulOpen = /<ul\b[^>]*MuiMenu-list[^>]*>/i.exec(html)
  if (ulOpen === null) return []
  const start = ulOpen.index + ulOpen[0].length
  const end = html.indexOf('</ul>', start)
  const inner = html.slice(start, end)
  const token = /<li\b[^>]*>|<\/li\s*>/gi
  const items: string[] = []
  let depth = 0
  let openAt = -1
  let m = token.exec(inner)
  while (m !== null) {
    if (m[0].startsWith('</')) {
      depth -= 1
      if (depth === 0 && openAt >= 0) {
        const li = inner.slice(openAt, m.index + m[0].length)
        const label = /MuiListItemText-primary[^>]*>([^<]*)</.exec(li)?.[1] ?? ''
        items.push(label.trim())
        openAt = -1
      }
    } else {
      if (depth === 0) openAt = m.index
      depth += 1
    }
    m = token.exec(inner)
  }
  return items
}

describe('normalizeDotsMenuHtml', () => {
  const raw = readFileSync(MENU, 'utf8')

  it('採取物そのままは ul 直下が入れ子（先頭項目が本物の li を内包する）', () => {
    const before = topLevelMenuItems(raw)
    // 先頭のトップレベル li は複製の“ラッパー”で、ラベルは直下に無い（入れ子のため空）
    expect(before[0]).toBe('')
  })

  it('正規化すると ul 直下に5項目が平らに並ぶ（順番も実物どおり）', () => {
    const items = topLevelMenuItems(normalizeDotsMenuHtml(raw))
    expect(items).toEqual([
      '複製',
      '別のbeyondページに複製',
      'HTMLをダウンロード',
      'アーカイブする',
      '選択してアーカイブする',
    ])
  })

  it('不正なラッパー（_trigger_ / _dropdownChoice_）は ul の中に残らない', () => {
    const out = normalizeDotsMenuHtml(raw)
    const ulOpen = /<ul\b[^>]*MuiMenu-list[^>]*>/i.exec(out)
    const start = (ulOpen?.index ?? 0) + (ulOpen?.[0].length ?? 0)
    const ulInner = out.slice(start, out.indexOf('</ul>', start))
    expect(ulInner).not.toContain('_dropdownChoice_')
    expect(ulInner).not.toContain('_trigger_')
  })

  it('目印が無ければ壊さず raw をそのまま返す', () => {
    expect(normalizeDotsMenuHtml('<div>no menu here</div>')).toBe('<div>no menu here</div>')
  })
})
