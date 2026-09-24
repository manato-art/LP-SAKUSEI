/**
 * 媒体実績（配信金額など）を出どころごとに持つ（2026-09-24 点検7）。
 *
 * 以前は Meta の取り込みも CSV の取り込みも、その日の媒体実績を**丸ごと置き換えて**いた。
 * CSV を入れると Meta の配信金額・表示回数が消え、CSV に無い列は0で上書きされていた。
 * いまは出どころ（meta / csv）ごとに置き場所を分け、合計を ad_cost などに入れる。
 */
import { describe, expect, it } from 'vitest'
import { createEmptyState } from '../mock-server/store/seed-empty.ts'
import { mediaSourcesOf, setMediaMetrics } from '../mock-server/store/media-sources.ts'
import type { DailyMetric, State } from '../mock-server/store/types.ts'

const DAY = '2026-09-20'
const PAGE = 'AB_PAGE'

function rowOf(state: State): DailyMetric | undefined {
  return state.metrics.find((m) => m.entity_uid === PAGE && m.scope === 'ab_test' && m.date === DAY)
}

function write(
  state: State,
  source: 'meta' | 'csv',
  media: Partial<{ ad_cost: number; imp: number; media_click: number; media_cv: number }>,
  legacy: 'keep' | 'replace' = 'keep',
): State {
  return { ...state, metrics: setMediaMetrics(state, PAGE, 'ab_test', DAY, source, media, legacy) }
}

describe('媒体実績を出どころごとに持つ', () => {
  it('Meta と CSV の配信金額を足して出す（片方がもう片方を消さない）', () => {
    let state = createEmptyState()
    state = write(state, 'meta', { ad_cost: 5000, imp: 1000, media_click: 40, media_cv: 2 })
    state = write(state, 'csv', { ad_cost: 3000 })
    expect(rowOf(state)?.ad_cost).toBe(8000)
    expect(rowOf(state)?.imp).toBe(1000)
  })

  it('同じ出どころを入れ直すと、その出どころのぶんだけ置き換わる（二重に数えない）', () => {
    let state = createEmptyState()
    state = write(state, 'meta', { ad_cost: 5000, imp: 1000, media_click: 40, media_cv: 2 })
    state = write(state, 'csv', { ad_cost: 3000 })
    state = write(state, 'meta', { ad_cost: 6000, imp: 1200, media_click: 50, media_cv: 3 })
    expect(rowOf(state)?.ad_cost).toBe(9000)
    expect(rowOf(state)?.media_cv).toBe(3)
  })

  it('CSV に無かった列は前の値のまま（0で上書きしない）', () => {
    let state = createEmptyState()
    state = write(state, 'csv', { ad_cost: 3000, imp: 700, media_click: 12 })
    state = write(state, 'csv', { ad_cost: 2000 })
    const row = rowOf(state)
    expect(row?.ad_cost).toBe(2000)
    expect(row?.imp).toBe(700)
    expect(row?.media_click).toBe(12)
  })

  it('LP側の実測（PV・クリック・CV）には触らない', () => {
    let state = createEmptyState()
    state = {
      ...state,
      metrics: [{ entity_uid: PAGE, scope: 'ab_test', date: DAY, pv: 90, click: 9, cv: 1, ad_cost: 0, sales: 0 }],
    }
    state = write(state, 'csv', { ad_cost: 1000 })
    expect(rowOf(state)).toMatchObject({ pv: 90, click: 9, cv: 1, ad_cost: 1000 })
  })

  it('出どころの記録が無い古い値は消さずに残して足す（既定）', () => {
    let state = createEmptyState()
    state = {
      ...state,
      metrics: [
        { entity_uid: PAGE, scope: 'ab_test', date: DAY, pv: 0, click: 0, cv: 0, ad_cost: 7000, sales: 0, imp: 300 },
      ],
    }
    state = write(state, 'csv', { ad_cost: 1000 })
    expect(rowOf(state)?.ad_cost).toBe(8000)
    expect(mediaSourcesOf(rowOf(state)!).legacy?.ad_cost).toBe(7000)
  })

  it('選べば古い値を今回の値で置き換える（以前も同じCSVを入れていたとき）', () => {
    let state = createEmptyState()
    state = {
      ...state,
      metrics: [
        { entity_uid: PAGE, scope: 'ab_test', date: DAY, pv: 0, click: 0, cv: 0, ad_cost: 7000, sales: 0, imp: 300 },
      ],
    }
    state = write(state, 'csv', { ad_cost: 1000 }, 'replace')
    expect(rowOf(state)?.ad_cost).toBe(1000)
    expect(rowOf(state)?.imp).toBe(0)
    expect(mediaSourcesOf(rowOf(state)!).legacy).toBeUndefined()
  })

  it('古い値の無い行は、出どころの内訳も legacy を持たない', () => {
    const state = write(createEmptyState(), 'meta', { ad_cost: 10 })
    expect(Object.keys(mediaSourcesOf(rowOf(state)!))).toEqual(['meta'])
  })
})
