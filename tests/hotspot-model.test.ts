/**
 * 部品「移行先」（押せる透明な範囲）の並びの決まり（2026-09-24・本人「ボタンやすでにあるウィジェットに被せて使う」）。
 *
 * 移行先は、並びの中で「すぐ上の部品（移行先でないもの）」に被さる。
 * 被せた部品を動かす・複製する・消すと、その下の移行先も一緒に付いていく（別の部品に被さり直さない）。
 */
import { describe, expect, it } from 'vitest'
import {
  coveredIndexOf,
  dropRect,
  duplicateGroup,
  groupEndOf,
  groupStep,
  hotspotRect,
  moveGroupBefore,
  removeGroup,
} from '../src/app/panels/nocode/hotspot-model.ts'
import type { ItemData } from '../src/app/panels/nocode/templates/types.ts'

const b = (name: string): ItemData => ({ type: 'button', label: name })
const h = (name: string): ItemData => ({ type: 'hotspot', name })
const names = (list: readonly ItemData[]): string[] => list.map((item) => String(item['label'] ?? item['name']))

// A（移行先 a1・a2 つき）、B、C（移行先 c1 つき）
const LIST: readonly ItemData[] = [b('A'), h('a1'), h('a2'), b('B'), b('C'), h('c1')]

describe('被さる先と、部品のまとまり', () => {
  it('移行先は、すぐ上の（移行先でない）部品に被さる', () => {
    expect(coveredIndexOf(LIST, 1)).toBe(0)
    expect(coveredIndexOf(LIST, 2)).toBe(0)
    expect(coveredIndexOf(LIST, 5)).toBe(4)
  })

  it('いちばん上の移行先は、被さる部品が無い', () => {
    expect(coveredIndexOf([h('x'), b('A')], 0)).toBeNull()
  })

  it('部品のまとまりは、その下に続く移行先まで', () => {
    expect(groupEndOf(LIST, 0)).toBe(3)
    expect(groupEndOf(LIST, 3)).toBe(4)
    expect(groupEndOf(LIST, 4)).toBe(6)
    // 移行先そのものは1つだけ
    expect(groupEndOf(LIST, 1)).toBe(2)
  })
})

describe('並べ替え（移行先も一緒に動く）', () => {
  it('部品をいちばん下へ動かすと、その移行先も付いていく', () => {
    const moved = moveGroupBefore(LIST, 0, LIST.length)
    expect(names(moved?.list ?? [])).toEqual(['B', 'C', 'c1', 'A', 'a1', 'a2'])
    expect(moved?.index).toBe(3)
  })

  it('ほかの部品と移行先の間には入らない（その部品のまとまりの後ろへ）', () => {
    // C と c1 の間（5）を指しても、c1 の後ろに入る
    const moved = moveGroupBefore(LIST, 3, 5)
    expect(names(moved?.list ?? [])).toEqual(['A', 'a1', 'a2', 'C', 'c1', 'B'])
  })

  it('移行先だけを動かすと、動かした先の上の部品に被さり直す', () => {
    const moved = moveGroupBefore(LIST, 5, 4)
    expect(names(moved?.list ?? [])).toEqual(['A', 'a1', 'a2', 'B', 'c1', 'C'])
    expect(moved?.index).toBe(4)
  })

  it('動かない場所なら null', () => {
    expect(moveGroupBefore(LIST, 0, 0)).toBeNull()
    expect(moveGroupBefore(LIST, 0, 3)).toBeNull()
  })

  it('上へ・下へは、となりの部品のまとまりを1つ越える', () => {
    expect(names(groupStep(LIST, 3, -1)?.list ?? [])).toEqual(['B', 'A', 'a1', 'a2', 'C', 'c1'])
    expect(names(groupStep(LIST, 0, 1)?.list ?? [])).toEqual(['B', 'A', 'a1', 'a2', 'C', 'c1'])
    expect(groupStep(LIST, 0, -1)).toBeNull()
    expect(groupStep(LIST, 4, 1)).toBeNull()
  })

  it('移行先の上へ・下へは、1つずつ', () => {
    expect(names(groupStep(LIST, 2, -1)?.list ?? [])).toEqual(['A', 'a2', 'a1', 'B', 'C', 'c1'])
    expect(names(groupStep(LIST, 2, 1)?.list ?? [])).toEqual(['A', 'a1', 'B', 'a2', 'C', 'c1'])
  })
})

describe('複製・消す（移行先も一緒）', () => {
  it('部品を複製すると、その移行先も複製して、まとまりのすぐ下に入れる', () => {
    const copied = duplicateGroup(LIST, 0, 30)
    expect(names(copied?.list ?? [])).toEqual(['A', 'a1', 'a2', 'A', 'a1', 'a2', 'B', 'C', 'c1'])
    expect(copied?.index).toBe(3)
  })

  it('入りきらないときは複製しない', () => {
    expect(duplicateGroup(LIST, 0, 8)).toBeNull()
  })

  it('部品を消すと、その移行先も消える', () => {
    expect(names(removeGroup(LIST, 0))).toEqual(['B', 'C', 'c1'])
    expect(names(removeGroup(LIST, 1))).toEqual(['A', 'a2', 'B', 'C', 'c1'])
  })
})

describe('押せる範囲の位置と大きさ（被せた部品に対する %）', () => {
  it('読めない値・はみ出す値は、部品の中に収める', () => {
    expect(hotspotRect({ type: 'hotspot' })).toEqual({ x: 0, y: 0, w: 100, h: 100 })
    expect(hotspotRect({ type: 'hotspot', x: 90, y: -5, w: 30, h: 250 })).toEqual({ x: 70, y: 0, w: 30, h: 100 })
    expect(hotspotRect({ type: 'hotspot', x: 10.26, y: 20, w: 1, h: 40 })).toEqual({ x: 10.5, y: 20, w: 5, h: 40 })
  })

  it('低い部品（ボタン・見出し）に落としたら、部品まるごと', () => {
    expect(dropRect({ left: 0, top: 0, width: 500, height: 56 }, { x: 100, y: 20 })).toEqual({ x: 0, y: 0, w: 100, h: 100 })
  })

  it('高い部品（画像・見本）に落としたら、落とした所に小さめの範囲', () => {
    const rect = dropRect({ left: 100, top: 200, width: 500, height: 800 }, { x: 350, y: 600 })
    expect(rect).toEqual({ x: 30, y: 46, w: 40, h: 8 })
  })

  it('端に落としても、部品の中に収まる', () => {
    const rect = dropRect({ left: 0, top: 0, width: 500, height: 800 }, { x: 495, y: 5 })
    expect(rect.x + rect.w).toBe(100)
    expect(rect.y).toBe(0)
  })
})

describe('部品を別の画面へ移すと、被せた移行先も一緒に移る', () => {
  it('画面①のAを画面②へ移すと、a1・a2も画面②のいちばん下へ', async () => {
    const { moveBlockToScreen } = await import('../src/app/panels/nocode/screens-state.ts')
    const data = {
      screens: [
        { id: 's1', name: '画面①', blocks: [...LIST] },
        { id: 's2', name: '画面②', blocks: [b('X')] },
      ],
    }
    const moved = moveBlockToScreen(data, 'screens', 0, 0, 1, 30)
    const screens = moved['screens'] as unknown as { blocks: ItemData[] }[]
    expect(names(screens[0]?.blocks ?? [])).toEqual(['B', 'C', 'c1'])
    expect(names(screens[1]?.blocks ?? [])).toEqual(['X', 'A', 'a1', 'a2'])
  })

  it('入りきらないときは移さない', async () => {
    const { moveBlockToScreen } = await import('../src/app/panels/nocode/screens-state.ts')
    const data = { screens: [{ id: 's1', blocks: [...LIST] }, { id: 's2', blocks: [b('X')] }] }
    expect(moveBlockToScreen(data, 'screens', 0, 0, 1, 3)).toBe(data)
  })
})
