/**
 * Versionの編集画面の左の「設置済み」に「離脱ポップ▼」も並べる（指示41・2026-10-31 本人「ここに離脱ポップの項目も設けて
 * 確認できるようにしたい。Widget▼ 離脱ポップ▼ って感じで、それぞれプルダウンみたいな感じで開けるようにしたい」
 * → 本人の選択「3つとも（離脱防止・追従型・表示直後）」「押したら LP の上で確認」）。
 */
import { parseHTML } from 'linkedom'
import { beforeEach, describe, expect, it } from 'vitest'
import { navPopupsOf, navSection, popupCards, popupEditHash, type NavPopup } from '../src/app/panels/widget-nav-popups.ts'

beforeEach(() => {
  const { document, window } = parseHTML('<!doctype html><html><body></body></html>')
  const g = globalThis as unknown as Record<string, unknown>
  g['document'] = document
  g['window'] = window
})

const exit = (uid: string, kind: 'exit' | 'instant', enabled = true) =>
  ({ uid, name: `P-${uid}`, popup_kind: kind, enabled, html: '<p>x</p>' }) as never
const follow = (uid: string) => ({ uid, name: `F-${uid}`, enabled: true, html: '<div>帯</div>', css: '', position: 'bottom' }) as never

describe('並べるポップアップ', () => {
  it('離脱防止・表示直後・追従型の順に、種類を付けて並べる', () => {
    const list = navPopupsOf([exit('E2', 'instant'), exit('E1', 'exit')], [follow('F1')])
    expect(list.map((p) => `${p.kind}:${p.uid}`)).toEqual(['exit:E1', 'instant:E2', 'follow:F1'])
  })
})

describe('開け閉めの見出し', () => {
  it('名前と数を出し、押すと開け閉めする', () => {
    let toggled = 0
    const section = navSection('離脱ポップ', 2, true, () => {
      toggled += 1
    })
    document.body.append(section.el)
    const header = section.el.querySelector('button') as unknown as HTMLElement
    expect(header.textContent).toContain('離脱ポップ（2）')
    expect(header.getAttribute('aria-expanded')).toBe('true')
    header.click()
    expect(toggled).toBe(1)
  })

  it('閉じているときは中身を隠す（display で消す＝style の display:flex が hidden に勝って見えたままだった）', () => {
    const section = navSection('Widget', 1, false, () => undefined)
    expect(section.body.hidden).toBe(true)
    expect(section.body.style.display).toBe('none')
    expect(navSection('Widget', 1, true, () => undefined).body.style.display).toBe('flex')
  })
})

describe('ポップアップのカード', () => {
  const popups: NavPopup[] = navPopupsOf([exit('EXITPOPUP_0001', 'exit'), exit('EXITPOPUP_0002', 'instant', false)], [])

  it('押すと、いまの Version の LP の上でそのポップを確認する（配信OFFでも出す）。編集は編集画面へ', () => {
    const checked: string[] = []
    const edited: string[] = []
    const cards = popupCards(popups, { versionUid: () => 'VERSION_0102', onCheck: (url) => checked.push(url), onEdit: (uid) => edited.push(uid) })
    document.body.append(cards)
    const first = cards.querySelector('[data-nav-popup]') as unknown as HTMLElement
    first.click()
    expect(checked).toEqual(['/preview/VERSION_0102?popup_draft=EXITPOPUP_0001'])
    ;(first.querySelector('[data-nav-popup-edit]') as unknown as HTMLElement).click()
    expect(edited).toEqual(['EXITPOPUP_0001'])
    expect(checked).toHaveLength(1)
  })

  it('種類と配信のON/OFFを添える', () => {
    const cards = popupCards(popups, { versionUid: () => 'V', onCheck: () => undefined, onEdit: () => undefined })
    const texts = [...cards.querySelectorAll('[data-nav-popup]')].map((card) => card.textContent ?? '')
    expect(texts[0]).toContain('離脱防止')
    expect(texts[0]).toContain('配信ON')
    expect(texts[1]).toContain('表示直後')
    expect(texts[1]).toContain('配信OFF')
  })

  it('ポップアップが無ければ、そう出す', () => {
    const cards = popupCards([], { versionUid: () => 'V', onCheck: () => undefined, onEdit: () => undefined })
    expect(cards.textContent).toContain('このページのポップアップはまだありません')
  })
})

describe('編集画面へ', () => {
  it('ポップアップの画面を、そのポップを開いた状態で開くアドレス', () => {
    expect(popupEditHash('AB1', 'EXITPOPUP_0001')).toBe('#/ab_tests/AB1/articles/exit_popups?open=EXITPOPUP_0001')
  })
})
