/**
 * コード欄の「まとめてコピー」（2026-09-14・本人指示
 * 「HTMLとかのコード系は一括でコピーできるボタン」。PC・スマホ共通）。
 *
 * 長いHTML/CSS/JSを指やマウスで選び直さずに1回で写せるようにする。
 * コード欄がある画面すべてに同じ部品を置く（1つでも付け忘れると、そこだけ選択地獄になる）。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const MODULE = 'src/app/panels/code-copy.ts'

/** コード欄を持つ画面と、その入口ファイル */
const CODE_SCREENS: readonly [string, string][] = [
  ['Widget編集のHTML/CSS', 'src/app/panels/widget-code-panel.ts'],
  ['Widget作成のHTML/CSS', 'src/app/panels/widget-creator.ts'],
  ['タグ設定のJavaScript head/body', 'src/app/panels/tag-settings.ts'],
  ['計測タグの発行', 'src/app/panels/tracking-tag-modal.ts'],
  ['中間ページのタグ', 'src/app/pages/redirect-pages.ts'],
  ['離脱防止ポップのHTML', 'src/app/pages/exit-popup-editor.ts'],
  ['一括タグのhead/body', 'src/app/pages/bulk-tags-page.ts'],
  ['WidgetのHTML編集', 'src/app/panels/widget-manager.ts'],
]

describe('コードをまとめてコピーする', () => {
  const src = readFileSync(MODULE, 'utf8')

  it('共通の部品が1つある（画面ごとに書かない）', () => {
    expect(src).toContain('export function codeCopyButton')
    expect(src).toContain('navigator.clipboard.writeText')
  })

  it('絵文字でなくSVGアイコンを使う（プロジェクト共通の決まり）', () => {
    expect(src).toContain('<svg')
  })

  it('空のときはコピーしたふりをしない', () => {
    expect(src).toContain("'error'")
  })

  it('クリップボードが拒否されても諦めない（埋め込みブラウザ・非HTTPS・古い端末）', () => {
    // 2026-09-14: 埋め込みブラウザで navigator.clipboard が実際に拒否された
    expect(src).toContain("execCommand('copy')")
    // それでも駄目なら、せめて全部を選んだ状態にして手で写せるようにする
    expect(src).toContain('setSelectionRange(0, sourceEl.value.length)')
  })

  it('押したあと、コピーできたことが分かる', () => {
    expect(src).toContain('コピーしました')
  })

  for (const [screen, file] of CODE_SCREENS) {
    it(`${screen} にコピーボタンがある`, () => {
      expect(readFileSync(file, 'utf8')).toContain('codeCopyButton')
    })
  }
})
