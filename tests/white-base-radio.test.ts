/**
 * 選んでいないラジオの丸が見えない（2026-10-27 指示⑮ 本人「選択していない◯が見えない」・LP設定の背景の「画像」「色」）。
 * 採取物は暗い画面用で、選んでいない丸は「白い丸・枠なし」。白い画面にしたら背景に溶けていた → 枠を付ける。
 */
import { describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'

describe('ラジオの選んでいない丸', () => {
  it('白い画面でも見えるよう、選んでいない丸に枠を付ける', async () => {
    const { window } = parseHTML('<!doctype html><html><head></head><body></body></html>')
    ;(globalThis as unknown as Record<string, unknown>)['document'] = window.document
    const { ensureWhiteBase } = await import('../src/app/white-base.ts')
    ensureWhiteBase()
    const css = [...window.document.querySelectorAll('style')].map((style) => style.textContent ?? '').join('\n')
    const at = css.indexOf('._radioControl_10frc_1 input:not(:checked) + label::before')
    expect(at).toBeGreaterThan(-1)
    const rule = css.slice(at, css.indexOf('}', at))
    expect(rule).toMatch(/border:\s*1px solid #[0-9a-fA-F]{6}/)
  })
})
