/**
 * 見たまま画面に、アプリ（管理画面）の全体のCSSが漏れていた（2026-09-24・点検で見つけた食い違い）。
 * アプリのCSS（capture/clean/_merged/cssom.css）の `i { margin-right: 10px; font-size: 30px; }` と `label { display: block; }` が、
 * Widget の中の斜体・下向きの矢印・ロード中の点々・見本のラベルに効き、配信のLP（効かない）と見え方が違った。
 * 見たまま画面のCSSの先頭で、ブラウザの標準に戻す（Widget 自身のCSSは後ろなので、そちらが勝つ）。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PREVIEW_LEAK_RESET } from '../src/app/panels/widget-style-scope.ts'

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('見たまま画面にアプリのCSSを漏らさない', () => {
  it('アプリのCSSには、見え方を変えるタグの指定がある（これが漏れていた）', () => {
    const app = read('capture/clean/_merged/cssom.css')
    expect(app).toContain('i { margin-right: 10px; font-size: 30px; }')
    expect(app).toContain('label { display: block; }')
  })

  it('見たまま画面では、i と label をブラウザの標準に戻す', () => {
    expect(PREVIEW_LEAK_RESET).toMatch(/(^|\})i\{margin-right:0;font-size:inherit\}/)
    expect(PREVIEW_LEAK_RESET).toMatch(/label\{display:inline\}/)
  })

  it('打ち消しは Widget のCSSより前に置く（Widget 自身の i・label の指定が勝つ）', () => {
    const visual = read('src/app/panels/widget-visual-editor.ts')
    expect(visual).toContain('widgetPreviewCss(PREVIEW_LEAK_RESET + css, previewScope, previewWidth)')
  })
})
