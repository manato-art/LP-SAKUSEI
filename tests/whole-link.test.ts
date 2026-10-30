/**
 * 見本の中の要素「全体」にリンクを付ける（2026-10-31 本人「移行先のリンクなんだけど、このポップ全体に対して反映したいのに、
 * ボタンだけになってしまう。全体を押してリンク先にリンク入れても対象がボタンだけになる。
 * ボタンだけがいい時はボタンだけ押してリンク先にリンク入れますから」）。
 *
 * 全体（囲み・帯など）を選んだときは「この要素全体のリンク先」、ボタンを選んだときは今までどおり「ボタンのリンク先」。
 * 全体のリンクは、要素の中いっぱいに広げた見えないリンク（本物の <a>）にする。本物のリンクなので、配信のLPパラメーター・
 * クリックの計測・リンク置換の一覧にもそのまま乗る。中のボタンに別のリンク先が入っていれば、ボタンはそちらへ移る。
 */
import { describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'
import {
  canLinkWhole,
  nextLinkBoxId,
  setWholeLink,
  usesWholeLink,
  wholeLinkCover,
  wholeLinkOf,
} from '../src/app/panels/nocode/whole-link.ts'
import { sampleSlots, type SlotNode } from '../src/app/panels/nocode/sample-model.ts'
import { BUILDER_TEMPLATE } from '../src/app/panels/nocode/templates/builder.ts'
import type { ItemData, TemplateData } from '../src/app/panels/nocode/templates/types.ts'

const BANNER =
  '<div class="banner" style="display:flex"><span>4980で"肌再生"</span><a href="#" class="btn">最安値 →</a></div>'

function banner(): { root: HTMLElement; box: HTMLElement; button: HTMLElement } {
  const { document } = parseHTML(`<!doctype html><html><body><div id="root">${BANNER}</div></body></html>`)
  const root = document.getElementById('root') as unknown as HTMLElement
  return {
    root,
    box: root.querySelector('.banner') as unknown as HTMLElement,
    button: root.querySelector('.btn') as unknown as HTMLElement,
  }
}

describe('全体にリンクを付けられる要素', () => {
  it('囲み（div など）は付けられる', () => {
    expect(canLinkWhole(banner().box)).toBe(true)
  })

  it('ボタン（リンク）そのもの・その中・画像や動画は付けない（ボタンは「ボタンのリンク先」で直す）', () => {
    const { box, button } = banner()
    expect(canLinkWhole(button)).toBe(false)
    const inner = box.ownerDocument.createElement('b')
    button.append(inner)
    expect(canLinkWhole(inner)).toBe(false)
    expect(canLinkWhole(box.ownerDocument.createElement('img'))).toBe(false)
    expect(canLinkWhole(box.ownerDocument.createElement('video'))).toBe(false)
  })
})

describe('全体のリンクを付ける・直す・外す', () => {
  it('付けると、要素の中いっぱいの見えないリンクが入り、要素に印が付く', () => {
    const { box } = banner()
    expect(setWholeLink(box, 'https://shop.example.test/buy', 'l1')).toBe(true)
    const cover = box.firstElementChild as HTMLElement
    expect(cover.tagName).toBe('A')
    expect(cover.hasAttribute('data-nc-cover')).toBe(true)
    expect(cover.getAttribute('href')).toBe('https://shop.example.test/buy')
    expect(cover.getAttribute('style')).toContain('position:absolute!important')
    expect(cover.getAttribute('style')).toContain('inset:0!important')
    // 読み上げでも行き先の分かる名前（要素の文字）
    expect(cover.getAttribute('aria-label')).toBe('4980で"肌再生" 最安値 →')
    expect(box.getAttribute('data-nc-link-box')).toBe('l1')
    expect(wholeLinkOf(box)).toBe('https://shop.example.test/buy')
    // 中のボタンはそのまま（自分のリンク先のまま）
    expect(box.querySelector('.btn')?.getAttribute('href')).toBe('#')
  })

  it('直すと、同じ見えないリンクのリンク先だけ変わる（計測の目印は元のリンクに合わせる）', () => {
    const { box } = banner()
    setWholeLink(box, 'https://shop.example.test/a?sb_tracking=true', 'l1')
    setWholeLink(box, 'https://shop.example.test/b', 'l1')
    expect(box.querySelectorAll('[data-nc-cover]')).toHaveLength(1)
    expect(wholeLinkOf(box)).toBe('https://shop.example.test/b?sb_tracking=true')
  })

  it('空にすると、見えないリンクと印を外す（元の要素に戻る）', () => {
    const { box } = banner()
    setWholeLink(box, 'https://shop.example.test/buy', 'l1')
    expect(setWholeLink(box, '', 'l1')).toBe(true)
    expect(box.querySelector('[data-nc-cover]')).toBeNull()
    expect(box.hasAttribute('data-nc-link-box')).toBe(false)
    expect(wholeLinkOf(box)).toBe('')
  })

  it('開けないリンク（javascript: など）は付けない', () => {
    const { box } = banner()
    expect(setWholeLink(box, 'javascript:alert(1)', 'l1')).toBe(false)
    expect(box.querySelector('[data-nc-cover]')).toBeNull()
  })

  it('印の名前は l1・l2…の空いている番号', () => {
    expect(nextLinkBoxId('')).toBe('l1')
    expect(nextLinkBoxId('<div data-nc-link-box="l1"></div><div data-nc-link-box="l3"></div>')).toBe('l2')
  })
})

describe('見えないリンクは、ボタンの一覧に出さない', () => {
  it('見本の中身の一覧（ボタンの文字・ボタンのリンク先）には、もとのボタンだけ', () => {
    const { root, box } = banner()
    setWholeLink(box, 'https://shop.example.test/buy', 'l1')
    const controls = sampleSlots(root as unknown as SlotNode, []).filter((slot) => slot.kind === 'control')
    expect(controls).toHaveLength(1)
    expect(controls[0]).toMatchObject({ label: '最安値 →', href: '#' })
  })
})

describe('編集画面の動作確認（Ctrl/⌘＋クリック）', () => {
  it('全体のリンクを付けた要素の中を押したら、その見えないリンクを開く', () => {
    const { box } = banner()
    setWholeLink(box, 'https://shop.example.test/buy', 'l1')
    const text = box.querySelector('span') as unknown as Element
    expect(wholeLinkCover(text)?.getAttribute('href')).toBe('https://shop.example.test/buy')
    expect(wholeLinkCover(banner().box)).toBeNull()
  })
})

describe('書き出し', () => {
  const UID = 'nc-wholelink1'
  const dataWith = (html: string): TemplateData => ({
    ...BUILDER_TEMPLATE.defaults(new Date(0)),
    screens: [{ id: 's1', name: '画面①', blocks: [{ type: 'sample', title: 'バナー', html } as ItemData] }],
  })

  it('全体のリンクを使っているWidgetだけ、中のボタンを見えないリンクより上に出すCSSを付ける', () => {
    const { box } = banner()
    setWholeLink(box, 'https://shop.example.test/buy', 'l1')
    const used = dataWith(box.outerHTML)
    expect(usesWholeLink(used)).toBe(true)
    const css = BUILDER_TEMPLATE.render(used, UID)
    // 重なりは要素の中だけ（ポップアップの ✕ など、外の物の上に見えないリンクを出さない）
    expect(css).toContain(`.${UID} :where([data-nc-link-box]){position:relative;isolation:isolate}`)
    // 中のボタンは見えないリンクより上（自分のリンク先へ）。リンク先が仮（#）のボタンは上に出さない＝全体のリンク先へ
    expect(css).toContain(`.${UID} :where([data-nc-link-box]) :where(a:not([data-nc-cover]):not([href="#"]):not([href=""]),button`)
    expect(usesWholeLink(dataWith(BANNER))).toBe(false)
    expect(BUILDER_TEMPLATE.render(dataWith(BANNER), UID)).not.toContain('data-nc-link-box')
  })
})
