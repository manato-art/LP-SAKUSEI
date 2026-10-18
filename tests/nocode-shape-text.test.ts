/**
 * 「図形」の部品の中の文字（2026-10-18 本人「改行とか文字の大きさを変更できるようにしたい」）。
 * 中の文字は1行の欄で改行できず、文字の大きさも 17px 決め打ちだった。
 */
import { describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'
import { ALL_BLOCK_TYPES, BUILDER_TEMPLATE } from '../src/app/panels/nocode/templates/builder.ts'
import { readBlockFromCanvas } from '../src/app/panels/nocode/canvas-sync.ts'
import type { ItemData, TemplateData } from '../src/app/panels/nocode/templates/types.ts'

const UID = 'nc-shape001'

function render(block: ItemData): string {
  const data: TemplateData = { ...BUILDER_TEMPLATE.defaults(new Date()), screens: [{ id: 's1', name: '画面①', blocks: [block] }] }
  return BUILDER_TEMPLATE.render(data, UID)
}

const shapeType = ALL_BLOCK_TYPES.find((t) => t.type === 'shape')

describe('図形の中の文字の欄', () => {
  it('中の文字は何行でも書ける欄（改行できる）', () => {
    const field = shapeType?.fields.find((f) => 'key' in f && f.key === 'text')
    expect(field?.kind).toBe('textarea')
  })

  it('「文字の大きさ」の欄がある（10〜48px・初めは今までと同じ17px）', () => {
    const field = shapeType?.fields.find((f) => 'key' in f && f.key === 'textSize')
    expect(field).toMatchObject({ kind: 'number', label: '文字の大きさ', min: 10, max: 48, unit: 'px', fallback: 17 })
  })
})

describe('図形の書き出し', () => {
  const base: ItemData = { type: 'shape', shape: 'down', size: 100, color: '#1F7AE0', action: 'none' }

  it('改行はそのまま改行で出す', () => {
    const html = render({ ...base, text: '【発酵本家の味噌汁】だけが、\nこれだけの人に支持され続ける理由は？' })
    expect(html).toContain('<span class="nc-b-shape__text">【発酵本家の味噌汁】だけが、<br>これだけの人に支持され続ける理由は？</span>')
  })

  it('文字の大きさをその部品だけに付ける', () => {
    expect(render({ ...base, text: 'はい', textSize: 24 })).toContain(`.${UID} .nc-b-1{background:#1F7AE0;color:#FFFFFF;font-size:24px}`)
  })

  it('大きさを決めていない図形は今までどおり17px・幅を外れた数は収める', () => {
    expect(render({ ...base, text: 'はい' })).toContain(`.${UID} .nc-b-1{background:#1F7AE0;color:#FFFFFF;font-size:17px}`)
    expect(render({ ...base, text: 'はい', textSize: 200 })).toContain('font-size:48px}')
  })
})

describe('見たまま画面で打ち直した図形の文字', () => {
  it('改行を消さずに読み戻す（文章の部品と同じく、改行は <br> で持つ）', () => {
    const { document, window } = parseHTML(
      '<!doctype html><html><body><div class="nc-b nc-b-shape nc-b-1"><span class="nc-b-shape__text">一行目<br>二行目</span></div></body></html>',
    )
    const g = globalThis as unknown as Record<string, unknown>
    g['Node'] = window.Node
    g['HTMLElement'] = window.HTMLElement
    const el = document.querySelector('.nc-b-shape') as unknown as HTMLElement
    expect(readBlockFromCanvas(el, { type: 'shape', text: 'x' })).toEqual({ type: 'shape', text: '一行目<br>二行目' })
  })
})
