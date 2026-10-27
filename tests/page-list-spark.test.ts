/**
 * ページ一覧の数字の下の小さい棒グラフ（2026-10-27 本人「こんな感じにリデザインしたい」＋見本の画像）。
 * 本人の決定: 直近7日の日ごと＝集計期間の最後の日までの7日間を、1日1本の棒で出す（上の数字は今までどおり集計期間の合計）。
 */
import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'
import type { ReportDailyRow } from '../src/app/api.ts'
import { renderSpark, sparkPoints, sparkRange } from '../src/app/pages/folders-list-spark.ts'
import type { ReportColumn } from '../src/app/pages/report-columns.ts'

const PV: ReportColumn = { label: 'PV', unit: '', metric: 'pv', format: 'integer' }
const COST: ReportColumn = { label: '配信金額', unit: '円', metric: 'ad_cost', format: 'yen' }
const CTR: ReportColumn = { label: 'CTR', unit: '%', metric: 'ctr', format: 'percent' }

const day = (date: string, kpi: Partial<ReportDailyRow>): ReportDailyRow =>
  ({
    date, pv: 0, click: 0, cv: 0, ad_cost: 0, imp: 0, media_click: 0, media_cv: 0, sales: 0, gross_profit: 0,
    roas: null, roi: null, cvr: null, cpa: null, ctr: null, ctvr: null, media_ctr: null, mcpa: null, ...kpi,
  }) as ReportDailyRow

describe('小さい棒グラフの期間', () => {
  it('集計期間の最後の日までの7日間（期間が1日でも7日ぶん）', () => {
    expect(sparkRange({ startDate: '2026-10-27', endDate: '2026-10-27' })).toEqual({ startDate: '2026-10-21', endDate: '2026-10-27' })
    expect(sparkRange({ startDate: '2026-09-01', endDate: '2026-10-03' })).toEqual({ startDate: '2026-09-27', endDate: '2026-10-03' })
  })
})

describe('小さい棒グラフの値', () => {
  const range = { startDate: '2026-10-21', endDate: '2026-10-27' }

  it('7日ぶんを日付の順に並べ、日ごとの値と「日付 指標 値」の説明を持つ', () => {
    const daily = [day('2026-10-27', { pv: 30 }), day('2026-10-21', { pv: 1234 })]
    const points = sparkPoints(daily, range, PV)
    expect(points.map((p) => p.date)).toEqual(['2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27'])
    expect(points.map((p) => p.value)).toEqual([1234, null, null, null, null, null, 30])
    expect(points[0]?.label).toBe('10/21 PV 1,234')
  })

  it('割合が出せない日（ゼロ割り）は値なし。配信金額が分からない日は値なし（¥0 と言わない）', () => {
    const daily = [day('2026-10-21', { ctr: null }), day('2026-10-22', { ctr: 12.5 }), day('2026-10-23', { ad_cost: 0, cost_known: false })]
    expect(sparkPoints(daily, range, CTR).slice(0, 2).map((p) => p.value)).toEqual([null, 12.5])
    expect(sparkPoints(daily, range, COST)[2]?.value).toBeNull()
  })
})

describe('小さい棒グラフの描き方', () => {
  it('いちばん大きい日を100%にした高さの棒を7本。値なしの日は空の棒・0の日は下の線だけ', () => {
    const { document } = parseHTML('<!doctype html><html><body></body></html>')
    ;(globalThis as unknown as Record<string, unknown>)['document'] = document
    const spark = renderSpark(
      [10, 0, null, 5, 10, 10, 2].map((value, i) => ({ date: `2026-10-2${i + 1}`, value, label: `日${i}` })),
      'pv',
    )
    const bars = [...spark.querySelectorAll<HTMLElement>('.pl-spark__bar')]
    expect(bars).toHaveLength(7)
    expect(spark.getAttribute('data-metric')).toBe('pv')
    expect(bars[0]?.style.height).toBe('100%')
    expect(bars[3]?.style.height).toBe('50%')
    expect(bars[1]?.classList.contains('pl-spark__bar--zero')).toBe(true)
    expect(bars[2]?.classList.contains('pl-spark__bar--none')).toBe(true)
    expect(bars[0]?.getAttribute('title')).toBe('日0')
    // 棒には文字を入れない（セルの数字の文字だけが残る）
    expect(spark.textContent).toBe('')
  })
})
