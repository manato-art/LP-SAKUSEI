/**
 * 画面に置いた Widget／LP の写しの CSS を「置いた場所の中だけ」に効かせることの機械証明。
 *
 * 実測（2026-09-11）: バージョン一覧のサムネイルと左の「設置済みWidget」が、Widget の <style> をそのまま置いていた。
 * そのCSSが編集画面全体に効き、キャンバスと Widget編集のプレビューに PC 用の @media の値（min-width:1000px）が出て
 * （本人指定の「LPの幅620pxで判定」が崩れる）、SquadBeyond の編集画面用CSS（.ql-editor の指定など）も画面全体に効いていた。
 *
 * CSSOM を使う部分はブラウザで確かめ、ここでは次を確かめる:
 *   - セレクタの範囲づけ（ページ全体への指定は CSS変数だけを移す）
 *   - 写しを置く箇所が、必ず範囲づけを通していること（ソースを読んで確認）
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  scopeStyleRule,
  splitSelectorList,
  stripPageLevelPrefix,
  type StyleRuleLike,
} from '../src/app/panels/widget-style-scope.ts'

/** CSSOM の規則の代わり（宣言は [名前, 値, 優先度] の並び） */
function fakeRule(selectorText: string, declarations: readonly (readonly [string, string, string?])[]): StyleRuleLike {
  return {
    selectorText,
    style: {
      cssText: declarations
        .map(([name, value, priority]) => `${name}: ${value}${priority === undefined ? '' : ` !${priority}`};`)
        .join(' '),
      length: declarations.length,
      item: (index: number) => declarations[index]?.[0] ?? '',
      getPropertyValue: (name: string) => declarations.find((d) => d[0] === name)?.[1] ?? '',
      getPropertyPriority: (name: string) => declarations.find((d) => d[0] === name)?.[2] ?? '',
    },
  }
}

const S = '[data-sb-style-scope="1"]'

describe('セレクタを入れ物の中だけに向ける', () => {
  it('括弧の中のカンマでは分けない', () => {
    expect(splitSelectorList('.a, :is(.b, .c) .d,[data-x="1,2"] .e')).toEqual([
      '.a',
      ' :is(.b, .c) .d',
      '[data-x="1,2"] .e',
    ])
  })

  it.each([
    ['body .x', '.x'],
    ['html > body .x', '.x'],
    ['body>.x', '.x'],
    [':root', ''],
    ['body', ''],
    ['html body', ''],
    ['.body .x', '.body .x'],
    ['bodyish', 'bodyish'],
  ])('ページ側の前置きを外す: %s → "%s"', (selector, expected) => {
    expect(stripPageLevelPrefix(selector)).toBe(expected)
  })

  it('Widget の中を指す規則は scope を前に付ける（ページ側の body は外す）', () => {
    expect(scopeStyleRule(fakeRule('.a, body .b', [['color', 'red']]), S)).toBe(`${S} .a,${S} .b{color: red;}`)
  })

  it('html / body そのものへの背景・高さ・余白は移さない（Widget の枠が塗られてしまう）', () => {
    const rule = fakeRule('html, body', [
      ['height', '100vh'],
      ['background-color', 'rgb(236, 236, 236)'],
      ['margin', '0px'],
    ])
    expect(scopeStyleRule(rule, S)).toBe('')
  })

  it(':root の CSS変数は scope に移す（Widget の var(--…) が効くように）', () => {
    const rule = fakeRule(':root', [
      ['--arrow-color', '#ff0000'],
      ['color', 'blue'],
      ['--gap', '8px', 'important'],
    ])
    expect(scopeStyleRule(rule, S)).toBe(`${S}{--arrow-color:#ff0000;--gap:8px !important}`)
  })

  it('ページ全体と Widget の中が混ざっていたら、中の方はそのまま・ページ側は変数だけ', () => {
    const rule = fakeRule('body, .c', [
      ['--x', '1px'],
      ['color', 'red'],
    ])
    expect(scopeStyleRule(rule, S)).toBe(`${S} .c{--x: 1px; color: red;}${S}{--x:1px}`)
  })
})

describe('Widget／LP の写しを画面に置く箇所は、CSS を入れ物の中に閉じ込めている', () => {
  it.each([
    ['src/app/pages/editor-version-list.ts', 'preview.innerHTML = thumbHtml', "containWidgetStyles(preview, 'lp')"],
    [
      'src/app/panels/widget-nav.ts',
      'previewContent.innerHTML = widgetNode.innerHTML',
      "containWidgetStyles(previewContent, 'widget')",
    ],
  ])('%s', (file, insert, contain) => {
    const lines = readFileSync(file, 'utf8').split('\n')
    const at = lines.findIndex((line) => line.includes(insert))
    expect(at, `${insert} が見つからない`).toBeGreaterThanOrEqual(0)
    expect(lines.slice(at + 1, at + 4).join('\n')).toContain(contain)
  })

  it('Widget編集のプレビューは入れ物に目印を付け、その中だけに効く CSS を当てる', () => {
    const source = readFileSync('src/app/panels/widget-visual-editor.ts', 'utf8')
    expect(source).toContain('markStyleScope(contentDiv)')
    expect(source).toContain('widgetPreviewCss(css, previewScope)')
  })

  it('LP編集画面のキャンバスは、元の <style> を止めて範囲づけした写しで表示する', () => {
    const source = readFileSync('src/app/panels/widget-editor.ts', 'utf8')
    expect(source).toContain("scopeWidgetCss(style.textContent ?? '', CANVAS_SCOPE)")
    expect(source).toContain('style.sheet.disabled = true')
  })
})
