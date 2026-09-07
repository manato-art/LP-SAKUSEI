import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  TOOLBAR_FONT_SIZES,
  TOOLBAR_FONT_FAMILIES,
  FREE_FONT_SIZE_UNITS,
} from '../src/app/panels/editor-toolbar.ts'
import { FONT_LABELS_JA, fontLabelJa } from '../src/app/panels/toolbar/text-format.ts'
import { TOOLBAR_SWATCHES } from '../src/app/panels/toolbar/color-picker.ts'

/**
 * 選択肢は**採取した実物から取り出して**突き合わせる。
 *
 * 既存の tests/panel-toolbar.test.ts は、実装の定数と同じリテラルを
 * テスト側に書き写して比較していた。定数が間違っていても同じ誤りが写るので、
 * 緑でも何も保証しない。ここでは採取HTMLを実際にパースして比べる。
 */
const ALIGN_OPEN = 'src/app/fragments/ab_tests__UID__articles__toolbar-align-open.html'
// 色ピッカーは React のポータルで描かれるので、本体ではなく portals 側に入っている
const COLOR_OPEN = 'src/app/fragments/ab_tests__UID__articles__toolbar-color-open.portals.html'

function read(path: string): string {
  return readFileSync(path, 'utf8')
}

/** `_font10_` のようなクラスから文字サイズの段を取り出す。 */
function capturedFontSizes(html: string): string[] {
  const found = [...html.matchAll(/class="_font(\d+)_[^"]*_fontSizeTab_[^"]*"[^>]*>(\d+px)</g)]
  return found.map((m) => m[2] as string)
}

/** 自由設定の単位（select の option）。 */
function capturedUnits(html: string): string[] {
  const block = /_freeFontSizeForm_[\s\S]{0,400}?<\/select>/.exec(html)?.[0] ?? ''
  return [...block.matchAll(/<option value="([^"]+)"/g)].map((m) => m[1] as string)
}

/** 色見本は swatch の title 属性。 */
function capturedSwatches(html: string): string[] {
  return [...html.matchAll(/title="(#[0-9a-fA-F]{3,8})"/g)].map((m) => m[1] as string)
}

describe('ツールバーの選択肢は採取物と一致する（実物をパースして照合）', () => {
  it('文字サイズの段が採取物と同じ・順番も同じ', () => {
    const captured = capturedFontSizes(read(ALIGN_OPEN))
    expect(captured.length).toBeGreaterThan(0)
    expect(TOOLBAR_FONT_SIZES).toEqual(captured)
  })

  it('自由設定の単位が採取物と同じ', () => {
    const captured = capturedUnits(read(ALIGN_OPEN))
    expect(captured.length).toBeGreaterThan(0)
    expect(FREE_FONT_SIZE_UNITS).toEqual(captured)
  })

  it('色見本が採取物と同じ・順番も同じ', () => {
    const captured = capturedSwatches(read(COLOR_OPEN))
    expect(captured.length).toBeGreaterThan(0)
    expect(TOOLBAR_SWATCHES.map((c) => c.toLowerCase())).toEqual(
      captured.map((c) => c.toLowerCase()),
    )
  })

  // フォントだけは採取物と一致させない。指示158で、実物の6件（serif 等・選んでも見た目が
  // 変わらない）を、視認できる差の大きい日本語Webフォントに意図的に差し替えた。したがって
  // 「採取物に実在するか」ではなく「全フォントに日本語ラベルがあるか（英語名を出さない）」を守る。
  it('フォントは全件に日本語ラベルがある（UIに英語のフォント名を出さない）', () => {
    expect(TOOLBAR_FONT_FAMILIES.length).toBeGreaterThan(0)
    for (const family of TOOLBAR_FONT_FAMILIES) {
      const label = fontLabelJa(family)
      expect(FONT_LABELS_JA[family]).toBeDefined() // ラベル未定義（＝英語名フォールバック）を検出
      expect(label).toBe(FONT_LABELS_JA[family])
      expect(label).not.toBe(family) // ラベルは英語名そのものであってはならない
    }
  })
})
