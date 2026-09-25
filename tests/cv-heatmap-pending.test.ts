/**
 * 申し込みを待つ位置の記録の預かり方（2026-09-25・store/cv-heatmap.ts）。
 *
 * 位置の記録は「押した」記録より先に届くことがある（本番で18人中8人がこれで落ちた）。
 * 押す前に届いた記録も短い時間（10分）だけ預かり、押した記録が届いたら1日預かる扱いにする。
 * 押さないまま10分たった記録は捨てる（CV条件がクリックのページでは、押さない人の申し込みは数えられない）。
 */
import { describe, expect, it } from 'vitest'
import { holdOrAddCvHeatmap, markPendingClicked } from '../mock-server/store/cv-heatmap.ts'
import { createEmptyState } from '../mock-server/store/seed-empty.ts'
import type { State, VisitorTouch } from '../mock-server/store/types.ts'

const T0 = Date.UTC(2026, 8, 25, 3, 0, 0)
const MIN = 60 * 1000

function touch(vid: string, clickedAt: number | null): VisitorTouch {
  return { vid, ab_test_uid: 'AB1', version_uid: 'V1', viewed_at: T0, clicked_at: clickedAt, converted_at: null }
}

const sample = {
  bands: 10,
  reach: [1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
  dwell: new Array<number>(10).fill(0),
  exitBand: 2,
  fvBands: 3,
  offerBand: 2,
  clicks: [],
  isViewportBasis: true,
}

function hold(state: State, vid: string, now: number): State {
  return holdOrAddCvHeatmap(state, {
    abTestUid: 'AB1',
    versionUid: 'V1',
    device: 'sp',
    params: [],
    sample,
    vid,
    condition: 'click',
    now,
  })
}

describe('押す前に届いた位置の記録', () => {
  it('短い時間は預かり、押さないまま10分たったら捨てる', () => {
    let state: State = { ...createEmptyState(), visitorTouches: [touch('visitor-a-0001', null), touch('visitor-b-0001', null)] }
    state = hold(state, 'visitor-a-0001', T0)
    expect(state.pendingCvHeatmaps.map((p) => p.vid)).toEqual(['visitor-a-0001'])
    // 11分後に別の人の記録が届いたとき、押さなかった人の記録は捨てる
    state = hold(state, 'visitor-b-0001', T0 + 11 * MIN)
    expect(state.pendingCvHeatmaps.map((p) => p.vid)).toEqual(['visitor-b-0001'])
  })

  it('あとから押した記録が届いたら、1日預かる扱いになる', () => {
    let state: State = { ...createEmptyState(), visitorTouches: [touch('visitor-a-0001', null), touch('visitor-b-0001', null)] }
    state = hold(state, 'visitor-a-0001', T0)
    state = markPendingClicked(state, { abTestUid: 'AB1', vid: 'visitor-a-0001' })
    state = hold(state, 'visitor-b-0001', T0 + 11 * MIN)
    expect(state.pendingCvHeatmaps.map((p) => p.vid).sort()).toEqual(['visitor-a-0001', 'visitor-b-0001'])
    // 1日を過ぎたら、押した人の記録も捨てる
    state = hold(state, 'visitor-b-0001', T0 + 25 * 60 * MIN)
    expect(state.pendingCvHeatmaps.map((p) => p.vid)).toEqual(['visitor-b-0001'])
  })
})
