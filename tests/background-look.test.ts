/**
 * 右の「プロパティ」の「背景色」に、余白と不透明度を足す（2026-10-18 本人「背景の幅や不透明度調整できるようにして」）。
 *
 * 本人の選択: 「幅」＝文字のまわりの余白（色を文字より上下左右に広げる・px）。不透明度は 0〜100%。
 * - 色と不透明度は Quill 標準の `background` の値に持たせる（100%は #rrggbb、それ以外は rgba(…)）。
 *   Quill の色の読み取りは `rgb(` だけを #rrggbb に直し、`rgba(` はそのまま返すので、不透明度が消えない。
 * - 余白は `bgpad`（span の padding）。色と同じ span に付くので、余白の部分にも色が付く。
 *   2行に折り返しても、行ごとに余白が付くようにする（box-decoration-break: clone）。
 */
import { parseHTML } from 'linkedom'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  BACKGROUND_PADDING_MAX,
  BackgroundPaddingAttributor,
  backgroundLookOf,
  backgroundValue,
  paddingOf,
} from '../src/app/panels/background-look.ts'

let window: ReturnType<typeof parseHTML>['window']

beforeEach(() => {
  window = parseHTML('<!doctype html><html><body></body></html>').window
  const g = globalThis as unknown as Record<string, unknown>
  g['document'] = window.document
  g['Event'] = window.Event
})

describe('背景の色と不透明度の値', () => {
  it('不透明度100%なら #rrggbb、それより薄ければ rgba(…) にする', () => {
    expect(backgroundValue({ color: '#f00000', opacity: 100 })).toBe('#f00000')
    expect(backgroundValue({ color: '#f00000', opacity: 50 })).toBe('rgba(240, 0, 0, 0.5)')
    expect(backgroundValue({ color: '#F00000', opacity: 0 })).toBe('rgba(240, 0, 0, 0)')
  })

  it('Quill の値から色と不透明度を読む（未設定は白・100%、範囲が混ざったら先頭）', () => {
    expect(backgroundLookOf('rgba(240, 0, 0, 0.5)')).toEqual({ color: '#f00000', opacity: 50 })
    expect(backgroundLookOf('#F00000')).toEqual({ color: '#f00000', opacity: 100 })
    expect(backgroundLookOf(undefined)).toEqual({ color: '#ffffff', opacity: 100 })
    expect(backgroundLookOf(['rgba(0, 0, 255, 0.2)', '#ffffff'])).toEqual({ color: '#0000ff', opacity: 20 })
  })

  it('範囲の外の不透明度は 0〜100% に収める', () => {
    expect(backgroundValue({ color: '#f00000', opacity: 150 })).toBe('#f00000')
    expect(backgroundValue({ color: '#f00000', opacity: -5 })).toBe('rgba(240, 0, 0, 0)')
  })
})

describe('背景の余白', () => {
  it('Quill の値（8px）から数字を読む。未設定は0、範囲の外は収める', () => {
    expect(paddingOf('8px')).toBe(8)
    expect(paddingOf(undefined)).toBe(0)
    expect(paddingOf(['12px', '4px'])).toBe(12)
    expect(paddingOf(`${BACKGROUND_PADDING_MAX + 10}px`)).toBe(BACKGROUND_PADDING_MAX)
  })

  it('文字の塊に余白を付けると、折り返した行ごとにも余白が付く。外すと style ごと消える', () => {
    const span = window.document.createElement('span')
    expect(BackgroundPaddingAttributor.add(span, '8px')).toBe(true)
    expect(span.style.getPropertyValue('padding')).toBe('8px')
    expect(span.style.getPropertyValue('box-decoration-break')).toBe('clone')
    expect(span.style.getPropertyValue('-webkit-box-decoration-break')).toBe('clone')
    expect(BackgroundPaddingAttributor.value(span)).toBe('8px')

    BackgroundPaddingAttributor.remove(span)
    expect(span.hasAttribute('style')).toBe(false)
  })

  it('余白を外しても、同じ塊の背景色は残す', () => {
    const span = window.document.createElement('span')
    span.style.setProperty('background-color', 'rgba(240, 0, 0, 0.5)')
    BackgroundPaddingAttributor.add(span, '8px')
    BackgroundPaddingAttributor.remove(span)
    expect(span.style.getPropertyValue('background-color')).toBe('rgba(240, 0, 0, 0.5)')
    expect(span.style.getPropertyValue('box-decoration-break')).toBe('')
  })
})

describe('プロパティの「背景色」「余白」「不透明度」の欄', () => {
  async function setup(): Promise<{
    sync: (background: unknown, padding: unknown) => void
    backgrounds: string[]
    paddings: (string | false)[]
    input: (label: string) => HTMLInputElement
    type: (label: string, value: string) => void
  }> {
    const { buildBackgroundRows } = await import('../src/app/panels/properties-background.ts')
    const backgrounds: string[] = []
    const paddings: (string | false)[] = []
    const { rows, sync } = buildBackgroundRows({
      background: (value) => backgrounds.push(value),
      padding: (value) => paddings.push(value),
    })
    window.document.body.append(...rows)
    const input = (label: string): HTMLInputElement => {
      const row = [...window.document.querySelectorAll<HTMLElement>('.sb-pr')]
        .find((r) => r.querySelector('.sb-pr-label')?.textContent === label)
      const field = row?.querySelector<HTMLInputElement>(label === '背景色' ? 'input.sb-pr-color-hex' : 'input.sb-pr-input')
      if (field === null || field === undefined) throw new Error(`「${label}」の欄がありません`)
      return field
    }
    /** 欄に打ち込んで確定する（欄はラベルから探す） */
    const type = (label: string, value: string): void => {
      const field = input(label)
      field.value = value
      field.dispatchEvent(new Event('change'))
    }
    return { sync, backgrounds, paddings, input, type }
  }

  it('背景色の下に「余白」「不透明度」の欄がある', async () => {
    const { input } = await setup()
    expect(input('背景色')).toBeDefined()
    expect(input('余白')).toBeDefined()
    expect(input('不透明度')).toBeDefined()
  })

  it('色を入れると、今の不透明度のまま背景を当てる', async () => {
    const { type, backgrounds } = await setup()
    type('背景色', '#F00000')
    expect(backgrounds.at(-1)).toBe('#f00000')
    type('不透明度', '50')
    expect(backgrounds.at(-1)).toBe('rgba(240, 0, 0, 0.5)')
    type('背景色', '#0000FF')
    expect(backgrounds.at(-1)).toBe('rgba(0, 0, 255, 0.5)')
  })

  it('余白を入れると px で当て、0 にすると外す', async () => {
    const { type, paddings } = await setup()
    type('余白', '8')
    expect(paddings.at(-1)).toBe('8px')
    type('余白', '0')
    expect(paddings.at(-1)).toBe(false)
  })

  it('選んだ文字の背景と余白に、欄の中身をそろえる', async () => {
    const { sync, input } = await setup()
    sync('rgba(240, 0, 0, 0.5)', '8px')
    expect(input('背景色').value).toBe('#F00000')
    expect(input('不透明度').value).toBe('50')
    expect(input('余白').value).toBe('8')
    sync(undefined, undefined)
    expect(input('背景色').value).toBe('#FFFFFF')
    expect(input('不透明度').value).toBe('100')
    expect(input('余白').value).toBe('0')
  })
})
