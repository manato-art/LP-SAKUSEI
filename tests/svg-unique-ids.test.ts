/**
 * アイコン（SVG）の中で使う名前（id）を、アイコンごとに別にする（2026-09-25・本人「修正して」）。
 *
 * SVG のグラデーションや切り抜き（clipPath）は id で指す。id はページ全体で1つの名前として扱われるので、
 * 同じ id のアイコンが並ぶと、全部が最初の1つの定義を使う。その1つが隠れている（閉じたメニューの中など）と、
 * ほかの全部の色・切り抜きも消える（流入元の Instagram アイコンで実際に色が消えた）。
 * 写し取った画面にも同じ id が並んでいる（フォルダ画面 22個・AI画面 6個）。
 * そのSVGの中で使っている id だけを付け替える（ほかのSVGから使うスプライトの id は触らない）。
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { installDom } from './helpers/dom.ts'
import { uniquifySvgIds, withUniqueSvgIds } from '../src/app/svg-unique-ids.ts'

beforeAll(() => {
  installDom()
})

const ICON =
  '<svg viewBox="0 0 24 24"><defs><linearGradient id="g"><stop offset="0" stop-color="red"/></linearGradient>' +
  '<clipPath id="c"><rect width="24" height="24"/></clipPath></defs>' +
  '<g clip-path="url(#c)"><rect width="24" height="24" fill="url(#g)"/></g></svg>'

describe('画面に置いたアイコンの id を付け替える', () => {
  it('同じ id のアイコンが2つあっても、それぞれ自分の定義を指す', () => {
    const root = document.createElement('div')
    root.innerHTML = ICON + ICON
    uniquifySvgIds(root)
    const svgs = [...root.querySelectorAll('svg')]
    const ids = svgs.map((s) => [...s.querySelectorAll('[id]')].map((e) => e.id))
    expect(ids[0]).not.toEqual(ids[1])
    for (const svg of svgs) {
      const gradient = svg.querySelector('linearGradient')!.id
      const clip = svg.querySelector('clipPath')!.id
      expect(svg.querySelector('rect[fill]')?.getAttribute('fill')).toBe(`url(#${gradient})`)
      expect(svg.querySelector('g')?.getAttribute('clip-path')).toBe(`url(#${clip})`)
    }
  })

  it('ほかのSVGから使う id（中で使っていないスプライト）は触らない', () => {
    const root = document.createElement('div')
    root.innerHTML =
      '<svg style="display:none"><symbol id="icon-x"><path d="M0 0"/></symbol></svg>' +
      '<svg><use href="#icon-x"/></svg>'
    uniquifySvgIds(root)
    expect(root.querySelector('symbol')?.id).toBe('icon-x')
    expect(root.querySelector('use')?.getAttribute('href')).toBe('#icon-x')
  })

  it('何回かけても名前が伸び続けない', () => {
    const root = document.createElement('div')
    root.innerHTML = ICON
    uniquifySvgIds(root)
    uniquifySvgIds(root)
    expect(root.querySelector('linearGradient')!.id).toMatch(/^g--i\d+$/)
  })

  it('付け替え済みのアイコンをコピーしても、もう一度かければ別の名前になる（フォルダの行はコピーで増やす）', () => {
    const root = document.createElement('div')
    root.innerHTML = ICON
    uniquifySvgIds(root)
    const copy = root.firstElementChild!.cloneNode(true) as Element
    const holder = document.createElement('div')
    holder.append(copy)
    uniquifySvgIds(holder)
    expect(copy.querySelector('linearGradient')!.id).not.toBe(root.querySelector('linearGradient')!.id)
    expect(copy.querySelector('rect[fill]')?.getAttribute('fill')).toBe(`url(#${copy.querySelector('linearGradient')!.id})`)
  })

  it('文字列のまま付け替える（アイコンを文字列で作る所用）', () => {
    const a = withUniqueSvgIds(ICON)
    const b = withUniqueSvgIds(ICON)
    const gid = (s: string) => /<linearGradient id="([^"]+)"/.exec(s)?.[1]
    expect(gid(a)).not.toBe(gid(b))
    expect(a).toContain(`fill="url(#${gid(a)})"`)
  })
})

describe('写し取った画面を組み立てたとき', () => {
  it('レポート・ヒートマップの土台でも付け替わる', async () => {
    const { mountCapturedPage } = await import('../src/app/pages/report-dom.ts')
    const host = document.createElement('div')
    const root = mountCapturedPage(host, `<div>${ICON}${ICON}</div>`)
    const ids = [...root.querySelectorAll('linearGradient')].map((g) => g.id)
    expect(new Set(ids).size).toBe(2)
  })
})

describe('文字列で作るアイコンの決まり', () => {
  it('Widget編集の部品アイコンは、名前（id）を使う定義を持たない（同じアイコンが並んでも色が消えない）', async () => {
    const icons = await import('../src/app/panels/nocode/templates/option-icons.ts')
    const all = (Object.values(icons) as unknown[])
      .filter((v): v is Record<string, unknown> => typeof v === 'object' && v !== null)
      .flatMap((group) => Object.values(group))
      .filter((v): v is string => typeof v === 'string')
    expect(all.length).toBeGreaterThan(10)
    expect(all.filter((markup) => /\sid="/.test(markup))).toEqual([])
  })
})
