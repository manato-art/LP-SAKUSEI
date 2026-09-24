/**
 * 「過去N日」の数え方を1つにそろえる（2026-09-24 点検35）。
 *
 * ダッシュボードの「過去7日」が today-7〜today＝8日分になっていて、
 * レポートの「過去7日間」（today-6〜today＝7日分）と数字が合わなかった。
 * どちらも同じ関数で「今日を含むN日」を出す。
 */
import { describe, expect, it } from 'vitest'
import { lastDaysRange, resolvePreset } from '../src/app/pages/report-period.ts'
import { dashboardRange } from '../src/app/pages/dashboard-page.ts'

// 2026-09-24 12:00 JST
const now = new Date('2026-09-24T03:00:00Z')

describe('過去N日（今日を含むN日）', () => {
  it('過去7日は今日を含む7日分', () => {
    expect(lastDaysRange(7, now)).toEqual({ startDate: '2026-09-18', endDate: '2026-09-24' })
  })

  it('ダッシュボードの「過去7日」はレポートの「過去7日間」と同じ期間', () => {
    expect(dashboardRange(7, now)).toEqual(resolvePreset('last_seven_days', now))
  })

  it('ダッシュボードの「過去30日」も今日を含む30日分', () => {
    expect(dashboardRange(30, now)).toEqual({ startDate: '2026-08-26', endDate: '2026-09-24' })
  })
})
