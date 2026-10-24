/**
 * 背景の画像を見たまま画面で動かすとき、どの面を動かすか・動かした結果をどこへ書くか（2026-10-24・widget-studio-bg-move.ts）。
 */
import { describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'
import { BUILDER_TEMPLATE } from '../src/app/panels/nocode/templates/builder.ts'
import type { TemplateData } from '../src/app/panels/nocode/templates/types.ts'

const { window } = parseHTML('<!doctype html><html><body></body></html>')
const g = globalThis as unknown as Record<string, unknown>
g['Node'] = window.Node
g['HTMLElement'] = window.HTMLElement
const { bgSurfaceOf, withBgLook } = await import('../src/app/panels/widget-studio-bg-move.ts')

const UID = 'nc-bgmove01'
const data: TemplateData = {
  ...BUILDER_TEMPLATE.defaults(new Date(0)),
  screens: [
    {
      id: 's1',
      name: '画面①',
      blocks: [
        { type: 'heading', text: '見出し', size: 21, align: 'center', color: '#1F2A37' },
        { type: 'button', label: '申し込む', look: 'cta', color: '#E5573F', action: 'none', target: '', url: '' },
      ],
    },
  ],
}

function mount(): HTMLElement {
  const content = window.document.createElement('div') as unknown as HTMLElement
  content.innerHTML = BUILDER_TEMPLATE.render(data, UID).replace(/<script>[\s\S]*?<\/script>/g, '')
  return content
}

describe('背景を敷いた面', () => {
  it('Widget全体＝外枠・画面＝その画面・部品＝色の付いた面（ボタンは押す所）', () => {
    const content = mount()
    expect(bgSurfaceOf(data, content, UID, [])?.classList.contains(UID)).toBe(true)
    expect(bgSurfaceOf(data, content, UID, ['screens', 0])?.getAttribute('data-nc-screen')).toBe('s1')
    expect(bgSurfaceOf(data, content, UID, ['screens', 0, 'blocks', 1])?.classList.contains('nc-b-button__a')).toBe(true)
    expect(bgSurfaceOf(data, content, UID, ['screens', 0, 'blocks', 0])?.classList.contains('nc-b-heading')).toBe(true)
  })
})

describe('動かした結果を書く所', () => {
  it('合わせ方・大きさ・位置を、その所の値として書く（画像はそのまま）', () => {
    const next = withBgLook(data, ['screens', 0, 'blocks', 1], { image: 'x', fit: 'free', size: 70, x: 10, y: 90 })
    const block = (next['screens'] as TemplateData[])[0]?.['blocks'] as TemplateData[]
    expect(block[1]).toMatchObject({ bgFit: 'free', bgSize: 70, bgX: 10, bgY: 90 })
    expect(block[1]?.['bgImage']).toBeUndefined()
    expect(withBgLook(data, [], { image: 'x', fit: 'cover', size: 100, x: 50, y: 0 })).toMatchObject({ bgFit: 'cover', bgY: 0 })
  })
})
