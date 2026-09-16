/**
 * 除いたボットの件数（2026-09-16・本人の依頼）。
 *
 * 「ボットは含めていません」と画面に出すだけだと、本当に除けているのか確かめようがない。
 * 期間内に除いた件数を添えて出すために、ページ×日ごとに数えておく。
 */
import { describe, expect, it } from 'vitest'
import { BOT_HIT_DAYS, botHitCount, recordBotHit } from '../mock-server/store/bot-hits.ts'

describe('除いたボットを数える', () => {
  it('同じページ・同じ日は1行に足し込む', () => {
    let hits = recordBotHit([], 'AB1', '2026-09-16')
    hits = recordBotHit(hits, 'AB1', '2026-09-16')
    hits = recordBotHit(hits, 'AB2', '2026-09-16')
    expect(hits).toEqual([
      { ab_test_uid: 'AB1', date: '2026-09-16', count: 2 },
      { ab_test_uid: 'AB2', date: '2026-09-16', count: 1 },
    ])
  })

  it('元の配列は書き換えない', () => {
    const before = [{ ab_test_uid: 'AB1', date: '2026-09-16', count: 1 }]
    recordBotHit(before, 'AB1', '2026-09-16')
    expect(before[0]?.count).toBe(1)
  })

  it(`${BOT_HIT_DAYS}日より古い行は捨てる（増え続けないように）`, () => {
    const old = { ab_test_uid: 'AB1', date: '2025-01-01', count: 5 }
    const hits = recordBotHit([old], 'AB1', '2026-09-16')
    expect(hits.find((h) => h.date === '2025-01-01')).toBeUndefined()
  })
})

describe('期間内の件数', () => {
  const hits = [
    { ab_test_uid: 'AB1', date: '2026-09-14', count: 3 },
    { ab_test_uid: 'AB1', date: '2026-09-15', count: 4 },
    { ab_test_uid: 'AB2', date: '2026-09-15', count: 10 },
    { ab_test_uid: 'AB1', date: '2026-09-16', count: 7 },
  ]

  it('ページを指定すればそのページだけ', () => {
    expect(botHitCount(hits, { abTestUids: ['AB1'], start: '2026-09-14', end: '2026-09-15' })).toBe(7)
  })

  it('ページを指定しなければ全ページ（ダッシュボード用）', () => {
    expect(botHitCount(hits, { start: '2026-09-15', end: '2026-09-15' })).toBe(14)
  })

  it('期間の両端を含む', () => {
    expect(botHitCount(hits, { abTestUids: ['AB1'], start: '2026-09-14', end: '2026-09-16' })).toBe(14)
  })
})
