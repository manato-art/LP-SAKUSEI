/**
 * 「いちばん離脱が多い位置」（2026-09-15・本人の依頼でレポートに載せる）。
 *
 * ヒートマップは画面で見るものだが、1日1回の通知では絵を送れない。
 * 「何％あたりで読むのをやめているか」を1行で言えるようにする。
 *
 * バンドの数は計測タグ側で決まる（今は100分割）ので、
 * **何分割で来ても同じ意味になるよう5%刻みに揃えてから**数える。
 */
import { describe, expect, it } from 'vitest'
import { exitPeak } from '../mock-server/store/scroll-counts.ts'
import { createEmptyState } from '../mock-server/store/seed-empty.ts'
import type { HeatmapStat, State } from '../mock-server/store/types.ts'

function stat(patch: Partial<HeatmapStat> & { exit: number[] }): HeatmapStat {
  const bands = patch.bands ?? patch.exit.length
  return {
    ab_test_uid: 'AB1',
    version_uid: 'V1',
    date: '2026-09-15',
    bands,
    pv: 100,
    reach: new Array<number>(bands).fill(100),
    dwell_ms: new Array<number>(bands).fill(0),
    dwell_n: new Array<number>(bands).fill(0),
    clicks: [],
    ...patch,
  }
}

function withStats(stats: readonly HeatmapStat[]): State {
  return { ...createEmptyState(), heatmapStats: stats }
}

const RANGE = ['2026-09-15', '2026-09-15'] as const

describe('いちばん離脱が多い位置', () => {
  it('離脱がいちばん多い深さと、その割合を返す', () => {
    // 20分割。10番目（50%〜55%）だけ離脱が多い
    const exit = new Array<number>(20).fill(1)
    exit[10] = 40
    const state = withStats([stat({ exit, pv: 100 })])

    const peak = exitPeak(state, 'AB1', ...RANGE)
    expect(peak).toEqual({ depth_percent: 50, rate: 0.4 })
  })

  it('分割数が違っても同じ深さを指す（5%刻みに揃える）', () => {
    const coarse = new Array<number>(20).fill(0)
    coarse[10] = 30 // 50%
    const fine = new Array<number>(100).fill(0)
    fine[50] = 30 // 同じく50%
    fine[51] = 0

    const a = exitPeak(withStats([stat({ exit: coarse, pv: 100 })]), 'AB1', ...RANGE)
    const b = exitPeak(withStats([stat({ exit: fine, pv: 100 })]), 'AB1', ...RANGE)
    expect(a?.depth_percent).toBe(b?.depth_percent)
  })

  it('同じページの複数Versionを足して見る', () => {
    const a = new Array<number>(20).fill(0)
    a[4] = 10
    const b = new Array<number>(20).fill(0)
    b[4] = 30
    const state = withStats([
      stat({ version_uid: 'V1', exit: a, pv: 50 }),
      stat({ version_uid: 'V2', exit: b, pv: 50 }),
    ])

    const peak = exitPeak(state, 'AB1', ...RANGE)
    expect(peak).toEqual({ depth_percent: 20, rate: 0.4 })
  })

  it('広告パラメータごとの行は数えない（合算と二重に持っているため）', () => {
    const exit = new Array<number>(20).fill(0)
    exit[2] = 10
    const state = withStats([
      stat({ exit, pv: 100, param: '' }),
      stat({ exit, pv: 100, param: 'utm_source=fb' }),
    ])

    const peak = exitPeak(state, 'AB1', ...RANGE)
    expect(peak?.rate, '二重に数えたら0.2になってしまう').toBeCloseTo(0.1, 5)
  })

  it('期間外の記録は見ない', () => {
    const exit = new Array<number>(20).fill(0)
    exit[2] = 10
    const state = withStats([stat({ exit, date: '2026-09-01' })])
    expect(exitPeak(state, 'AB1', ...RANGE)).toBeNull()
  })

  it('記録がなければ null（0%と言わない）', () => {
    expect(exitPeak(createEmptyState(), 'AB1', ...RANGE)).toBeNull()
  })

  it('離脱が1件も無ければ null', () => {
    const state = withStats([stat({ exit: new Array<number>(20).fill(0), pv: 100 })])
    expect(exitPeak(state, 'AB1', ...RANGE)).toBeNull()
  })
})
