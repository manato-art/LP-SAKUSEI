/**
 * 閉じるボタン（○の中の×）の×が真ん中に来ていない（2026-10-27 指示⑰ 本人「×が◯の中心に来てない」・LP設定の左上）。
 * 採取物は ::before の文字「×」（line-height で上下をそろえる）。文字の×は書体の高さの都合で下にずれる
 * → 文字をやめ、2本の線を○の真ん中（上下左右 50%）に描く。
 */
import { describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'

/** selector だけの規則（共通の `a,\nb {` より後ろにある、いちばん最後の物） */
const ruleOf = (css: string, selector: string): string => {
  const at = css.lastIndexOf(`\n${selector} {`)
  return at < 0 ? '' : css.slice(at, css.indexOf('}', at))
}

describe('閉じるボタンの×', () => {
  it('文字ではなく2本の線で、○の真ん中に描く', async () => {
    const { window } = parseHTML('<!doctype html><html><head></head><body></body></html>')
    ;(globalThis as unknown as Record<string, unknown>)['document'] = window.document
    const { ensureWhiteBase } = await import('../src/app/white-base.ts')
    ensureWhiteBase()
    const css = [...window.document.querySelectorAll('style')].map((style) => style.textContent ?? '').join('\n')
    const lines = ruleOf(css, '._btnCnacel_1bcs1_140::before,\n._btnCnacel_1bcs1_140::after')
    expect(lines).toContain('content: ""')
    expect(lines).toContain('top: 50%')
    expect(lines).toContain('left: 50%')
    expect(ruleOf(css, '._btnCnacel_1bcs1_140::before')).toContain('translate(-50%, -50%) rotate(45deg)')
    expect(ruleOf(css, '._btnCnacel_1bcs1_140::after')).toContain('translate(-50%, -50%) rotate(-45deg)')
  })
})
