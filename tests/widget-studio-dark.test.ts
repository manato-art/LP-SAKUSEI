/**
 * Widget編集のダーク表示（2026-09-24・本人の決定「周りだけ暗く・Widgetは白」）。
 *
 * 周り（ヘッダー・地・右の欄・書式ツールバー・小窓）はアプリの他の画面と同じく暗くする。
 * まん中の見たまま画面（LPに入る中身）は、配信されるLPと同じく白地・黒い文字のまま。
 * ライトの見た目は今までと同じ（使う変数のライト側は元の色）。
 */
import { readFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'
import { isRuntimeDarkSkipped } from '../src/app/dark-runtime-css.ts'

const read = (path: string): string => readFileSync(new URL(`../src/app/${path}`, import.meta.url), 'utf8')

/** 周り（部品の中身を作らない）で、地の色を直書きしてはいけないファイル */
const CHROME_FILES = [
  'panels/widget-studio.ts',
  'panels/widget-studio-builder.ts',
  'panels/widget-code-panel.ts',
  'panels/size-popover.ts',
  'panels/align-menu.ts',
  'panels/widget-link-bubble.ts',
  'panels/widget-media-control.ts',
]

/** ダークでも白のままでよいもの（暗い地・青い地の上に載る白）。「デフォルト時のコードを表示」のスイッチのつまみ */
const WHITE_ON_DARK = ['`background:#fff;transition:left .2s;box-shadow']

/** `var(--名前, #色)` と白のままでよいものを外した残り（ライト側の値として書いた色は数えない） */
const withoutVars = (src: string): string =>
  WHITE_ON_DARK.reduce((rest, keep) => rest.replace(keep, 'KEEP'), src).replace(/var\(--[\w-]+,\s*#[0-9a-fA-F]{3,8}\)/g, 'VAR')

describe('見たまま画面（LPに入る中身）はダークでも白地・黒い文字', () => {
  const visual = read('panels/widget-visual-editor.ts')

  it('プレビューの <style> と Widget の中の <style> は、ダークの上書きを作らない', () => {
    expect(visual).toContain("styleTag.dataset['darkRuntime'] = 'skip'")
    expect(visual).toContain("contentDiv.dataset['darkRuntime'] = 'skip'")
  })

  it('文字は配信と同じ黒（ダークの color-scheme を継がない）', () => {
    expect(visual).toMatch(/contentDiv\.style\.cssText =[\s\S]{0,200}color:#000;color-scheme:light/)
  })

  it('LPの枠は、620pxの箱が白い紙（周りの地はアプリの色）', () => {
    expect(visual).toMatch(/return \{ backdrop: 'transparent', box: `width:\$\{WIDGET_PREVIEW_WIDTH\}px;[^`]*background:#fff/)
  })

  it('ポップアップの枠の地は配信の見え方のまま（離脱防止＝暗い地・追従型＝LPの白）', () => {
    expect(visual).toContain("if (frame === 'overlay') return { backdrop: '#999999'")
    expect(visual).toContain("if (frame === 'corner') return { backdrop: '#fff'")
  })
})

describe('ダークの上書きを作らない印（data-dark-runtime="skip"）', () => {
  const { document } = parseHTML(
    '<html><head><style id="a"></style><style id="b" data-dark-runtime="skip"></style></head>' +
      '<body><div data-dark-runtime="skip"><div><style id="c"></style></div></div><style id="d"></style></body></html>',
  )
  const style = (id: string): Element => document.getElementById(id) as Element

  it('印の付いた <style> と、印の付いた入れ物の中の <style> は対象外', () => {
    expect(isRuntimeDarkSkipped(style('b'))).toBe(true)
    expect(isRuntimeDarkSkipped(style('c'))).toBe(true)
  })

  it('印の無い <style> は今までどおり上書きを作る', () => {
    expect(isRuntimeDarkSkipped(style('a'))).toBe(false)
    expect(isRuntimeDarkSkipped(style('d'))).toBe(false)
  })
})

describe('周りはダークで暗くなる', () => {
  it('書式ツールバーは実行時の上書きの対象（白い帯のまま残さない）', () => {
    expect(read('panels/widget-toolbar-css.ts')).not.toContain("dataset['darkRuntime'] = 'skip'")
  })

  it('周りのファイルは、白い地を直書きしない（var(--sb-c-ffffff, #FFFFFF) を通す）', () => {
    for (const file of CHROME_FILES) {
      const rest = withoutVars(read(file))
      expect(rest, file).not.toMatch(/background:\s*#fff(fff)?\b/i)
      expect(rest, file).not.toMatch(/background = [^\n]*'#fff(fff)?'/i)
    }
  })

  it('右の欄の赤い文字（消す・エラー・全部消して作り直す）は、ダークでは明るい赤（暗い地・選んだ行の地の上でも読める）', () => {
    const css = read('panels/nocode/nocode-form-css.ts')
    const m = /html\[data-theme="dark"\] :is\(([^)]*)\)\{color:(#[0-9A-F]{6})\}/.exec(css)
    expect(m).not.toBeNull()
    for (const sel of ['.ncf-item__remove', '.ncf-btn.ncf-danger', '.ncf-error', '.ncf-warn', '.ncf-listhead .ncf-reset']) {
      expect(m?.[1], sel).toContain(sel)
    }
    const channel = (n: number): number => (n / 255 <= 0.03928 ? n / 255 / 12.92 : ((n / 255 + 0.055) / 1.055) ** 2.4)
    const lum = (r: number, g: number, b: number): number => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
    const hex = m?.[2] ?? '#000000'
    const red = lum(Number.parseInt(hex.slice(1, 3), 16), Number.parseInt(hex.slice(3, 5), 16), Number.parseInt(hex.slice(5, 7), 16))
    // 地: ダークの白（#FFFFFF → rgb(23, 23, 23)）と、選んだ行の地（既定の青の darkTint = rgb(0, 63, 112)）
    for (const ground of [lum(23, 23, 23), lum(0, 63, 112)]) {
      expect((red + 0.05) / (ground + 0.05)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('ヘッダーの名前・右の欄の地は変数を通す', () => {
    const studio = read('panels/widget-studio.ts')
    expect(studio).toContain('color:var(--sb-c-333333, #333333)')
    expect(studio).toContain('border-bottom:1px solid var(--sb-c-e3e6ea, #E3E6EA)')
    expect(read('panels/widget-studio-builder.ts')).toContain('background:var(--sb-c-ffffff, #FFFFFF)')
  })
})
