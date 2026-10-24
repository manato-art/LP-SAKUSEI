/**
 * 「部品を積んで作る」の入力欄（template-form.ts）を、画面と同じ押し方で確かめる（2026-09-24・template-form.ts を
 * 部品ごとのファイルに分けたときに足した。分ける前と後で同じふるまいになることを、この操作で押さえる）。
 * DOM の代わりに linkedom（tests/nocode-palette.test.ts と同じ）。
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { parseHTML } from 'linkedom'
import { buildTemplateForm, type TemplateForm } from '../src/app/panels/nocode/template-form.ts'
import { ALL_BLOCK_TYPES, BUILDER_TEMPLATE } from '../src/app/panels/nocode/templates/builder.ts'
import { FAQ_TEMPLATE } from '../src/app/panels/nocode/templates/faq.ts'
import { surveyData } from '../src/app/panels/nocode/templates/survey.ts'
import { items, str, type ItemData, type TemplateData } from '../src/app/panels/nocode/templates/types.ts'

const { document, window } = parseHTML('<!doctype html><html><body></body></html>')

beforeAll(() => {
  const g = globalThis as unknown as Record<string, unknown>
  g['document'] = document
  g['window'] = window
  g['Node'] = window.Node
  g['HTMLElement'] = window.HTMLElement
  g['DOMParser'] = window.DOMParser
  // linkedom に無いもの（並びの選び直しで呼ぶ）
  ;(window.HTMLElement.prototype as unknown as Record<string, unknown>)['scrollIntoView'] = (): void => undefined
})

interface Mounted {
  form: TemplateForm
  list: HTMLElement
  panel: HTMLElement
  tabs: HTMLElement
  changes: TemplateData[]
  selects: (number | null)[][]
}

/** Widget編集の画面と同じ形（左の列に並びと部品を足す・右に設定・上にタブ）で組み立てる */
function mountSplit(data: TemplateData): Mounted {
  const tabs = document.createElement('div') as unknown as HTMLElement
  const list = document.createElement('div') as unknown as HTMLElement
  const palette = document.createElement('div') as unknown as HTMLElement
  const changes: TemplateData[] = []
  const selects: (number | null)[][] = []
  const form = buildTemplateForm({
    fields: BUILDER_TEMPLATE.fields,
    data,
    onChange: (next) => changes.push(next),
    onSelect: (screen, block) => selects.push([screen, block]),
    tabsHost: tabs,
    partsHost: { list, palette },
  })
  document.body.replaceChildren(tabs, list, palette, form.element)
  return { form, list, panel: form.element, tabs, changes, selects }
}

const click = (el: Element | null | undefined): void => {
  if (el === null || el === undefined) throw new Error('押す所がありません')
  el.dispatchEvent(new window.Event('click', { bubbles: true }) as unknown as Event)
}
const rowHead = (m: Mounted, index: number): Element | null => m.list.querySelector(`[data-ncf-block="${index}"] > .ncf-item__head`)
const types = (data: TemplateData, screen = 0): string[] => items(items(data, 'screens')[screen] ?? {}, 'blocks').map((b) => str(b, 'type'))
/** 画面 screen の部品 block に値を足した中身 */
const setBlock = (data: TemplateData, screen: number, block: number, values: ItemData): TemplateData => ({
  ...data,
  screens: items(data, 'screens').map((s, si) =>
    si !== screen ? s : { ...s, blocks: items(s, 'blocks').map((b, bi) => (bi === block ? { ...b, ...values } : b)) },
  ),
})
const sectionTitles = (m: Mounted): string[] => [...m.panel.querySelectorAll('.ncf-fold--section > summary')].map((s) => s.textContent ?? '')

function withHotspot(): TemplateData {
  const base = BUILDER_TEMPLATE.defaults(new Date(0))
  const hotspot = ALL_BLOCK_TYPES.find((t) => t.type === 'hotspot')?.newItem() ?? {}
  const screens = items(base, 'screens').map((screen, i) => {
    if (i !== 0) return screen
    const blocks = items(screen, 'blocks')
    // 見出し・文章・ボタン・（そのボタンに被せた移行先）・ボタン・ボタン
    return { ...screen, blocks: [...blocks.slice(0, 3), { ...hotspot, action: 'screen', target: 's2' }, ...blocks.slice(3)] }
  })
  return { ...base, screens }
}

describe('左の列の並びと、右の設定', () => {
  it('並びには画面①の部品が上から順に出て、何も選んでいないときは右に画面の設定とWidget全体の設定が出る', () => {
    const m = mountSplit(withHotspot())
    expect(m.list.querySelectorAll('.ncf-item').length).toBe(6)
    expect(m.list.querySelector('[data-ncf-block="3"]')?.classList.contains('ncf-item--hotspot')).toBe(true)
    const folds = [...m.panel.querySelectorAll('.ncf-fold > summary')].map((s) => s.textContent)
    expect(folds).toEqual(['この画面の設定（画面①）', 'Widget全体の設定（背景・余白・切り替わり方）'])
    expect([...m.tabs.querySelectorAll('.ncf-screen-tab')].map((t) => t.textContent)).toEqual(['画面①', '画面②'])
  })

  // ボタンは「押したとき」をいちばん上に出す（2026-10-24 本人「横の画面でボタンの移行先を決めたい」→「両方」）
  it('並びの行を押すと、右にその部品の設定が段で出る。ボタンは「押したとき」がいちばん上で、「LPの上で」もある', () => {
    const m = mountSplit(withHotspot())
    click(rowHead(m, 2))
    expect(m.form.selectedBlock()).toBe(2)
    expect(m.selects.at(-1)).toEqual([0, 2])
    expect(m.panel.querySelector('.ncf-inspector__name')?.textContent).toBe('ボタン')
    expect(sectionTitles(m)).toEqual(['押したとき', 'レイアウト', '中身', '背景の画像'])
    const pressText = m.panel.querySelector('.ncf-press')?.textContent ?? ''
    expect(pressText).toContain('LPの上で')
    // もう一度押すと畳む（選ぶのをやめる）
    click(rowHead(m, 2))
    expect(m.form.selectedBlock()).toBeNull()
  })

  it('段を畳むと、別の部品を選んでも畳んだまま', () => {
    const m = mountSplit(withHotspot())
    click(rowHead(m, 0))
    const layout = m.panel.querySelector('.ncf-fold--section') as unknown as HTMLDetailsElement
    layout.open = false
    layout.dispatchEvent(new window.Event('toggle') as unknown as Event)
    click(rowHead(m, 2))
    // ボタンは「押したとき」が先頭なので、レイアウトの段を名前で探す
    const again = [...m.panel.querySelectorAll('.ncf-fold--section')].find(
      (s) => s.querySelector('summary')?.textContent === 'レイアウト',
    ) as unknown as HTMLDetailsElement
    expect(again.open).toBe(false)
  })
})

describe('この画面のボタンの移る先を、右の「この画面の設定」でまとめて決める（2026-10-24 本人「横の画面でボタンの移行先を決めたい」→「両方」）', () => {
  const NOW = new Date('2026-10-24T12:00:00+09:00')
  /** アンケートの Q3（はじめ・Q1・Q2・Q3・結果A・結果B の4番目＝手軽さ・値段・効き目・安心して続けられるか） */
  const atQ3 = (): Mounted => {
    const m = mountSplit(surveyData(NOW, { startButton: true }))
    m.form.select(3, null)
    return m
  }
  const rows = (m: Mounted): Element[] => [...m.panel.querySelectorAll('[data-ncf-overview-block]')]
  const chip = (row: Element | undefined, label: string): Element | undefined =>
    [...(row?.querySelectorAll('.ncf-chip') ?? [])].find((c) => c.textContent === label)

  it('何も選んでいないとき「この画面の設定」は開いていて、この画面のボタン（押したときを持つ部品）が全部並ぶ', () => {
    const m = atQ3()
    const fold = [...m.panel.querySelectorAll('.ncf-fold')].find((f) => f.querySelector('summary')?.textContent === 'この画面の設定（Q3）')
    expect((fold as unknown as HTMLDetailsElement | undefined)?.open).toBe(true)
    expect(rows(m).map((r) => r.getAttribute('data-ncf-overview-block'))).toEqual(['2', '3', '4', '5'])
    expect(rows(m)[1]?.textContent).toContain('値段')
    // いまの移る先に印（値段 → 結果A）。自分の画面（Q3）は出さない
    expect(chip(rows(m)[1], '結果A')?.getAttribute('aria-pressed')).toBe('true')
    expect(chip(rows(m)[1], 'Q3')).toBeUndefined()
  })

  it('ボタンごとに移る先を選び直せる（値段 → 結果B）', () => {
    const m = atQ3()
    click(chip(rows(m)[1], '結果B'))
    const block = items(items(m.changes.at(-1) ?? {}, 'screens')[3] ?? {}, 'blocks')[3] ?? {}
    expect([str(block, 'action'), str(block, 'target')]).toEqual(['screen', 's6'])
    expect(chip(rows(m)[1], '結果B')?.getAttribute('aria-pressed')).toBe('true')
  })

  it('「リンクを開く」を選ぶと、そのボタンを選んでリンク先を入れられるようにする', () => {
    const m = atQ3()
    click(chip(rows(m)[0], 'リンクを開く'))
    expect(str(items(items(m.changes.at(-1) ?? {}, 'screens')[3] ?? {}, 'blocks')[2] ?? {}, 'action')).toBe('link')
    expect(m.form.selectedBlock()).toBe(2)
    expect(sectionTitles(m)[0]).toBe('押したとき')
  })

  it('「この部品を選ぶ」でそのボタンの設定を開ける', () => {
    const m = atQ3()
    click(rows(m)[3]?.querySelector('.ncf-overview__select'))
    expect(m.form.selectedBlock()).toBe(5)
  })

  it('ボタンが無い画面には並びを出さない', () => {
    const m = mountSplit(surveyData(NOW, { startButton: true }))
    m.form.select(4, null)
    m.form.select(0, null)
    expect(rows(m).map((r) => r.textContent?.includes('回答をはじめる'))).toEqual([true])
  })
})

describe('背景の画像（2026-10-24 本人「ボタンの背景だったり枠の背景だったり…その画像にできるように。位置や大きさは自由に」）', () => {
  const IMG = `data:image/png;base64,${'A'.repeat(40)}`
  const moves: (string | number)[][] = []
  /** Widget編集と同じ形に「画面でつかんで動かす」の受け口を足して組み立てる */
  function mountWithMove(data: TemplateData): Mounted {
    const tabs = document.createElement('div') as unknown as HTMLElement
    const list = document.createElement('div') as unknown as HTMLElement
    const palette = document.createElement('div') as unknown as HTMLElement
    const changes: TemplateData[] = []
    const form = buildTemplateForm({
      fields: BUILDER_TEMPLATE.fields,
      data,
      onChange: (next) => changes.push(next),
      tabsHost: tabs,
      partsHost: { list, palette },
      onBgMove: (path) => moves.push([...path]),
    })
    document.body.replaceChildren(tabs, list, palette, form.element)
    return { form, list, panel: form.element, tabs, changes, selects: [] }
  }
  const moveButtons = (m: Mounted): HTMLElement[] =>
    [...m.panel.querySelectorAll('.ncf-bg-move')] as unknown as HTMLElement[]

  it('部品: 「背景の画像」の段。画像を選ぶまで「画面でつかんで動かす」は出ない。押すとその部品の場所を渡す', () => {
    const m = mountWithMove(withHotspot())
    click(rowHead(m, 2))
    expect(moveButtons(m).map((b) => b.hidden)).toEqual([true])
    const withImage = setBlock(m.form.getData(), 0, 2, { bgImage: IMG })
    m.form.setData(withImage)
    expect(moveButtons(m).map((b) => b.hidden)).toEqual([false])
    click(moveButtons(m)[0])
    expect(moves.at(-1)).toEqual(['screens', 0, 'blocks', 2])
  })

  it('Widget全体の設定と、この画面の設定にも「背景の画像」', () => {
    const m = mountWithMove({ ...withHotspot(), bgImage: IMG })
    const labels = [...m.panel.querySelectorAll('.ncf-label')].map((l) => l.textContent)
    expect(labels).toContain('この画面の背景の画像')
    expect(labels).toContain('背景の画像')
    // Widget全体は画像があるので動かせる・画面①はまだ画像が無い
    const shown = moveButtons(m).filter((b) => !b.hidden)
    expect(shown).toHaveLength(1)
    click(shown[0])
    expect(moves.at(-1)).toEqual([])
  })
})

describe('並びの複製・上へ・下へ・消す', () => {
  it('複製すると、すぐ下の複製を選ぶ。消すと選ぶのをやめる', () => {
    const m = mountSplit(withHotspot())
    click(m.list.querySelector('[data-ncf-block="0"] .ncf-item__copy'))
    expect(types(m.form.getData())).toEqual(['heading', 'heading', 'text', 'button', 'hotspot', 'button', 'button'])
    expect(m.form.selectedBlock()).toBe(1)
    click(m.list.querySelector('[data-ncf-block="1"] .ncf-item__remove'))
    expect(types(m.form.getData())).toEqual(['heading', 'text', 'button', 'hotspot', 'button', 'button'])
    expect(m.form.selectedBlock()).toBeNull()
  })

  it('移行先を被せた部品は、移行先ごと上下に動く', () => {
    const m = mountSplit(withHotspot())
    click(m.list.querySelector('[data-ncf-block="2"] [aria-label="上へ"]'))
    expect(types(m.form.getData())).toEqual(['heading', 'button', 'hotspot', 'text', 'button', 'button'])
    expect(m.form.selectedBlock()).toBe(1)
    click(m.list.querySelector('[data-ncf-block="1"] [aria-label="下へ"]'))
    expect(types(m.form.getData())).toEqual(['heading', 'text', 'button', 'hotspot', 'button', 'button'])
  })

  it('行で Backspace を押すと、その部品を消す', () => {
    const m = mountSplit(withHotspot())
    const event = new window.Event('keydown', { bubbles: true, cancelable: true }) as unknown as Record<string, unknown>
    event['key'] = 'Backspace'
    rowHead(m, 1)?.dispatchEvent(event as unknown as Event)
    expect(types(m.form.getData())).toEqual(['heading', 'button', 'hotspot', 'button', 'button'])
  })
})

describe('部品を足す・画面', () => {
  it('左の「部品を足す」を押すと、いちばん下に入って選ばれる。insertBlock は指定の位置に入れる', () => {
    const m = mountSplit(withHotspot())
    click(document.querySelector('.ncf-palette__tile'))
    expect(types(m.form.getData()).at(-1)).toBe('heading')
    expect(m.form.selectedBlock()).toBe(6)
    m.form.insertBlock('text', 1)
    expect(types(m.form.getData())[1]).toBe('text')
    expect(m.form.selectedBlock()).toBe(1)
  })

  it('「押したとき」で「＋新しい画面」を選ぶと画面が増え、「この部品を出す画面」で画面②へ移せる', () => {
    const m = mountSplit(withHotspot())
    click(rowHead(m, 4))
    const chip = (label: string, value: string): Element | undefined =>
      [...m.panel.querySelectorAll('.ncf-field')]
        .find((row) => (row.textContent ?? '').startsWith(label))
        ?.querySelector(`.ncf-chip[data-value="${value}"]`) ?? undefined
    click(chip('この部品を出す画面', '1'))
    expect(m.form.activeScreen()).toBe(1)
    expect(types(m.form.getData(), 1).at(-1)).toBe('button')
    expect(types(m.form.getData(), 0)).toEqual(['heading', 'text', 'button', 'hotspot', 'button'])
  })

  it('タブの「＋ 画面を足す」で画面を足して、その画面を開く', () => {
    const m = mountSplit(withHotspot())
    click(m.tabs.querySelector('.ncf-screen-add'))
    expect(items(m.form.getData(), 'screens').length).toBe(3)
    expect(m.form.activeScreen()).toBe(2)
    expect(m.tabs.querySelectorAll('.ncf-screen-tab').length).toBe(3)
  })

  it('全部消して作り直すと「何から作りますか？」が出て、例を選ぶと中身がその例になる', async () => {
    vi.useFakeTimers()
    try {
      const tabs = document.createElement('div') as unknown as HTMLElement
      const list = document.createElement('div') as unknown as HTMLElement
      const palette = document.createElement('div') as unknown as HTMLElement
      const example = BUILDER_TEMPLATE.defaults(new Date(0))
      const form = buildTemplateForm({
        fields: BUILDER_TEMPLATE.fields,
        data: withHotspot(),
        onChange: () => undefined,
        tabsHost: tabs,
        partsHost: { list, palette },
        examples: [{ label: 'アンケートの例', summary: '例', icon: '', data: () => example }],
      })
      document.body.replaceChildren(tabs, list, palette, form.element)
      click(list.querySelector('.ncf-reset'))
      click([...document.querySelectorAll('.sbd-overlay button')].at(-1))
      await vi.advanceTimersByTimeAsync(200)
      expect(types(form.getData())).toEqual([])
      expect(form.element.querySelector('.ncf-start__title')?.textContent).toBe('何から作りますか？')
      click(form.element.querySelector('.ncf-pick'))
      expect(form.getData()).toBe(example)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('左右に分けないとき（ポップアップの中身など）', () => {
  it('選んだ部品は並びの中で広がり、いちばん下の「足す」で部品を足せる。型の部品の中の並びも足せる', () => {
    const form = buildTemplateForm({ fields: BUILDER_TEMPLATE.fields, data: withHotspot(), onChange: () => undefined })
    document.body.replaceChildren(form.element)
    click(form.element.querySelector('[data-ncf-block="2"] > .ncf-item__head'))
    expect(form.element.querySelector('.ncf-item--selected .ncf-item__body')).not.toBeNull()
    const faq = [...form.element.querySelectorAll('.ncf-adder__btn')].find((b) => (b.textContent ?? '').includes('よくある質問'))
    click(faq)
    const added = items(items(form.getData(), 'screens')[0] ?? {}, 'blocks').at(-1) as ItemData
    expect(str(added, 'type')).toBe('tpl-faq')
    const before = items(added, 'items').length
    click(form.element.querySelector('.ncf-item--selected .ncf-add'))
    const after = items(items(items(form.getData(), 'screens')[0] ?? {}, 'blocks').at(-1) ?? {}, 'items').length
    expect(after).toBe(before + 1)
  })

  it('画面を持たない型（よくある質問）は、並びをそのまま足したり消したりできる', () => {
    const form = buildTemplateForm({ fields: FAQ_TEMPLATE.fields, data: FAQ_TEMPLATE.defaults(new Date(0)), onChange: () => undefined })
    document.body.replaceChildren(form.element)
    const count = (): number => items(form.getData(), 'items').length
    const first = count()
    click(form.element.querySelector('.ncf-add'))
    expect(count()).toBe(first + 1)
    click(form.element.querySelector('.ncf-item__remove'))
    expect(count()).toBe(first)
  })
})
