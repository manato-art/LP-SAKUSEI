/**
 * 配信割合はいつも合計100%（2026-09-24・本人「合計で100%にして」）。
 * 1つを変えたら、残りは今の比のまま分け直す（本人の選択）。
 */
import { describe, expect, it } from 'vitest'
import { balanceAfterChange, normalizeTo100 } from '../mock-server/store/ratio-balance.ts'

const r = (uid: string, ratio: number) => ({ uid, ratio })
const asObject = (m: ReadonlyMap<string, number>) => Object.fromEntries(m)

describe('1つを変えたとき', () => {
  it('2つなら、もう片方が 100−その値', () => {
    expect(asObject(balanceAfterChange([r('A', 50), r('B', 50)], 'A', 49))).toEqual({ A: 49, B: 51 })
  })

  it('3つ以上なら、残りを今の比のまま分け直す（A50・B30・C20 で A を70 → B18・C12）', () => {
    expect(asObject(balanceAfterChange([r('A', 50), r('B', 30), r('C', 20)], 'A', 70))).toEqual({ A: 70, B: 18, C: 12 })
  })

  it('残りがみんな0%なら、残りで均等に分ける（端数は上から）', () => {
    expect(asObject(balanceAfterChange([r('A', 100), r('B', 0), r('C', 0)], 'A', 55))).toEqual({ A: 55, B: 23, C: 22 })
  })

  it('100%にしたら、残りは0%', () => {
    expect(asObject(balanceAfterChange([r('A', 20), r('B', 30), r('C', 50)], 'C', 100))).toEqual({ A: 0, B: 0, C: 100 })
  })

  it('端数が出ても合計はちょうど100', () => {
    const out = balanceAfterChange([r('A', 10), r('B', 33), r('C', 33), r('D', 34)], 'A', 1)
    expect([...out.values()].reduce((a, b) => a + b, 0)).toBe(100)
  })

  it('Versionが1つなら、何を入れても100%', () => {
    expect(asObject(balanceAfterChange([r('A', 100)], 'A', 40))).toEqual({ A: 100 })
  })
})

describe('合計を100%にそろえる（アーカイブ・削除のあと・今までのデータ）', () => {
  it('今の比のまま100%に広げる', () => {
    expect(asObject(normalizeTo100([r('A', 50), r('B', 25)]))).toEqual({ A: 67, B: 33 })
    expect(asObject(normalizeTo100([r('A', 99)]))).toEqual({ A: 100 })
  })

  it('50・50・50 は 34・33・33（配信は今も合計で割っているので、実際の出方はほぼ同じ）', () => {
    expect(asObject(normalizeTo100([r('A', 50), r('B', 50), r('C', 50)]))).toEqual({ A: 34, B: 33, C: 33 })
  })

  it('全部0%のときは作らない（どれを出すか決められないので、そのまま）', () => {
    expect(asObject(normalizeTo100([r('A', 0), r('B', 0)]))).toEqual({ A: 0, B: 0 })
  })

  it('もう100%ならそのまま', () => {
    expect(asObject(normalizeTo100([r('A', 70), r('B', 30)]))).toEqual({ A: 70, B: 30 })
  })
})

describe('今までのデータ（起動時に1回・本人「100%に直す」）', () => {
  it('合計が100%でないステップだけ直し、何度やっても同じ', async () => {
    const { normalizeAllSteps } = await import('../mock-server/store/ratio-balance.ts')
    const state = {
      articles: [{ id: 1 }, { id: 2 }, { id: 3 }],
      versions: [
        { uid: 'A', article_id: 1, archived: false, distribution_ratio: 99 },
        { uid: 'B', article_id: 2, archived: false, distribution_ratio: 70 },
        { uid: 'C', article_id: 2, archived: false, distribution_ratio: 30 },
        { uid: 'D', article_id: 3, archived: false, distribution_ratio: 50 },
        { uid: 'E', article_id: 3, archived: true, distribution_ratio: 0 },
      ],
    } as never
    const once = normalizeAllSteps(state)
    expect(once.changed.map((v) => `${v.uid}:${String(v.distribution_ratio)}`)).toEqual(['A:100', 'D:100'])
    const twice = normalizeAllSteps(once.state)
    expect(twice.changed).toEqual([])
  })
})
