/**
 * 右の「プロパティ」に出す「下線の見た目」（色・太さ・不透明度・2026-10-18 本人指定）。
 * 文字を選んで「書式」の U を押し、下線が付いているときだけ出す。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'

type Applied = Array<string | true>

async function setup(): Promise<{
  el: HTMLElement
  sync: (underline: unknown, textColor: string) => void
  applied: Applied
  input: (label: string) => HTMLInputElement
  colorHex: () => HTMLInputElement
  colorPicker: () => HTMLInputElement
}> {
  const { window } = parseHTML('<!doctype html><html><body></body></html>')
  const g = globalThis as unknown as Record<string, unknown>
  g['document'] = window.document
  g['Event'] = window.Event
  const { buildUnderlineLookGroup } = await import('../src/app/panels/properties-underline.ts')
  const applied: Applied = []
  const { el, sync } = buildUnderlineLookGroup((value) => applied.push(value))
  window.document.body.append(el)
  const rowOf = (label: string): HTMLElement => {
    const row = [...el.querySelectorAll<HTMLElement>('.sb-pr')].find(
      (r) => r.querySelector('.sb-pr-label')?.textContent === label,
    )
    if (row === undefined) throw new Error(`「${label}」の行がありません`)
    return row
  }
  return {
    el,
    sync,
    applied,
    input: (label) => rowOf(label).querySelector('input.sb-pr-input') as HTMLInputElement,
    colorHex: () => rowOf('色').querySelector('input.sb-pr-color-hex') as HTMLInputElement,
    colorPicker: () => rowOf('色').querySelector('input[type="color"]') as HTMLInputElement,
  }
}

/** 入力欄に打ち込んで確定する（`find` は欄を探す関数。引数の要素を書き換えない形にしている） */
const change = (find: () => HTMLInputElement, value: string, type = 'change'): void => {
  const field = find()
  field.value = value
  field.dispatchEvent(new Event(type))
}

describe('下線の見た目（色・太さ・不透明度）', () => {
  it('下線が付いていないときは出さない／付いたら出す', async () => {
    const { el, sync } = await setup()
    sync(undefined, '#000000')
    expect(el.style.display).toBe('none')
    sync(true, '#000000')
    expect(el.style.display).not.toBe('none')
  })

  it('色・太さ・不透明度の3つの行がある', async () => {
    const { el } = await setup()
    const labels = [...el.querySelectorAll('.sb-pr-label')].map((l) => l.textContent)
    expect(labels).toEqual(['色', '太さ', '不透明度'])
    expect(el.querySelector('.sb-pg-title')?.textContent).toBe('下線の見た目')
  })

  it('今の見た目を出す（色を変えていなければ文字の色・不透明度は100）', async () => {
    const { sync, input, colorHex } = await setup()
    sync(true, '#333333')
    expect(colorHex().value).toBe('#333333')
    expect(input('不透明度').value).toBe('100')
    expect(input('太さ').value).toBe('')
    sync('text-decoration-color: rgba(229, 87, 63, 0.4); text-decoration-thickness: 5px', '#333333')
    expect(colorHex().value).toBe('#E5573F')
    expect(input('不透明度').value).toBe('40')
    expect(input('太さ').value).toBe('5')
  })

  it('色を選ぶと、その色の下線にする', async () => {
    const { sync, applied, colorPicker } = await setup()
    sync(true, '#000000')
    change(colorPicker, '#e5573f', 'input')
    expect(applied.at(-1)).toBe('text-decoration-color: rgb(229, 87, 63)')
  })

  it('色を打ち込んでも変えられる（#と6けた以外は無視）', async () => {
    const { sync, applied, colorHex } = await setup()
    sync(true, '#000000')
    change(colorHex, 'あか')
    expect(applied).toEqual([])
    change(colorHex, '#1F7AE0')
    expect(applied.at(-1)).toBe('text-decoration-color: rgb(31, 122, 224)')
  })

  it('色を変えていないまま不透明度を下げると、文字の色を薄くした線になる', async () => {
    const { sync, applied, input } = await setup()
    sync(true, '#333333')
    change(() => input('不透明度'), '40')
    expect(applied.at(-1)).toBe('text-decoration-color: rgba(51, 51, 51, 0.4)')
  })

  it('太さを変えても、色と不透明度はそのまま', async () => {
    const { sync, applied, input } = await setup()
    sync('text-decoration-color: rgba(229, 87, 63, 0.4)', '#000000')
    change(() => input('太さ'), '6')
    expect(applied.at(-1)).toBe('text-decoration-color: rgba(229, 87, 63, 0.4); text-decoration-thickness: 6px')
  })

  it('太さを空にすると標準の太さに戻す', async () => {
    const { sync, applied, input } = await setup()
    sync('text-decoration-thickness: 6px', '#000000')
    change(() => input('太さ'), '')
    expect(applied.at(-1)).toBe(true)
  })

  it('数字でないものは無視する', async () => {
    const { sync, applied, input } = await setup()
    sync(true, '#000000')
    change(() => input('太さ'), 'abc')
    change(() => input('不透明度'), 'abc')
    expect(applied).toEqual([])
  })
})

describe('右の「プロパティ」への組み込み', () => {
  const panel = readFileSync('src/app/panels/properties-panel.ts', 'utf8')

  it('「書式」の下に出し、選んだ文字の下線へ当てる', () => {
    expect(panel).toContain("import { buildUnderlineLookGroup } from './properties-underline.ts'")
    expect(panel).toMatch(/buildUnderlineLookGroup\(\(value\) => applyInline\('underline', value\)\)/)
    expect(panel).toMatch(/fmtGroup,[^\n]*\n\s*underlineLook\.el,/)
    expect(panel).toMatch(/underlineLook\.sync\(fmt\['underline'\]/)
  })

  it('見た目つきの下線も U ボタンを「付いている」で出し、押すと外す（付け直して見た目を消さない）', () => {
    expect(panel).toContain("ulBtn.classList.toggle('active', isFormatOn(fmt['underline']))")
    expect(panel).toMatch(/applyInline\(name, isFormatOn\(getFormats\(\)\[name\]\) \? false : true\)/)
  })

  it('エディタを開く前に、見た目を持てる下線の部品を登録する', () => {
    const editor = readFileSync('src/app/pages/editor.ts', 'utf8')
    expect(editor).toContain('registerUnderlineBlot()')
    const blot = readFileSync('src/app/panels/underline-blot.ts', 'utf8')
    expect(blot).toContain("static blotName = 'underline'")
    expect(blot).toContain('applyUnderlineLook(node, value)')
    expect(blot).toContain('underlineValueOfElement(domNode)')
  })
})
