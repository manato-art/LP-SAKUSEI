/**
 * カラーコードの欄を、押すとパレット（ブラウザの色選び）が開く欄にする（2026-10-27 本人
 * 「LP設定の背景をカラーコードではなくパレットで選択できるように。他にもカラーコードの部分があれば設定して」）。
 */
import { describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'
import { toFieldValue, toPaletteHex } from '../src/app/panels/palette-field.ts'

async function setup(html: string): Promise<{ input: HTMLInputElement; button: HTMLButtonElement; picker: HTMLInputElement; group: HTMLElement }> {
  const { window } = parseHTML(`<!doctype html><html><head></head><body>${html}</body></html>`)
  const g = globalThis as unknown as Record<string, unknown>
  g['document'] = window.document
  g['Event'] = window.Event
  const { paletteField } = await import('../src/app/panels/palette-field.ts')
  const input = window.document.querySelector('input') as unknown as HTMLInputElement
  const button = paletteField(input, { withHash: false, fallback: 'ffffff' })
  return {
    input,
    button,
    picker: button.querySelector('input[type="color"]') as HTMLInputElement,
    group: window.document.querySelector('div') as unknown as HTMLElement,
  }
}

const LP_FIELD = '<div class="_formGroup_1n7ll_1 _fontColorForm_qyxur_45"><label>カラーコード</label><input type="text" name="inner_background_color" class="_formControl_1n7ll_17" value="ffcc00"></div>'

describe('パレットで選ぶ色の欄', () => {
  it('コードの書き方をそろえる（# の有無・3桁・大文字）。色でなければ null', () => {
    expect(toPaletteHex('ffcc00')).toBe('#ffcc00')
    expect(toPaletteHex('#FFF')).toBe('#ffffff')
    expect(toPaletteHex('')).toBeNull()
    expect(toPaletteHex('red')).toBeNull()
    expect(toFieldValue('#ffcc00', false)).toBe('ffcc00')
    expect(toFieldValue('#ffcc00', true)).toBe('#ffcc00')
  })

  it('元の欄は隠して、色見本＋コードの欄（押すとパレットが開く）を出す。元の欄の「#」は出さない', async () => {
    const { input, button, picker, group } = await setup(LP_FIELD)
    expect(input.style.getPropertyValue('display')).toBe('none')
    expect(button.tagName).toBe('BUTTON')
    expect(button.textContent).toContain('#FFCC00')
    expect(picker.value).toBe('#ffcc00')
    expect(group.classList.contains('lp-palette-group')).toBe(true)
  })

  it('パレットで選んだ色は、元の欄へ「#」なしのコードで入る（保存はそのまま元の欄から）', async () => {
    const { input, button, picker } = await setup(LP_FIELD)
    picker.value = '#123abc'
    picker.dispatchEvent(new Event('input'))
    expect(input.value).toBe('123abc')
    expect(button.textContent).toContain('#123ABC')
  })

  it('値が無いときは「未設定」と出し、パレットは決めた色から開く', async () => {
    const { button, picker } = await setup(LP_FIELD.replace('value="ffcc00"', 'value=""'))
    expect(button.textContent).toContain('未設定')
    expect(picker.value).toBe('#ffffff')
  })
})
