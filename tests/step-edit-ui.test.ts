/**
 * ステップの色（2026-09-24: 作るときに選んだ色が送られず捨てられていた）と、下部バーのステップの「…」
 */
import { describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'
import { rgbToHex } from '../src/app/panels/step-add-modal.ts'
import { renderStepList } from '../src/app/pages/editor-step-list.ts'

describe('ステップの色', () => {
  it('見本の色（rgb）を #rrggbb にする', () => {
    expect(rgbToHex('rgb(98, 54, 255)')).toBe('#6236ff')
    expect(rgbToHex('rgb(0, 0, 0)')).toBe('#000000')
    expect(rgbToHex('')).toBe('')
    expect(rgbToHex('transparent')).toBe('')
  })
})

describe('下部バーのステップ', () => {
  const template =
    '<div class="_funneSteplListWrapper_rugej_1"><div class="_funneStepList_rugej_35 _parent_rugej_60 _active_rugej_66"><div class="_iconParent_rugej_56"></div><div class="_listOption_rugej_99"></div></div></div>'

  it('色のあるステップには色の印を付け、「…」でメニューを開ける（最初のステップにも出す）', () => {
    const { document } = parseHTML(`<!doctype html><html><body><div id="root">${template}</div></body></html>`)
    ;(globalThis as unknown as Record<string, unknown>)['document'] = document
    const root = document.getElementById('root') as unknown as HTMLElement
    const opened: number[] = []
    renderStepList(root, {
      steps: [{ uid: 'A1' }, { uid: 'A2', memo: '確認', color: '#6236ff' }],
      activeIndex: 0,
      onSelect: () => undefined,
      onMenu: (index) => opened.push(index),
    })
    const items = root.querySelectorAll('[data-step-uid]')
    expect(items.length).toBe(2)
    expect((items[1]?.querySelector('[data-step-color]') as HTMLElement | null)?.getAttribute('data-step-color')).toBe('#6236ff')
    const menus = root.querySelectorAll('[data-step-menu]')
    expect(menus.length).toBe(2)
    ;(menus[1] as HTMLElement).dispatchEvent(new (document.defaultView as unknown as { Event: typeof Event }).Event('click'))
    expect(opened).toEqual([1])
  })
})
