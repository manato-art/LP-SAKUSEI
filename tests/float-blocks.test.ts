/**
 * Widget編集の部品を「重ねる」（2026-10-18 本人「複製できるようにしたい。重ねたり左右上下に配置できるようにして」）。
 *
 * 本人の選択: 好きな所に自由に置く。重ねた部品は、すぐ上の部品（土台）の上に浮かび、つかんで上下左右へ動かせる。
 * 位置は土台に対する %（左右＝土台の幅に対して・上下＝土台の高さに対して）。0・0 は土台のふつうの並びの位置にぴったり重なる。
 * - 土台を動かす・複製する・消すと、重ねた部品も一緒に付いていく（移行先と同じ「まとまり」）
 * - 書き出しは、土台と重ねた部品を外枠（.nc-stack）で包む。部品の外側が h2・p・a・hr でも壊れない
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'
import {
  coveredIndexOf,
  duplicateGroup,
  groupEndOf,
  isFloating,
  moveGroupBefore,
  removeGroup,
} from '../src/app/panels/nocode/hotspot-model.ts'
import { FLOAT_X_RANGE, FLOAT_Y_RANGE, floatOffset, setFloating } from '../src/app/panels/nocode/float-model.ts'
import { BUILDER_TEMPLATE } from '../src/app/panels/nocode/templates/builder.ts'
import { buildTemplateForm, type TemplateForm } from '../src/app/panels/nocode/template-form.ts'
import { items, str, type ItemData, type TemplateData } from '../src/app/panels/nocode/templates/types.ts'

const b = (name: string): ItemData => ({ type: 'button', label: name })
const f = (name: string, x = 0, y = 0): ItemData => ({ type: 'button', label: name, float: true, floatX: x, floatY: y })
const h = (name: string): ItemData => ({ type: 'hotspot', name, action: 'screen', target: 's1' })
const names = (list: readonly ItemData[]): string[] => list.map((item) => String(item['label'] ?? item['name']))

describe('重ねた部品の並びの決まり', () => {
  // A（重ねた a1 つき）、B
  const LIST: readonly ItemData[] = [b('A'), f('a1'), b('B')]

  it('重ねた部品は、すぐ上の（重ねていない）部品に重なる。土台のまとまりは重ねた部品まで', () => {
    expect(isFloating(LIST[1])).toBe(true)
    expect(coveredIndexOf(LIST, 1)).toBe(0)
    expect(groupEndOf(LIST, 0)).toBe(2)
    expect(groupEndOf(LIST, 1)).toBe(2)
  })

  it('移行先は、重ねた部品ではなく土台に被さる', () => {
    expect(coveredIndexOf([b('A'), f('a1'), h('h1')], 2)).toBe(0)
  })

  it('土台を動かす・複製する・消すと、重ねた部品も一緒', () => {
    expect(names(moveGroupBefore(LIST, 0, LIST.length)?.list ?? [])).toEqual(['B', 'A', 'a1'])
    expect(names(duplicateGroup(LIST, 0, 30)?.list ?? [])).toEqual(['A', 'a1', 'A', 'a1', 'B'])
    expect(names(removeGroup(LIST, 0))).toEqual(['B'])
  })

  it('移行先の印（float）が付いていても、移行先は移行先のまま（重ねた部品として数えない）', () => {
    expect(isFloating({ type: 'hotspot', float: true })).toBe(false)
  })
})

describe('「重ねる」を付ける・外す', () => {
  it('いちばん上の部品は、重ねる土台が無いので重ねられない', () => {
    expect(setFloating([b('A'), b('B')], 0, true)).toBeNull()
  })

  it('重ねると、土台のふつうの位置（0・0）に重なる。前に動かした位置があればそのまま', () => {
    const on = setFloating([b('A'), b('B')], 1, true)
    expect(on?.index).toBe(1)
    expect(on?.list[1]).toMatchObject({ float: true, floatX: 0, floatY: 0 })
    const again = setFloating([b('A'), { ...b('B'), floatX: 30, floatY: -10 }], 1, true)
    expect(again?.list[1]).toMatchObject({ float: true, floatX: 30, floatY: -10 })
  })

  it('外すと、土台の下（重ねたほかの部品の後ろ）へふつうに並ぶ。ほかの重ねた部品は土台に残る', () => {
    const off = setFloating([b('A'), f('a1'), f('a2'), b('B')], 1, false)
    expect(names(off?.list ?? [])).toEqual(['A', 'a2', 'a1', 'B'])
    expect(off?.index).toBe(2)
    expect(isFloating(off?.list[2])).toBe(false)
    expect(coveredIndexOf(off?.list ?? [], 1)).toBe(0)
  })

  it('位置は範囲の中に収める（読めない値は 0）', () => {
    expect(floatOffset({ floatX: 30, floatY: -10 })).toEqual({ x: 30, y: -10 })
    expect(floatOffset({ floatX: 999, floatY: -99999 })).toEqual({ x: FLOAT_X_RANGE.max, y: FLOAT_Y_RANGE.min })
    expect(floatOffset({ floatX: 'abc' })).toEqual({ x: 0, y: 0 })
  })
})

const NOW = new Date(Date.UTC(2026, 9, 18, 3, 0))
const UID = 'nc-test0099'
function render(blocks: readonly ItemData[]): string {
  const data = { ...BUILDER_TEMPLATE.defaults(NOW), screens: [{ id: 's1', name: '画面①', blocks }] } as TemplateData
  return BUILDER_TEMPLATE.render(data, UID)
}

describe('重ねた部品の書き出し', () => {
  it('土台と重ねた部品を外枠で包み、重ねた部品は土台に対する % の位置に置く', () => {
    const html = render([{ type: 'heading', text: '見出し' }, f('ずらしたボタン', 30, -10)])
    const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`)
    const stack = document.querySelector('.nc-stack')
    expect(stack).not.toBeNull()
    // 見出し（h2）の中には入れない＝外側が h2 でも壊れない
    expect(stack?.children[0]?.tagName).toBe('H2')
    expect(stack?.children[1]?.classList.contains('nc-b-2')).toBe(true)
    expect(document.querySelector('h2 .nc-b-button')).toBeNull()
    expect(html).toContain(`.${UID} .nc-stack{position:relative}`)
    // 左右は土台の幅に対して（右も同じだけずらす＝ふつうの並びと同じ幅のまま動く）、上下は土台の高さに対して
    expect(html).toContain(`.${UID} .nc-stack>.nc-b-2{position:absolute;left:30%;right:-30%;top:-10%;margin-top:0;margin-bottom:0;z-index:1}`)
  })

  it('外枠の前後にも、部品どうしと同じ間を空ける', () => {
    const html = render([b('A'), f('a1'), b('B')])
    expect(html).toContain(`.${UID} .nc-b+.nc-stack,.${UID} .nc-stack+.nc-b,.${UID} .nc-stack+.nc-stack{margin-top:14px}`)
  })

  it('横にずらしてWidgetの外へはみ出した分は切る（スマホで画面が横に揺れないように）。上下は切らない', () => {
    const html = render([b('A'), f('a1', 60, 0)])
    expect(html).toContain(`.${UID}{overflow-x:clip}`)
    expect(html).not.toContain('overflow-y')
  })

  it('重ねた部品が無ければ、外枠も外枠のCSSも出さない（今までと同じ書き出し）', () => {
    const html = render([b('A'), b('B')])
    expect(html).not.toContain('nc-stack')
  })

  it('いちばん上で重ねても、土台が無いのでふつうに並べる', () => {
    const html = render([f('a1'), b('B')])
    expect(html).not.toContain('nc-stack')
    expect(html).not.toContain('position:absolute;left:0%')
  })

  it('土台に被せた移行先は、今までどおり土台の中に入る', () => {
    const html = render([b('A'), f('a1'), h('h1')])
    const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`)
    expect(document.querySelector('.nc-stack > .nc-b-1 .nc-b-hotspot')).not.toBeNull()
  })
})

describe('右の設定の「重ねる」', () => {
  const { document, window } = parseHTML('<!doctype html><html><body></body></html>')

  beforeAll(() => {
    const g = globalThis as unknown as Record<string, unknown>
    g['document'] = document
    g['window'] = window
    g['Node'] = window.Node
    g['HTMLElement'] = window.HTMLElement
    g['DOMParser'] = window.DOMParser
    ;(window.HTMLElement.prototype as unknown as Record<string, unknown>)['scrollIntoView'] = (): void => undefined
  })

  function mount(): { form: TemplateForm; list: HTMLElement; panel: HTMLElement } {
    const tabs = document.createElement('div') as unknown as HTMLElement
    const list = document.createElement('div') as unknown as HTMLElement
    const palette = document.createElement('div') as unknown as HTMLElement
    const form = buildTemplateForm({
      fields: BUILDER_TEMPLATE.fields,
      data: BUILDER_TEMPLATE.defaults(NOW),
      onChange: () => undefined,
      tabsHost: tabs,
      partsHost: { list, palette },
    })
    document.body.replaceChildren(tabs, list, palette, form.element)
    return { form, list, panel: form.element }
  }

  const click = (el: Element | null | undefined): void => {
    if (el === null || el === undefined) throw new Error('押す所がありません')
    el.dispatchEvent(new window.Event('click', { bubbles: true }) as unknown as Event)
  }
  const chip = (panel: HTMLElement, value: string): Element | undefined =>
    [...panel.querySelectorAll('.ncf-field')]
      .find((row) => (row.textContent ?? '').startsWith('重ねる'))
      ?.querySelector(`.ncf-chip[data-value="${value}"]`) ?? undefined
  const blocks = (form: TemplateForm): readonly ItemData[] => items(items(form.getData(), 'screens')[0] ?? {}, 'blocks')

  it('部品を選んで「重ねる」を押すと、すぐ上の部品に重なり、並びでは土台の下に字下げして出る', () => {
    const m = mount()
    click(m.list.querySelector('[data-ncf-block="3"] > .ncf-item__head'))
    click(chip(m.panel, 'on'))
    expect(isFloating(blocks(m.form)[3])).toBe(true)
    expect(m.form.selectedBlock()).toBe(3)
    expect(m.list.querySelector('[data-ncf-block="3"]')?.classList.contains('ncf-item--float')).toBe(true)
  })

  it('「重ねない」に戻すと、ふつうの並びに戻る', () => {
    const m = mount()
    click(m.list.querySelector('[data-ncf-block="3"] > .ncf-item__head'))
    click(chip(m.panel, 'on'))
    click(chip(m.panel, 'off'))
    expect(isFloating(blocks(m.form)[3])).toBe(false)
    expect(str(blocks(m.form)[3] ?? {}, 'type')).toBe('button')
  })

  it('いちばん上の部品では「重ねる」を押せない', () => {
    const m = mount()
    click(m.list.querySelector('[data-ncf-block="0"] > .ncf-item__head'))
    expect(chip(m.panel, 'on')?.hasAttribute('disabled')).toBe(true)
  })
})
