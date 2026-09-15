/**
 * クリエイティブレポートの広告パラメータ行と並べ替え（2026-09-15）。
 *
 * 採取物（capture/clean/ab_tests__UID__reports/report-settings-modal）の
 * `_reportWrapper_1fhbq_152` には、列のチップ（配信金額 / CV / CPA / CTR / CVR）が並び、
 * それぞれの中に「並び替え」「A-Zで並べ替え」「Z-Aで並べ替え」がある。
 * その下に `utm_source=ig` のような行が並び、最後に「もっと表示」（`_readMore_1fhbq_440`）。
 */
import { describe, expect, it } from 'vitest'
import {
  CREATIVE_PAGE_SIZE,
  creativeParameterRows,
  sortCreativeRows,
} from '../src/app/pages/report-creative-rows.ts'
import type { ReportVersionRow } from '../src/app/api.ts'

/** 必要な項目だけ持つ行を作る（KPIの残りは0で埋める） */
function row(name: string, patch: Partial<ReportVersionRow> = {}): ReportVersionRow {
  return {
    scope: 'parameter',
    entity_uid: name,
    name,
    status: '',
    distribution_ratio: 0,
    pv: 0, click: 0, cv: 0, ad_cost: 0, imp: 0, media_click: 0, media_cv: 0,
    sales: 0, gross_profit: 0, roas: null, roi: null, cvr: null, cpa: null,
    ctr: null, ctvr: null, media_ctr: null, mcpa: null,
    fver: null, sver: null, fsver: null, oar: null,
    ...patch,
  }
}

const versions: ReportVersionRow[] = [
  row('Ver.1', {
    children: [row('utm_source=fb', { pv: 10, click: 4, ad_cost: 300 }), row('utm_source=ig', { pv: 3, ad_cost: 100 })],
  }),
  row('Ver.2', {
    children: [row('utm_source=fb', { pv: 5, click: 1, ad_cost: 200 })],
  }),
]

describe('クリエイティブの広告パラメータ行', () => {
  it('Versionをまたいで同じ広告を足し合わせる', () => {
    const rows = creativeParameterRows(versions)
    expect(rows.map((r) => `${r.name}:${r.pv}:${r.ad_cost}`)).toEqual([
      'utm_source=fb:15:500',
      'utm_source=ig:3:100',
    ])
  })

  it('率は足さずに合計から出し直す（CTRは4+1回を15回で割る）', () => {
    const fb = creativeParameterRows(versions).find((r) => r.name === 'utm_source=fb')
    expect(fb?.ctr).toBeCloseTo(5 / 15, 10)
  })

  it('広告パラメータが1つも無ければ空', () => {
    expect(creativeParameterRows([row('Ver.1')])).toEqual([])
  })
})

describe('列ごとの並べ替え（A-Z / Z-A）', () => {
  const rows = creativeParameterRows(versions)

  it('A-Zは小さい順', () => {
    expect(sortCreativeRows(rows, 'ad_cost', 'asc').map((r) => r.ad_cost)).toEqual([100, 500])
  })

  it('Z-Aは大きい順', () => {
    expect(sortCreativeRows(rows, 'ad_cost', 'desc').map((r) => r.ad_cost)).toEqual([500, 100])
  })

  it('値が無い行（null）は後ろへ回す（どちら向きでも）', () => {
    const mixed = [row('a', { cpa: 10 }), row('b'), row('c', { cpa: 2 })]
    expect(sortCreativeRows(mixed, 'cpa', 'asc').map((r) => r.name)).toEqual(['c', 'a', 'b'])
    expect(sortCreativeRows(mixed, 'cpa', 'desc').map((r) => r.name)).toEqual(['a', 'c', 'b'])
  })

  it('並べ替えても元の配列は変えない', () => {
    const before = rows.map((r) => r.name)
    sortCreativeRows(rows, 'pv', 'desc')
    expect(rows.map((r) => r.name)).toEqual(before)
  })
})

describe('もっと表示', () => {
  it('はじめは決まった件数だけ出す', () => {
    expect(CREATIVE_PAGE_SIZE).toBeGreaterThan(0)
  })
})
