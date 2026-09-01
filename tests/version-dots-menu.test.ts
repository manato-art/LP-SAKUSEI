import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  DOTS_MENU_HOOK,
  DOTS_MENU_LABELS,
  buildVersionHtmlDocument,
  versionHtmlFilename,
} from '../src/app/panels/version-dots-menu.ts'

/**
 * バージョンカードの「…」メニュー（task 1）。
 * 目印・文言は**採取した実物をパースして**突き合わせる（手本 tests/toolbar-from-capture.test.ts）。
 */
const MENU = 'src/app/fragments/ab_tests__UID__articles__version-dots-menu.portals.html'
const EDITOR = 'src/app/fragments/ab_tests__UID__articles__editor-target.html'
const MENU_CSSOM = 'capture/clean/ab_tests__UID__articles/version-dots-menu/cssom.css'

function read(path: string): string {
  return readFileSync(path, 'utf8')
}

describe('「…」メニューの文言・目印は採取物に実在する（task 1）', () => {
  const menu = read(MENU)

  it('5項目すべての文言が採取物にある（順番も実物どおり）', () => {
    const labels = [
      DOTS_MENU_LABELS.duplicate,
      DOTS_MENU_LABELS.duplicateToOther,
      DOTS_MENU_LABELS.downloadHtml,
      DOTS_MENU_LABELS.archive,
      DOTS_MENU_LABELS.archiveSelected,
    ]
    let cursor = -1
    for (const label of labels) {
      const at = menu.indexOf(`>${label}<`)
      expect(at, `「${label}」が採取物に無い`).toBeGreaterThan(cursor)
      cursor = at
    }
  })

  it('メニュー本体の目印（Popover / backdrop / menuitem）が採取物にある', () => {
    expect(menu).toContain('role="presentation"')
    expect(menu).toContain('MuiBackdrop-root')
    expect(menu).toContain('role="menuitem"')
    expect(menu).toContain('MuiListItemText-primary')
  })

  it('トリガー css-3tls8 は editor-target のカードのボタン群にある', () => {
    const html = read(EDITOR)
    const buttons = /_articleButtons_1xibh_160[\s\S]{0,1200}?Article-BtnCreateNewArticle/.exec(html)?.[0]
    expect(buttons).toBeDefined()
    expect(buttons).toContain('css-3tls8')
    expect(DOTS_MENU_HOOK.trigger).toBe('button.css-3tls8')
  })

  it('メニューのCSSクラスは採取した実CSSに実在する（手書きCSSを足さずに済む根拠）', () => {
    const css = read(MENU_CSSOM)
    expect(css).toContain('css-1ppmnxd') // MuiMenu-paper
    expect(css).toContain('css-1apttes') // MuiMenu-list
  })
})

describe('HTMLダウンロードの組み立て（純粋関数）', () => {
  it('doctype・title・css・html を1つの文書にまとめる', () => {
    const doc = buildVersionHtmlDocument({ name: 'Ver.3873', html: '<p>hi</p>', css: 'p{color:red}' })
    expect(doc.startsWith('<!doctype html>')).toBe(true)
    expect(doc).toContain('<title>Ver.3873</title>')
    expect(doc).toContain('<style>p{color:red}</style>')
    expect(doc).toContain('<body><p>hi</p></body>')
  })

  it('title の中身はエスケープする（XSSにしない）', () => {
    const doc = buildVersionHtmlDocument({ name: '<script>', html: '', css: '' })
    expect(doc).toContain('<title>&lt;script&gt;</title>')
    expect(doc).not.toContain('<title><script></title>')
  })

  it('ファイル名は Version 名 + .html（禁止文字は _ に）', () => {
    expect(versionHtmlFilename('Ver.3873')).toBe('Ver.3873.html')
    expect(versionHtmlFilename('a/b:c')).toBe('a_b_c.html')
    expect(versionHtmlFilename('   ')).toBe('version.html')
  })
})
