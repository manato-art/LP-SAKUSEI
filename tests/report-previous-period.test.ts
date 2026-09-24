/**
 * KPI の前期間比（2026-09-24 点検19）。
 *
 *  - 上の絞り込み（Version・アーカイブ・端末）を前期間にも付ける（以前は付けず、絞った今と絞らない前を比べていた）
 *  - 期間に今日（まだ途中）が入るときは、そうと書く。表示・クリックは時刻を記録していないので
 *    「同じ時刻まで」で比べられない → 前期間はまる何日分かを書く
 */
import { describe, expect, it } from 'vitest'
import { comparisonNote, previousQuery } from '../src/app/pages/report-v2.ts'

// 2026-09-24 15:00 JST
const NOW = new Date('2026-09-24T06:00:00Z')

describe('前期間の問い合わせ', () => {
  it('上の絞り込みも付けて前期間を問い合わせる', () => {
    expect(
      previousQuery({ startDate: '2026-09-24', endDate: '2026-09-24' }, { version: 'V1', archive: 'all', device: 'sp' }),
    ).toBe('start_date=2026-09-23&end_date=2026-09-23&version=V1&archive=all&device=sp')
  })

  it('既定の絞り込みなら期間だけ', () => {
    expect(
      previousQuery({ startDate: '2026-09-24', endDate: '2026-09-24' }, { version: '', archive: 'except_archived', device: '0' }),
    ).toBe('start_date=2026-09-23&end_date=2026-09-23')
  })
})

describe('今日が入る期間の断り', () => {
  it('今日だけなら「昨日（1日分）と比較」と書く', () => {
    expect(comparisonNote({ startDate: '2026-09-24', endDate: '2026-09-24' }, NOW)).toBe(
      '今日はまだ途中です。増減は昨日（まる1日分）と比べています。',
    )
  })

  it('今日を含む何日かなら、前期間はまる何日分かを書く', () => {
    expect(comparisonNote({ startDate: '2026-09-18', endDate: '2026-09-24' }, NOW)).toBe(
      '期間に今日（まだ途中）が入っています。増減は 9/11〜9/17 のまる7日分と比べています。',
    )
  })

  it('今日が入らない期間では何も書かない', () => {
    expect(comparisonNote({ startDate: '2026-09-17', endDate: '2026-09-23' }, NOW)).toBeNull()
  })
})
