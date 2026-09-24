/**
 * Widget編集のキー操作（2026-09-24・点検の残り7〜9）。
 * 7 ⌘C／⌘V（別の画面・別のWidgetへも）・⌘D（その場で複製）
 * 8 ↑↓ で隣の部品を選ぶ・⌥↑↓ で並べ替え・移行先は矢印で少しずつ動かす（⇧で大きく）
 * 9 1回押して（部品を選んで）そのまま打つと、文字の末尾から打ち始める
 */
import { describe, expect, it } from 'vitest'
import { createPartOps, partKeyAction } from '../src/app/panels/widget-studio-part-ops.ts'
import { duplicateGroup } from '../src/app/panels/nocode/hotspot-model.ts'
import type { ItemData, TemplateData } from '../src/app/panels/nocode/templates/types.ts'

const b = (label: string): ItemData => ({ type: 'button', label })
const h = (name: string, x = 0): ItemData => ({ type: 'hotspot', name, x, y: 0, w: 50, h: 50 })

function setup(screens: ItemData[][], selected: number | null, screen = 0) {
  let data = { screens: screens.map((blocks, i) => ({ id: `s${i + 1}`, blocks })) } as unknown as TemplateData
  let sel = selected
  let active = screen
  const ops = createPartOps({
    data: () => data,
    screen: () => active,
    selected: () => sel,
    load: (next, screenIndex, blockIndex) => {
      data = next
      active = screenIndex
      sel = blockIndex
    },
    select: (screenIndex, blockIndex) => {
      active = screenIndex
      sel = blockIndex
    },
    blockMax: 30,
    toast: () => undefined,
  })
  const list = (i = active): string[] =>
    ((data['screens'] as unknown as { blocks: ItemData[] }[])[i]?.blocks ?? []).map((item) => String(item['label'] ?? item['name']))
  const item = (i: number, s = active): ItemData | undefined => (data['screens'] as unknown as { blocks: ItemData[] }[])[s]?.blocks[i]
  return { ops, list, item, selected: () => sel, setScreen: (i: number) => (active = i), select: (i: number | null) => (sel = i) }
}

describe('⌘C／⌘V・⌘D', () => {
  it('⌘C で部品（被せた移行先ごと）を覚え、⌘V で選んでいる部品の下へ貼る。貼った部品を選ぶ', () => {
    const t = setup([[b('A'), h('a1'), b('B')]], 0)
    expect(t.ops.copy()).toBe(true)
    t.select(2)
    expect(t.ops.paste()).toBe(true)
    expect(t.list()).toEqual(['A', 'a1', 'B', 'A', 'a1'])
    expect(t.selected()).toBe(3)
  })

  it('別の画面にも貼れる（何も選んでいなければ、いちばん下）', () => {
    const t = setup([[b('A')], [b('X')]], 0)
    t.ops.copy()
    t.setScreen(1)
    t.select(null)
    t.ops.paste()
    expect(t.list(1)).toEqual(['X', 'A'])
  })

  it('移行先だけを覚えていて、被せる部品が無い画面には貼らない（ブラウザの貼り付けに任せる）', () => {
    const t = setup([[b('A'), h('lonely')]], 1)
    t.ops.copy()
    const empty = setup([[]], null)
    expect(empty.ops.paste()).toBe(false)
    expect(empty.list()).toEqual([])
  })

  it('移行先を選んでいるときに貼ると、その移行先が被さる部品のまとまりの後ろへ（ほかの部品と移行先の間に入れない）', () => {
    const t = setup([[b('X')]], 0)
    t.ops.copy()
    const u = setup([[b('A'), h('a1'), h('a2'), b('B')]], 1)
    u.ops.paste()
    expect(u.list()).toEqual(['A', 'a1', 'a2', 'X', 'B'])
  })

  it('⌘D はその場で複製（移行先ごと）し、複製した方を選ぶ', () => {
    const t = setup([[b('A'), h('a1'), b('B')]], 0)
    expect(t.ops.duplicate()).toBe(true)
    expect(t.list()).toEqual(['A', 'a1', 'A', 'a1', 'B'])
    expect(t.selected()).toBe(2)
  })

  it('型の部品を複製・貼り付けすると、部品の名前（uid）を付け直す（同じ名前だと色などがまざる）', () => {
    const tpl: ItemData = { type: 'tpl-cta', uid: 'nc-aaaaaaaa', label: 'x' }
    const t = setup([[tpl]], 0)
    t.ops.duplicate()
    expect(t.item(1)?.['uid']).toMatch(/^nc-[a-z0-9]{8}$/)
    expect(t.item(1)?.['uid']).not.toBe('nc-aaaaaaaa')
    const copied = duplicateGroup([tpl], 0, 30)
    expect(copied?.list[1]?.['uid']).not.toBe('nc-aaaaaaaa')
  })
})

describe('↑↓・⌥↑↓・移行先の矢印', () => {
  it('↑↓ で隣の部品を選ぶ（端では止まる）', () => {
    const t = setup([[b('A'), b('B'), b('C')]], 1)
    expect(t.ops.step(1)).toBe(true)
    expect(t.selected()).toBe(2)
    t.ops.step(1)
    expect(t.selected()).toBe(2)
    t.ops.step(-1)
    t.ops.step(-1)
    t.ops.step(-1)
    expect(t.selected()).toBe(0)
  })

  it('⌥↑↓ で並べ替え（被せた移行先ごと）', () => {
    const t = setup([[b('A'), h('a1'), b('B')]], 0)
    expect(t.ops.move(1)).toBe(true)
    expect(t.list()).toEqual(['B', 'A', 'a1'])
    expect(t.selected()).toBe(1)
  })

  it('移行先は矢印で 1% ずつ（部品の中に収める）', () => {
    const t = setup([[b('A'), h('a1', 49)]], 1)
    expect(t.ops.nudge(1, 0)).toBe(true)
    expect(t.item(1)?.['x']).toBe(50)
    t.ops.nudge(10, 0)
    expect(t.item(1)?.['x']).toBe(50)
    expect(setup([[b('A')]], 0).ops.nudge(1, 0)).toBe(false)
  })
})

describe('どのキーが何をするか', () => {
  const key = (k: string, mods: Partial<{ metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean }> = {}) => ({
    key: k,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...mods,
  })
  const picked = { hasSelected: true, isTyping: false, selectedIsHotspot: false, selectedIsText: true }

  it('⌘C・⌘V・⌘D（Ctrl でも）', () => {
    expect(partKeyAction(key('c', { metaKey: true }), picked)).toBe('copy')
    expect(partKeyAction(key('v', { ctrlKey: true }), picked)).toBe('paste')
    expect(partKeyAction(key('d', { metaKey: true }), picked)).toBe('duplicate')
  })

  it('↑↓ は隣を選ぶ、⌥ と一緒なら並べ替え。移行先は矢印で動かす（⇧で10%）', () => {
    expect(partKeyAction(key('ArrowDown'), picked)).toBe('next')
    expect(partKeyAction(key('ArrowUp', { altKey: true }), picked)).toBe('moveUp')
    const hot = { ...picked, selectedIsHotspot: true, selectedIsText: false }
    expect(partKeyAction(key('ArrowLeft'), hot)).toBe('nudge')
    expect(partKeyAction(key('ArrowDown', { shiftKey: true }), hot)).toBe('nudge')
  })

  it('1回押した文字の部品で文字を打つと、打ち始める（日本語入力の最初のキーも）', () => {
    expect(partKeyAction(key('あ'), picked)).toBe('startTyping')
    expect(partKeyAction(key('a'), picked)).toBe('startTyping')
    expect(partKeyAction(key('Process'), picked)).toBe('startTyping')
    expect(partKeyAction(key('a'), { ...picked, selectedIsText: false })).toBe('none')
  })

  it('文字を打っている途中は、どのキーも文字の操作に任せる（⌘C は文字のコピー）', () => {
    const typing = { ...picked, isTyping: true }
    for (const k of [key('c', { metaKey: true }), key('ArrowDown'), key('a'), key('d', { metaKey: true })]) {
      expect(partKeyAction(k, typing)).toBe('none')
    }
  })

  it('何も選んでいないとき: ⌘V だけ（いちばん下へ貼る）', () => {
    const none = { ...picked, hasSelected: false }
    expect(partKeyAction(key('v', { metaKey: true }), none)).toBe('paste')
    expect(partKeyAction(key('c', { metaKey: true }), none)).toBe('none')
    expect(partKeyAction(key('ArrowDown'), none)).toBe('none')
  })
})
