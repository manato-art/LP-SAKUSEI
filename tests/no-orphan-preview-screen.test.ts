/**
 * 行き先の無いプレビュー画面（上に「プレビューURL」「配信URL」の枠が2つ並ぶ画面）は置かない。
 *
 * 【経緯】この画面は `#/preview/<VersionのID>` と `#/ab_tests/<ID>/articles/<ID>/previews` で開く作りだったが、
 * 「プレビュー」ボタン・URLバー・比較モード・レポートのメニューは全部、サーバーが出す
 * `/preview/<VersionのID>`（赤い帯＋LPそのもの）を開く（指示142）。
 * 画面の振り分けだけが main.ts に残り、**アプリのどのボタンからも開けない画面**になっていた。
 *
 * 2026-10-13 の点検で、アドレスを直接打って開いたこの画面を「プレビューを押すと出る画面」と取り違え、
 * 配信URL・QRコード・スマホの並びを直してしまった。本人「コードだけあってたどり着かない画面はいらない」→ 画面ごと外した。
 * QRコードは、今までどおり編集画面の「比較する」から出せる。
 */
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const main = readFileSync('src/app/main.ts', 'utf8')

describe('行き先の無いプレビュー画面を置かない', () => {
  it('画面のファイルが無い', () => {
    expect(existsSync('src/app/pages/preview-page.ts')).toBe(false)
    expect(existsSync('src/app/pages/preview-url-cards.ts')).toBe(false)
  })

  it('main.ts に、その画面への振り分けが無い', () => {
    expect(main).not.toContain('preview-page')
    expect(main).not.toContain('renderPreview')
    expect(main).not.toMatch(/\\\/previews\$/)
    expect(main).not.toMatch(/\^\\\/preview\\\//)
  })

  it('「プレビュー」ボタンは、今までどおりサーバーが出すプレビュー（/preview/<VersionのID>）を開く', () => {
    const editor = readFileSync('src/app/pages/editor-layout.ts', 'utf8')
    expect(editor).toContain('const url = `${location.origin}/preview/${ctx.currentUid}`')
  })

  it('QRコードは、今までどおり比較モードから出せる', () => {
    const compare = readFileSync('src/app/panels/compare-mode.ts', 'utf8')
    expect(compare).toContain('toggleQrPopover(qrBtn, previewUrl)')
  })
})
