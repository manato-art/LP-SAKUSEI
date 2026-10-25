/**
 * 右の欄の色に「不透明度」（2026-10-25 本人「不透明度は…全部を分解してそれぞれ決めれるように細かく」）。
 * 色の値は #RRGGBB（100%）か #RRGGBBAA。候補の色を選び直しても不透明度はそのまま。
 * 「自動」（決めなければ部品の色に合わせる）を持つ色もある（ボタンの文字の色など）。
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'
import type { ScalarField } from '../src/app/panels/nocode/form-controls.ts'

const { document, window } = parseHTML('<!doctype html><html><body></body></html>')

beforeAll(() => {
  const g = globalThis as unknown as Record<string, unknown>
  g['document'] = document
  g['window'] = window
  g['HTMLElement'] = window.HTMLElement
})

async function mount(field: ScalarField, initial: string): Promise<{ el: HTMLElement; values: string[]; refresh: () => void }> {
  const { scalarControl } = await import('../src/app/panels/nocode/form-controls.ts')
  let value = initial
  const values: string[] = []
  const refreshers: (() => void)[] = []
  const el = scalarControl(
    field,
    {
      read: () => value,
      write: (next) => {
        value = String(next)
        values.push(value)
        for (const r of refreshers) r()
      },
      data: () => ({}),
      onRefresh: (r) => refreshers.push(r),
    },
    'c1',
  )
  document.body.replaceChildren(el)
  return { el, values, refresh: () => refreshers.forEach((r) => r()) }
}

const COLOR: ScalarField = { kind: 'color', key: 'color', label: 'ボタンの色', presets: ['#E5573F', '#1F7AE0'] }
const click = (el: Element | null | undefined): void => {
  el?.dispatchEvent(new window.Event('click', { bubbles: true }) as unknown as Event)
}
const opacityInput = (el: HTMLElement): HTMLInputElement =>
  el.querySelector('.ncf-opacity input[type="number"]') as unknown as HTMLInputElement

describe('色の不透明度', () => {
  it('色の下に「不透明度」（いまの色の値から 0〜100%）', async () => {
    const { el } = await mount(COLOR, '#E5573F80')
    expect(el.querySelector('.ncf-opacity .ncf-label')?.textContent).toBe('不透明度')
    expect(opacityInput(el).value).toBe('50')
  })

  it('不透明度を変えると、色はそのままで不透明度だけ変わる', async () => {
    const { el, values } = await mount(COLOR, '#E5573F')
    const input = opacityInput(el)
    input.value = '40'
    // linkedom には valueAsNumber が無い（ブラウザでは数字の欄が持つ）
    Object.defineProperty(input, 'valueAsNumber', { value: 40 })
    input.dispatchEvent(new window.Event('input') as unknown as Event)
    expect(values.at(-1)).toBe('#E5573F66')
  })

  it('候補の色を選び直しても、不透明度はそのまま（選んでいる印は色だけで見る）', async () => {
    const { el, values } = await mount(COLOR, '#E5573F66')
    expect(el.querySelector('[data-color="#E5573F"]')?.getAttribute('aria-pressed')).toBe('true')
    click(el.querySelector('[data-color="#1F7AE0"]'))
    expect(values.at(-1)).toBe('#1F7AE066')
  })

  it('「自動」を持つ色: 決めていなければ「自動」に印。押すと自動に戻る（不透明度は隠す）', async () => {
    const { el, values } = await mount({ ...COLOR, auto: '自動' }, '#1F7AE0')
    const auto = el.querySelector('.ncf-swatch--auto')
    expect(auto?.textContent).toBe('自動')
    expect(auto?.getAttribute('aria-pressed')).toBe('false')
    click(auto)
    expect(values.at(-1)).toBe('')
    expect(auto?.getAttribute('aria-pressed')).toBe('true')
    expect((el.querySelector('.ncf-opacity') as unknown as HTMLElement).hidden).toBe(true)
  })
})
