/**
 * 右の設定の文字の「サイズ」の欄に、ブラウザの上下の矢印を出さない（2026-10-27 本人「赤丸の矢印いらない」）。
 * すぐ右に自前の ▲▼ があるので、矢印が二重になっていた。ほかの数字の欄（自前の ▲▼ が無い）はそのまま。
 */
import { readFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'

describe('文字のサイズの欄の矢印', () => {
  it('ブラウザの上下の矢印を消す決まりがある', async () => {
    const { window } = parseHTML('<!doctype html><html><head></head><body></body></html>')
    ;(globalThis as unknown as Record<string, unknown>)['document'] = window.document
    const { injectStyles } = await import('../src/app/panels/properties-panel-styles.ts')
    injectStyles()
    const css = [...window.document.querySelectorAll('style')].map((s) => s.textContent ?? '').join('\n')
    expect(css).toContain('.sb-pr-no-spin::-webkit-inner-spin-button')
    expect(css).toMatch(/\.sb-pr-no-spin\s*\{[^}]*appearance:\s*textfield/)
  })

  it('その決まりを当てるのは、自前の ▲▼ がある文字のサイズの欄だけ', () => {
    const src = readFileSync('src/app/panels/properties-panel.ts', 'utf8')
    expect(src).toContain("sizeInput.className = 'sb-pr-input sb-pr-no-spin'")
    expect(src.match(/sb-pr-no-spin/g)).toHaveLength(1)
  })
})

describe('文字のサイズの欄の ↑↓（2026-10-27 本人「十字キーの上下でサイズの調整をしたい」）', () => {
  it('欄のキーの ↑↓ をその場で文字の大きさに効かせる', () => {
    const src = readFileSync('src/app/panels/properties-panel.ts', 'utf8')
    expect(src).toContain("wireStepKeys(sizeInput, 1, (v) => applyInline('size', `${v}px`))")
  })
})

describe('文字のサイズの欄の数字の位置（2026-10-27 本人「数字を⬜︎の中央に」）', () => {
  it('数字は枠の真ん中', () => {
    const src = readFileSync('src/app/panels/properties-panel.ts', 'utf8')
    expect(src).toContain("sizeInput.style.cssText = 'width:52px;flex:none;font-variant-numeric:tabular-nums;text-align:center'")
  })
})
