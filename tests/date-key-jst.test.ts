import { describe, it, expect } from 'vitest'
import { toDateKey } from '../mock-server/store/metrics.ts'
import { jstNow } from '../mock-server/lib/jst.ts'

/**
 * 日付の切り替わりはJSTで判定する。
 *
 * 本番(Railway)のTZはUTCなので、サーバーが `Date` のローカル getter で日付を作ると
 * 日本の朝（00:00〜09:00 JST）が前日に記録される。
 * 画面はブラウザのローカル時刻＝JSTで「今日」を問い合わせるため、
 * 朝のアクセスがレポートから消えて前日に混ざる。
 */
describe('メトリクスの日付キー', () => {
  it('日本の朝8時のアクセスは、その日（JST）として記録する', () => {
    // 2026-09-09 08:00 JST = 2026-09-08 23:00 UTC
    const morningInJapan = new Date('2026-09-08T23:00:00Z')
    expect(toDateKey(morningInJapan)).toBe('2026-09-09')
  })

  it('日本の深夜0時直後も、その日（JST）として記録する', () => {
    // 2026-09-09 00:30 JST = 2026-09-08 15:30 UTC
    const justAfterMidnight = new Date('2026-09-08T15:30:00Z')
    expect(toDateKey(justAfterMidnight)).toBe('2026-09-09')
  })

  it('日本の23時台は、まだその日（JST）', () => {
    // 2026-09-09 23:30 JST = 2026-09-09 14:30 UTC
    const lateNight = new Date('2026-09-09T14:30:00Z')
    expect(toDateKey(lateNight)).toBe('2026-09-09')
  })

  it('画面が「今日」として問い合わせる日付と必ず一致する', () => {
    // 1日ぶんを1時間ずつ見て、どの時刻でもズレないことを確かめる
    for (let h = 0; h < 24; h++) {
      const t = new Date(Date.UTC(2026, 8, 9, h, 0, 0))
      expect(toDateKey(t)).toBe(jstNow(t).date)
    }
  })
})

/**
 * 画面側も同じ基準にする。
 *
 * ブラウザのローカル時刻で「今日」を決めると、日本の外から見たときに
 * サーバーの記録（JST）とズレて、レポートが空になったり前日の数字が出たりする。
 */
describe('画面側の日付キー', () => {
  it('サーバー側と同じ日付になる（ブラウザのTZに左右されない）', async () => {
    const client = await import('../src/app/pages/report-period.ts')
    for (let h = 0; h < 24; h++) {
      const t = new Date(Date.UTC(2026, 8, 9, h, 0, 0))
      expect(client.toDateKey(t)).toBe(toDateKey(t))
    }
  })
})

describe('期間プリセット', () => {
  it('夏時間の切り替え日をまたいでも「昨日」が1日ずれない', async () => {
    const { resolvePreset } = await import('../src/app/pages/report-period.ts')
    // 2026-11-01 はアメリカの夏時間終了日（その日は25時間になる）
    const t = new Date('2026-11-01T12:00:00Z') // JST では 11/1 21:00
    const range = resolvePreset('yesterday', t)
    expect(range).toEqual({ startDate: '2026-10-31', endDate: '2026-10-31' })
  })
})

/**
 * 版の履歴に出す日時。実機は日本時間で表示している。
 * サーバーのTZ（本番はUTC）で出すと9時間ずれた時刻が並ぶ。
 */
describe('履歴の日時表示', () => {
  it('日本時間で表示する（サーバーのTZに左右されない）', async () => {
    const { formatHistoryTimestamp } = await import('../mock-server/store/article-history.ts')
    // 2026-08-31 19:41:39 JST = 2026-08-31 10:41:39 UTC
    const unix = Math.floor(Date.UTC(2026, 7, 31, 10, 41, 39) / 1000)
    expect(formatHistoryTimestamp(unix)).toBe('2026-8-31 19:41:39')
  })
})
