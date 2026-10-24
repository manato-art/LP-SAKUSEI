/**
 * 見本の中で選んだ要素の「背景の画像」の欄（2026-10-24・sample-bg-field.ts）。
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'
import type { ItemData } from '../src/app/panels/nocode/templates/types.ts'

const { document, window } = parseHTML('<!doctype html><html><body><div id="c"><div class="card" data-nc-bg="b1">カード</div><div class="card2">2</div><img id="i"></div></body></html>')

beforeAll(() => {
  const g = globalThis as unknown as Record<string, unknown>
  g['document'] = document
  g['window'] = window
  g['HTMLElement'] = window.HTMLElement
})

const IMG = `data:image/png;base64,${'A'.repeat(40)}`

async function mount(bgs: readonly ItemData[]): Promise<{ section: { element: HTMLElement; select: (el: HTMLElement | null) => void }; moves: number[] }> {
  const { sampleBgSection } = await import('../src/app/panels/nocode/sample-bg-field.ts')
  const moves: number[] = []
  const section = sampleBgSection({
    readBgs: () => bgs,
    writeBgs: () => undefined,
    readHtml: () => '',
    mark: () => undefined,
    data: () => ({}),
    onRefresh: () => undefined,
    bgMove: (index) => moves.push(index),
  })
  return { section, moves }
}

const labels = (el: HTMLElement): string[] =>
  [...el.querySelectorAll('.ncf-field')].filter((f) => !(f as unknown as HTMLElement).hidden).map((f) => f.querySelector('.ncf-label')?.textContent ?? '')

describe('見本の中で選んだ要素の背景の画像', () => {
  it('選ぶまでは隠れている。印の付いた要素を選ぶと、その設定（合わせ方・位置）と「画面でつかんで動かす」', async () => {
    const { section, moves } = await mount([{ id: 'b1', bgImage: IMG }])
    expect(section.element.hidden).toBe(true)
    section.select(document.querySelector('.card') as unknown as HTMLElement)
    expect(section.element.hidden).toBe(false)
    expect(labels(section.element)).toEqual(['この要素の背景の画像', '合わせ方', '左右の位置', '上下の位置'])
    const move = section.element.querySelector('.ncf-bg-move') as unknown as HTMLElement
    expect(move.hidden).toBe(false)
    move.dispatchEvent(new window.Event('click') as unknown as Event)
    expect(moves).toEqual([0])
  })

  it('まだ印の無い要素は、画像を選ぶ欄だけ', async () => {
    const { section } = await mount([{ id: 'b1', bgImage: IMG }])
    section.select(document.querySelector('.card2') as unknown as HTMLElement)
    expect(labels(section.element)).toEqual(['この要素の背景の画像'])
    expect((section.element.querySelector('.ncf-bg-move') as unknown as HTMLElement).hidden).toBe(true)
  })

  it('画像・動画そのものには敷けない（まわりの箱を選ぶよう知らせる）。選ぶのをやめたら隠す', async () => {
    const { section } = await mount([])
    section.select(document.getElementById('i') as unknown as HTMLElement)
    expect(section.element.textContent).toContain('まわりの箱を選んでください')
    section.select(null)
    expect(section.element.hidden).toBe(true)
  })
})
