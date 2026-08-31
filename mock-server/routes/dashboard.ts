/**
 * ダッシュボード（企画書 §9-2・§10-3）。
 * 新規アカウント（空）では KPI は全て0、series は日付だけ並ぶ空グラフになる（§1-4）。
 */
import { Router } from 'express'
import { aggregate, dateRange, deriveKpi, isWithin, parseDateKey } from '../store/metrics.ts'
import { getState } from '../store/store.ts'
import { serializeAbTest } from '../lib/serialize.ts'
import { applyEmptyState, isEmptyState } from '../lib/mock-state.ts'
import { pagination } from '../lib/envelope.ts'
import { dateRangeParams, pageParams, paginate, sortItems, sortParams } from '../lib/query.ts'
import type { DailyMetric } from '../store/types.ts'

export const dashboardRouter: Router = Router()

function metricsFor(
  metrics: readonly DailyMetric[],
  scope: DailyMetric['scope'],
  start: string,
  end: string,
): readonly DailyMetric[] {
  return metrics.filter((m) => m.scope === scope && isWithin(m.date, start, end))
}

dashboardRouter.get('/teams/dashboard', (req, res) => {
  const state = getState()
  const { startDate, endDate } = dateRangeParams(req.query)
  const empty = isEmptyState(req)
  const rows = empty ? [] : metricsFor(state.metrics, 'ab_test', startDate, endDate)

  const series = dateRange(startDate, endDate).map((date) => {
    const forDate = rows.filter((m) => m.date === date)
    const kpi = aggregate(forDate)
    return { date, ...kpi }
  })

  // created_at は UNIXタイムスタンプ（秒）なので、期間開始日の 00:00 と比較する
  const startTs = Math.floor(parseDateKey(startDate).getTime() / 1000)
  const newAbTests = empty
    ? []
    : state.abTests.filter((t) => t.created_at >= startTs).map((t) => serializeAbTest(state, t))
  const newVersions = empty
    ? []
    : state.versions
        .filter((v) => v.created_at >= startTs)
        .map((v) => ({ id: v.id, uid: v.uid, name: v.name, created_at: v.created_at }))

  res.json({
    kpi: aggregate(rows),
    series,
    new_ab_tests: newAbTests,
    new_versions: newVersions,
    period: { start_date: startDate, end_date: endDate },
  })
})

/** `/ab_tests/rankings` は `sort` & `sort_direction` 規約（§10-6） */
dashboardRouter.get('/ab_tests/rankings', (req, res) => {
  const state = getState()
  const { startDate, endDate } = dateRangeParams(req.query)
  const rows = state.abTests.map((abTest) => {
    const metrics = state.metrics.filter(
      (m) => m.entity_uid === abTest.uid && isWithin(m.date, startDate, endDate),
    )
    return { ...serializeAbTest(state, abTest), ...aggregate(metrics) }
  })
  const visible = applyEmptyState(req, rows)
  const sorted = sortItems(visible, sortParams(req.query, 'sort'), [
    'sales',
    'ad_cost',
    'gross_profit',
    'roas',
    'roi',
    'cv',
    'pv',
    'click',
    'title',
    'created_at',
  ])
  const page = pageParams(req.query)
  res.json({
    pagination: pagination(sorted.length, page.perPage, page.page),
    ab_tests: paginate(sorted, page),
  })
})

/** `/teams/version-rankings`(workers) は `sort_by` & `sort_order` 規約（§10-6） */
dashboardRouter.get('/teams/version-rankings', (req, res) => {
  const state = getState()
  const { startDate, endDate } = dateRangeParams(req.query)
  const rows = state.versions.map((version) => {
    const article = state.articles.find((a) => a.id === version.article_id)
    const abTest = state.abTests.find((t) => t.id === article?.ab_test_id)
    const metrics = state.metrics.filter(
      (m) => m.entity_uid === version.uid && isWithin(m.date, startDate, endDate),
    )
    return {
      id: version.id,
      uid: version.uid,
      name: version.name,
      status: version.status,
      distribution_ratio: version.distribution_ratio,
      ab_test_uid: abTest?.uid ?? null,
      ab_test_title: abTest?.title ?? null,
      ...(metrics.length === 0 ? deriveKpi({ pv: 0, click: 0, cv: 0, ad_cost: 0 }) : aggregate(metrics)),
    }
  })
  const visible = applyEmptyState(req, rows)
  const sorted = sortItems(visible, sortParams(req.query, 'sort_by'), [
    'sales',
    'ad_cost',
    'cv',
    'pv',
    'click',
    'roas',
    'name',
  ])
  const page = pageParams(req.query)
  res.json({
    pagination: pagination(sorted.length, page.perPage, page.page),
    versions: paginate(sorted, page),
  })
})
