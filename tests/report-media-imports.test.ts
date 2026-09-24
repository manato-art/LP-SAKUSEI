/**
 * 「広告データ取得日時」（2026-09-24 点検19）。
 * 採取物の「データなし」が焼き付いたままで、取り込んでも変わらなかった。最後に取り込んだ時刻を出す。
 */
import { describe, expect, it } from 'vitest'
import { mediaImportLines } from '../src/app/pages/report-media-imports.ts'

// 2026-09-24 10:15 JST
const AT = Date.parse('2026-09-24T01:15:00Z')

describe('広告データ取得日時の中身', () => {
  it('まだ取り込んでいなければ何も出さない（採取物の「データなし」のまま）', () => {
    expect(mediaImportLines([])).toEqual([])
  })

  it('最後に取り込めた時刻と日数を出す（日本時間）', () => {
    expect(
      mediaImportLines([
        { source: 'meta', last_attempt_at: AT, last_success_at: AT, last_error: null, last_days: 2, trigger: 'auto' },
        { source: 'csv', last_attempt_at: AT, last_success_at: AT, last_error: null, last_days: 3, trigger: 'manual' },
      ]),
    ).toEqual(['CSV：2026/09/24 10:15 に3日分を取り込み', 'Meta：2026/09/24 10:15 に2日分を取り込み（自動）'])
  })

  it('最後の取り込みが失敗していたら、理由と前に取り込めた時刻を出す', () => {
    const before = AT - 3600_000
    expect(
      mediaImportLines([
        { source: 'meta', last_attempt_at: AT, last_success_at: before, last_error: 'Meta API 500', last_days: 2, trigger: 'auto' },
      ]),
    ).toEqual([
      'Meta：2026/09/24 10:15 の取り込み（自動）に失敗しました（Meta API 500）。前回取り込めたのは 2026/09/24 09:15',
    ])
  })

  it('一度も取り込めていなければそう書く', () => {
    expect(
      mediaImportLines([
        { source: 'meta', last_attempt_at: AT, last_success_at: null, last_error: 'META_ACCESS_TOKEN が未設定です', last_days: 0, trigger: 'auto' },
      ]),
    ).toEqual(['Meta：2026/09/24 10:15 の取り込み（自動）に失敗しました（META_ACCESS_TOKEN が未設定です）。まだ一度も取り込めていません'])
  })
})
