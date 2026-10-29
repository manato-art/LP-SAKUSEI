/**
 * 数字の記録を1件ずつしまうときの「変わった記録・消えた記録だけ」の見つけ方（2026-10-29・store/measure-rows.ts）。
 */
import { describe, expect, it } from 'vitest'
import { diffMeasurements, MEASURE_KEYS, withoutMeasurements } from '../mock-server/store/measure-rows.ts'
import { createEmptyState } from '../mock-server/store/seed-empty.ts'
import type { DailyMetric, State } from '../mock-server/store/types.ts'

const metric = (uid: string, pv: number, date = '2026-10-29'): DailyMetric => ({
  entity_uid: uid, scope: 'ab_test', date, pv, click: 0, cv: 0, ad_cost: 0, sales: 0,
})
const base = (over: Partial<State> = {}): State => ({ ...createEmptyState(), ...over })

describe('変わった記録・消えた記録だけを書く', () => {
  it('はじめて書くときは全部を足す', () => {
    const state = base({ metrics: [metric('A', 1), metric('B', 2)] })
    const changes = diffMeasurements(null, state)
    expect(changes.find((c) => c.collection === 'metrics')?.upserts.map((u) => u.key)).toEqual([
      'ab_test|A|2026-10-29',
      'ab_test|B|2026-10-29',
    ])
  })

  it('1件だけ数が増えたら、その1件だけを書く（ほかの記録は書かない）', () => {
    const a = metric('A', 1)
    const b = metric('B', 2)
    const prev = base({ metrics: [a, b] })
    const next = { ...prev, metrics: [a, { ...b, pv: 3 }] }
    expect(diffMeasurements(prev, next)).toEqual([
      { collection: 'metrics', upserts: [{ key: 'ab_test|B|2026-10-29', row: { ...b, pv: 3 } }], deletes: [] },
    ])
  })

  it('消えた記録は目印を返す・何も変わっていなければ何も返さない', () => {
    const a = metric('A', 1)
    const b = metric('B', 2)
    const prev = base({ metrics: [a, b] })
    expect(diffMeasurements(prev, { ...prev, metrics: [a] })).toEqual([
      { collection: 'metrics', upserts: [], deletes: ['ab_test|B|2026-10-29'] },
    ])
    expect(diffMeasurements(prev, { ...prev })).toEqual([])
  })

  it('ヒートマップは分割数も目印に入れる（同じ日に20分割と100分割の2行がある）', () => {
    const row = (bands: number) => ({ ab_test_uid: 'P', version_uid: 'V', date: '2026-09-08', bands, pv: 1, reach: [], exit: [], dwell_ms: [], dwell_n: [], clicks: [] })
    const state = base({ heatmapStats: [row(20), row(100)] as unknown as State['heatmapStats'] })
    const keys = diffMeasurements(null, state).find((c) => c.collection === 'heatmapStats')?.upserts.map((u) => u.key)
    expect(new Set(keys).size).toBe(2)
  })

  it('アクセスの記録は「日付|その日の何件目か」。古い日を削ると、その日の残りだけ目印が付け直される', () => {
    const log = (date: string, ip: string) => ({ team_id: 1, date, ip, referer: '', params: [], excluded: false, exclude_token: '' })
    const a1 = log('2026-10-01', '1')
    const a2 = log('2026-10-01', '2')
    const b1 = log('2026-10-02', '3')
    const prev = base({ requestLogs: [a1, a2, b1] })
    expect(diffMeasurements(null, prev).find((c) => c.collection === 'requestLogs')?.upserts.map((u) => u.key)).toEqual([
      '2026-10-01|0',
      '2026-10-01|1',
      '2026-10-02|0',
    ])
    // いちばん古い1件を削った（上限で前から削る）
    const change = diffMeasurements(prev, { ...prev, requestLogs: [a2, b1] }).find((c) => c.collection === 'requestLogs')
    expect(change?.upserts.map((u) => u.key)).toEqual(['2026-10-01|0'])
    expect(change?.upserts[0]?.row).toBe(a2)
    expect(change?.deletes).toEqual(['2026-10-01|1'])
  })

  it('申し込み（新しい順に前へ足す）は、入れる順を後ろからにする（読むときに逆に並べて元の順に戻る）', () => {
    const cv = (uid: string) => ({ id: 1, uid, ab_test_uid: 'P', version_uid: 'V', media_id: null, amount: 0, occurred_at: 0, status: 'approved' })
    const state = base({ conversions: [cv('NEW'), cv('OLD')] as unknown as State['conversions'] })
    expect(diffMeasurements(null, state).find((c) => c.collection === 'conversions')?.upserts.map((u) => u.key)).toEqual(['OLD', 'NEW'])
  })
})

describe('データベースが正になったあとの state.json', () => {
  it('数字の記録を抜いて書く（ページや設定はそのまま）', () => {
    const state = base({ metrics: [metric('A', 1)] })
    const json = withoutMeasurements(state)
    for (const key of MEASURE_KEYS) expect(json).not.toHaveProperty(key)
    expect(json).toHaveProperty('abTests')
    expect(json).toHaveProperty('folders')
  })
})
