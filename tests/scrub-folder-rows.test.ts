import { describe, it, expect } from 'vitest'
import { dropFolderRows, SIDEBAR_NAV_LABELS } from '../tools/scrub/folder-rows.ts'

/**
 * サイドバーのフォルダ一覧は顧客のフォルダ名そのもの＝実データ。
 * クローンの基準は「新規の空アカウント」なので、行の中身は再現対象外。
 * 構造（枠とクラス）は土台として要るので、**行だけ**落とす。
 */
describe('サイドバーのフォルダ行を落とす（構造は残す）', () => {
  it('固定ナビの12項目は残す（これはマイクロコピー）', () => {
    for (const label of SIDEBAR_NAV_LABELS) {
      const html = `<div data-testid="list-menu-item"><span>${label}</span></div>`
      expect(dropFolderRows(html)).toContain(label)
    }
  })

  it('固定ナビに無い行は中身ごと落とす', () => {
    const html = '<div data-testid="list-menu-item"><span>取引先Aのフォルダ</span></div>'
    expect(dropFolderRows(html)).not.toContain('取引先Aのフォルダ')
  })

  it('落とした行の要素自体は残す（枠が消えるとレイアウトが変わる）', () => {
    const html = '<div data-testid="list-menu-item"><span>取引先A</span></div>'
    const out = dropFolderRows(html)
    expect(out).toContain('data-testid="list-menu-item"')
  })

  it('ナビ以外の要素には触らない', () => {
    const html = '<div class="other">取引先A</div>'
    expect(dropFolderRows(html)).toBe(html)
  })

  it('複数行をまとめて落とす', () => {
    const html =
      '<div data-testid="list-menu-item"><span>ダッシュボード</span></div>' +
      '<div data-testid="list-menu-item"><span>取引先A</span></div>' +
      '<div data-testid="list-menu-item"><span>取引先B</span></div>'
    const out = dropFolderRows(html)
    expect(out).toContain('ダッシュボード')
    expect(out).not.toContain('取引先A')
    expect(out).not.toContain('取引先B')
  })
})
