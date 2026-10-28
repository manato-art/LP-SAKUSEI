/**
 * 押すたびに数えていた頃のクリックを直す（2026-10-28 本人「過去も直して」）。
 *
 * 1回の表示につき1回までの数え方（cf1d187）より前は、計測リンクを押すたびにクリックを足していた。
 * 本番では PV 3・クリック 8 の日があった（見た人は3人・押した人は1人）。
 * 1回ずつの記録は無いので、押した人の記録（visitorTouches）から、その日に押した人の数を数えてクリックにする。
 */
import { describe, expect, it } from 'vitest'
import { repairOverCountedClicks } from '../mock-server/store/click-repair.ts'
import { createEmptyState } from '../mock-server/store/seed-empty.ts'
import type { DailyMetric, DeviceMetric, State, VisitorTouch } from '../mock-server/store/types.ts'

const DAY = '2026-10-28'
/** 2026-10-28 18:33 JST */
const AT = Date.parse('2026-10-28T09:33:00Z')

const metric = (scope: DailyMetric['scope'], entity_uid: string, pv: number, click: number, date = DAY): DailyMetric => ({
  entity_uid, scope, date, pv, click, cv: 0, ad_cost: 0, sales: 0,
})
const device = (scope: DeviceMetric['scope'], entity_uid: string, pv: number, click: number): DeviceMetric => ({
  entity_uid, scope, date: DAY, device: 'sp', pv, click, cv: 0, sales: 0,
})
const touch = (vid: string, clicked: boolean, params: string[] = []): VisitorTouch => ({
  vid, ab_test_uid: 'PAGE1', version_uid: 'VERSION_0001', params,
  viewed_at: AT, clicked_at: clicked ? AT + 20_000 : null, converted_at: null,
})

function state(over: Partial<State>): State {
  return { ...createEmptyState(), ...over }
}

describe('押すたびに数えていた頃のクリックを直す', () => {
  it('クリックが PV を超えた日は、その日に押した人の数にする（ページ・Version・端末ごと）', () => {
    const before = state({
      metrics: [metric('ab_test', 'PAGE1', 3, 8), metric('version', 'VERSION_0001', 3, 8)],
      deviceMetrics: [device('ab_test', 'PAGE1', 3, 8), device('version', 'VERSION_0001', 3, 8)],
      visitorTouches: [touch('visitor-a-0001', false), touch('visitor-b-0001', false), touch('visitor-c-0001', true)],
    })
    const { state: after, changed } = repairOverCountedClicks(before)
    expect(after.metrics.map((m) => [m.pv, m.click])).toEqual([[3, 1], [3, 1]])
    expect(after.deviceMetrics.map((m) => [m.pv, m.click])).toEqual([[3, 1], [3, 1]])
    expect(changed).toHaveLength(4)
    expect(changed[0]).toMatchObject({ scope: 'ab_test', entity_uid: 'PAGE1', date: DAY, from: 8, to: 1 })
    // 元の state は変えない
    expect(before.metrics[0]?.click).toBe(8)
  })

  it('クリックが PV 以下の日は触らない（押し直しが混ざっていても見分けられない）', () => {
    const before = state({ metrics: [metric('ab_test', 'PAGE1', 10, 4)], visitorTouches: [touch('visitor-a-0001', true)] })
    const { state: after, changed } = repairOverCountedClicks(before)
    expect(changed).toEqual([])
    expect(after).toBe(before)
  })

  it('押した人の記録が無くても、押されたことはあるので1にする（PV が上限）', () => {
    const { state: after } = repairOverCountedClicks(state({ metrics: [metric('ab_test', 'PAGE1', 3, 8)] }))
    expect(after.metrics[0]?.click).toBe(1)
  })

  it('押した人が PV より多く見えても、PV を超えない', () => {
    const touches = ['a', 'b', 'c'].map((s) => touch(`visitor-${s}-0001`, true))
    const { state: after } = repairOverCountedClicks(state({ metrics: [metric('ab_test', 'PAGE1', 2, 8)], visitorTouches: touches }))
    expect(after.metrics[0]?.click).toBe(2)
  })

  it('広告の行（Version×広告パラメータ）は、その広告で着地して押した人だけ数える', () => {
    const before = state({
      metrics: [metric('parameter', 'VERSION_0001|utm_source=fb', 3, 5)],
      visitorTouches: [touch('visitor-a-0001', true, ['utm_source=fb']), touch('visitor-b-0001', true, ['utm_source=tt'])],
    })
    expect(repairOverCountedClicks(before).state.metrics[0]?.click).toBe(1)
  })

  it('新しい数え方にしたあとの日は触らない・2回目は何もしない', () => {
    const later = state({ metrics: [metric('ab_test', 'PAGE1', 1, 2, '2026-10-29')] })
    expect(repairOverCountedClicks(later).changed).toEqual([])
    const once = repairOverCountedClicks(state({ metrics: [metric('ab_test', 'PAGE1', 3, 8)] })).state
    expect(repairOverCountedClicks(once).changed).toEqual([])
  })
})
