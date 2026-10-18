/**
 * 右の「プロパティ」の「マーカー」（2026-10-18 本人「下線だけではなくマーカー機能もほしい」）。
 * 「書式」に マーカーのボタンを足し、引いてある文字を選んだときだけ「マーカーの見た目」（色・太さ・不透明度）を出す。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'

async function setup(): Promise<{
  el: HTMLElement
  sync: (marker: unknown) => void
  applied: string[]
  field: (label: string) => () => HTMLInputElement
  hex: () => HTMLInputElement
  picker: () => HTMLInputElement
}> {
  const { window } = parseHTML('<!doctype html><html><body></body></html>')
  const g = globalThis as unknown as Record<string, unknown>
  g['document'] = window.document
  g['Event'] = window.Event
  const { buildMarkerLookGroup } = await import('../src/app/panels/properties-marker.ts')
  const applied: string[] = []
  const { el, sync } = buildMarkerLookGroup((value) => applied.push(value))
  window.document.body.append(el)
  const rowOf = (label: string): HTMLElement => {
    const row = [...el.querySelectorAll<HTMLElement>('.sb-pr')].find((r) => r.querySelector('.sb-pr-label')?.textContent === label)
    if (row === undefined) throw new Error(`「${label}」の行がありません`)
    return row
  }
  return {
    el,
    sync,
    applied,
    field: (label) => () => rowOf(label).querySelector('input.sb-pr-input') as HTMLInputElement,
    hex: () => rowOf('色').querySelector('input.sb-pr-color-hex') as HTMLInputElement,
    picker: () => rowOf('色').querySelector('input[type="color"]') as HTMLInputElement,
  }
}

/** 入力欄に打ち込んで確定する（`find` は欄を探す関数。引数の要素を書き換えない形にしている） */
const change = (find: () => HTMLInputElement, value: string, type = 'change'): void => {
  const input = find()
  input.value = value
  input.dispatchEvent(new Event(type))
}

describe('マーカーの見た目（色・太さ・不透明度）', () => {
  it('マーカーを引いていないときは出さない／引いたら出す', async () => {
    const { el, sync } = await setup()
    sync(undefined)
    expect(el.style.display).toBe('none')
    sync('#ffe45c,40,100')
    expect(el.style.display).not.toBe('none')
  })

  it('見出しと3つの行', async () => {
    const { el } = await setup()
    expect(el.querySelector('.sb-pg-title')?.textContent).toBe('マーカーの見た目')
    expect([...el.querySelectorAll('.sb-pr-label')].map((l) => l.textContent)).toEqual(['色', '太さ', '不透明度'])
  })

  it('今の見た目を出す', async () => {
    const { sync, field, hex } = await setup()
    sync('#ffb3c7,60,50')
    expect(hex().value).toBe('#FFB3C7')
    expect(field('太さ')().value).toBe('60')
    expect(field('不透明度')().value).toBe('50')
  })

  it('色・太さ・不透明度を変えると、ほかはそのままで当てる', async () => {
    const { sync, applied, field, picker, hex } = await setup()
    sync('#ffe45c,40,100')
    change(picker, '#a8dbff', 'input')
    expect(applied.at(-1)).toBe('#a8dbff,40,100')
    change(field('太さ'), '70')
    expect(applied.at(-1)).toBe('#a8dbff,70,100')
    change(field('不透明度'), '60')
    expect(applied.at(-1)).toBe('#a8dbff,70,60')
    change(hex, '#B8F0C2')
    expect(applied.at(-1)).toBe('#b8f0c2,70,60')
  })

  it('数字でないもの・形の違う色は無視する', async () => {
    const { sync, applied, field, hex } = await setup()
    sync('#ffe45c,40,100')
    change(field('太さ'), 'abc')
    change(field('不透明度'), '')
    change(hex, 'きいろ')
    expect(applied).toEqual([])
  })
})

describe('右の「プロパティ」への組み込み', () => {
  const panel = readFileSync('src/app/panels/properties-panel.ts', 'utf8')

  it('「書式」に マーカーのボタン。押すと引く／引いてあれば外す', () => {
    expect(panel).toContain("fmtBtn(SVG.marker, 'マーカー')")
    expect(panel).toMatch(/applyInline\('marker', isFormatOn\(getFormats\(\)\['marker'\]\) \? false : encodeMarker\(DEFAULT_MARKER_LOOK\)\)/)
    expect(panel).toMatch(/fmtBtns\.append\(boldBtn, italicBtn, ulBtn, markerBtn, /)
    expect(panel).toContain("markerBtn.classList.toggle('active', isFormatOn(fmt['marker']))")
  })

  it('下線の見た目の下に「マーカーの見た目」を出す', () => {
    expect(panel).toMatch(/buildMarkerLookGroup\(\(value\) => applyInline\('marker', value\)\)/)
    expect(panel).toMatch(/underlineLook\.el,\s*\n\s*markerLook\.el,/)
    expect(panel).toContain("markerLook.sync(fmt['marker'])")
  })

  it('エディタを開く前に、マーカーの部品を登録する', () => {
    const editor = readFileSync('src/app/pages/editor.ts', 'utf8')
    expect(editor).toContain('registerMarkerBlot()')
    const blot = readFileSync('src/app/panels/marker-blot.ts', 'utf8')
    expect(blot).toContain("static blotName = 'marker'")
    expect(blot).toContain("static className = 'sb-marker'")
    expect(blot).toContain('applyMarkerLook(node, value)')
    expect(blot).toContain('markerValueOfElement(domNode)')
  })
})
