/**
 * 表示が遅い人の割合（2026-09-16・本人の依頼）。
 *
 * Versionごとに「読み込みに3秒以上かかった人が何％か」を出す。
 * FV通過率が低いときに、原因が中身なのか重さなのかを切り分けるための数字。
 *
 * 数え方で気をつけたこと:
 *  - **読み込みが終わる前に帰った人を捨てない**。遅くて帰った人ほど「終わった記録」を残さないので、
 *    終わった人だけで数えると遅さを小さく見積もる。3秒以上待って帰った人は「遅かった」に入れる
 *  - 3秒たたずに、読み込みが終わる前に帰った人は**遅かったか分からない**ので、割合の分母に入れない
 */
import { describe, expect, it } from 'vitest'
import {
  SLOW_MS,
  parseLoad,
  recordPageSpeed,
  speedSummary,
  type PageSpeedStat,
} from '../mock-server/store/page-speed.ts'

const KEY = { ab_test_uid: 'AB1', version_uid: 'V1', date: '2026-09-16' }

function record(stats: readonly PageSpeedStat[], ms: number, done: boolean): PageSpeedStat[] {
  return recordPageSpeed(stats, KEY, { ms, done })
}

describe('計測タグから届いた値を読む', () => {
  it('読み込み完了までの時間を受け取る', () => {
    expect(parseLoad({ ms: 2345, done: 1 })).toEqual({ ms: 2345, done: true })
    expect(parseLoad({ ms: 800, done: 0 })).toEqual({ ms: 800, done: false })
  })

  it('おかしな値は捨てる（送り口は誰でも叩けるので）', () => {
    expect(parseLoad(null)).toBeNull()
    expect(parseLoad({ ms: -1, done: 1 })).toBeNull()
    expect(parseLoad({ ms: Number.NaN, done: 1 })).toBeNull()
    expect(parseLoad({ ms: '2000', done: 1 })).toBeNull()
    expect(parseLoad({ ms: 2000, done: 'yes' })).toBeNull()
  })

  it('10分を超える値は捨てる（裏のタブで開きっぱなしだった、など。表示の遅さではない）', () => {
    expect(parseLoad({ ms: 10 * 60 * 1000 + 1, done: 0 })).toBeNull()
  })
})

describe('記録する', () => {
  it('同じページ・Version・日は1行に足し込む', () => {
    let stats = record([], 500, true)
    stats = record(stats, 4200, true)
    expect(stats).toHaveLength(1)
    expect(stats[0]?.loaded.reduce((a, b) => a + b, 0)).toBe(2)
  })

  it('元の配列は書き換えない', () => {
    const before = record([], 500, true)
    const snapshot = JSON.stringify(before)
    record(before, 4200, true)
    expect(JSON.stringify(before)).toBe(snapshot)
  })
})

describe('3秒以上かかった人の割合', () => {
  const range = { start: '2026-09-16', end: '2026-09-16' }

  it(`読み込みが${SLOW_MS / 1000}秒以上かかった人の割合`, () => {
    let stats: PageSpeedStat[] = []
    stats = record(stats, 900, true)
    stats = record(stats, 2999, true)
    stats = record(stats, 3000, true)
    stats = record(stats, 12000, true)
    expect(speedSummary(stats, { versionUids: ['V1'], ...range })).toEqual({ slow_share: 0.5, samples: 4 })
  })

  it('3秒以上待って、読み込みが終わる前に帰った人は「遅かった」に入れる', () => {
    let stats: PageSpeedStat[] = []
    stats = record(stats, 1000, true)
    stats = record(stats, 4000, false)
    expect(speedSummary(stats, { versionUids: ['V1'], ...range })).toEqual({ slow_share: 0.5, samples: 2 })
  })

  it('3秒たたずに、読み込みが終わる前に帰った人は分母に入れない（遅かったか分からない）', () => {
    let stats: PageSpeedStat[] = []
    stats = record(stats, 1000, true)
    stats = record(stats, 1500, false)
    expect(speedSummary(stats, { versionUids: ['V1'], ...range })).toEqual({ slow_share: 0, samples: 1 })
  })

  it('記録が無ければ割合は出さない（0%と言わない）', () => {
    expect(speedSummary([], { versionUids: ['V1'], ...range })).toEqual({ slow_share: null, samples: 0 })
  })

  it('ページ全体でも出せる（全Versionを足す）', () => {
    let stats = recordPageSpeed([], { ...KEY, version_uid: 'V1' }, { ms: 500, done: true })
    stats = recordPageSpeed(stats, { ...KEY, version_uid: 'V2' }, { ms: 5000, done: true })
    expect(speedSummary(stats, { abTestUid: 'AB1', ...range })).toEqual({ slow_share: 0.5, samples: 2 })
  })

  it('期間外は数えない', () => {
    const stats = recordPageSpeed([], { ...KEY, date: '2026-09-01' }, { ms: 5000, done: true })
    expect(speedSummary(stats, { versionUids: ['V1'], ...range }).samples).toBe(0)
  })
})
