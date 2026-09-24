/**
 * 上のツールバーのうち、部品で作ったWidgetで受け持つもの（2026-09-24・点検で見つけた食い違いの直し）。
 * リンク・画像は部品の文字の中に持てない（描き直すと消えていた）→ 部品として扱う。サイズ−／＋は今の大きさから。
 */
import { describe, expect, it } from 'vitest'
import { createToolbarHooks } from '../src/app/panels/widget-studio-toolbar.ts'
import type { ItemData, TemplateData } from '../src/app/panels/nocode/templates/types.ts'

type Call = [string, ...unknown[]]

function setup(blocks: readonly ItemData[], selectedIndex: number | null) {
  const calls: Call[] = []
  const data = { screens: [{ id: 's1', name: '画面①', blocks }] } as unknown as TemplateData
  const hooks = createToolbarHooks({
    data: () => data,
    selected: () => {
      const block = selectedIndex === null ? undefined : blocks[selectedIndex]
      return selectedIndex === null || block === undefined ? null : { screenIndex: 0, blockIndex: selectedIndex, block, el: null }
    },
    commit: (path, key, value) => calls.push(['commit', path.join('.'), key, value]),
    insertBlock: (type, at, init) => calls.push(['insert', type, at, init]),
    inspector: () => null,
  })
  return { hooks, calls }
}

const HEADING: ItemData = { type: 'heading', text: 'a', size: 21 }
const BUTTON: ItemData = { type: 'button', label: 'b', action: 'none' }
const HOT: ItemData = { type: 'hotspot', action: 'none' }

describe('リンク', () => {
  it('押せる部品（ボタンなど）は「押したとき」をリンクにする', () => {
    const { hooks, calls } = setup([BUTTON], 0)
    expect(hooks.onLink()).toBe(true)
    expect(calls).toEqual([['commit', 'screens.0.blocks.0', 'action', 'link']])
  })

  it('見出し・文章には、リンクを開く移行先を部品まるごとに被せる（被せた移行先の後ろへ）', () => {
    const { hooks, calls } = setup([HEADING, HOT, BUTTON], 0)
    expect(hooks.onLink()).toBe(true)
    expect(calls).toEqual([['insert', 'hotspot', 2, { x: 0, y: 0, w: 100, h: 100, action: 'link' }]])
  })

  it('押したときを持たない型の部品（よくある質問など）にも、移行先を被せる', () => {
    const { hooks, calls } = setup([{ type: 'tpl-faq', items: [] }], 0)
    expect(hooks.onLink()).toBe(true)
    expect(calls[0]?.[0]).toBe('insert')
  })

  it('見本の部品・何も選んでいないときは受け持たない（見本の中身に直接リンクを入れる）', () => {
    expect(setup([{ type: 'sample', html: '<p>x</p>' }], 0).hooks.onLink()).toBe(false)
    expect(setup([HEADING], null).hooks.onLink()).toBe(false)
  })
})

describe('画像（PCから追加）', () => {
  it('画像の部品として、選んだ部品の下に足す（何も選んでいなければ、いちばん下）', () => {
    const picked = setup([HEADING, HOT, BUTTON], 0)
    expect(picked.hooks.onImage('data:image/png;base64,AAAA')).toBe(true)
    expect(picked.calls).toEqual([['insert', 'image', 2, { image: 'data:image/png;base64,AAAA' }]])
    const none = setup([HEADING], null)
    expect(none.hooks.onImage('data:image/png;base64,AAAA')).toBe(true)
    expect(none.calls[0]?.[2]).toBe(Number.MAX_SAFE_INTEGER)
  })

  it('見本の部品を選んでいるときは、見本の中身に入れる（受け持たない）', () => {
    expect(setup([{ type: 'sample', html: '<p>x</p>' }], 0).hooks.onImage('data:image/png;base64,AAAA')).toBe(false)
  })
})

describe('サイズ−／＋（文字を選んでいないとき）', () => {
  it('見出し・文章は、部品の文字の大きさを今の大きさから1pxずつ', () => {
    const { hooks, calls } = setup([HEADING], 0)
    expect(hooks.fontSizeStep(1)).toBe(22)
    expect(calls).toEqual([['commit', 'screens.0.blocks.0', 'size', 22]])
  })

  it('大きさの端では止まる。見出し・文章でなければ受け持たない（文字全体に効かせる）', () => {
    expect(setup([{ type: 'heading', text: 'a', size: 48 }], 0).hooks.fontSizeStep(1)).toBe(48)
    expect(setup([BUTTON], 0).hooks.fontSizeStep(1)).toBeNull()
  })
})
