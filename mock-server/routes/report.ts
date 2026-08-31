/**
 * 外部ランキング（企画書 §6-3 のサイドバー「ランキング」＝別ドメインの別アプリ）のローカルミラー。
 * 本番へは接続せず、localhost の `/report/*` に集約する（§3-2・§10-1）。
 */
import { Router } from 'express'
import { getState } from '../store/store.ts'
import { aggregate, isWithin } from '../store/metrics.ts'
import { applyEmptyState } from '../lib/mock-state.ts'
import { pagination } from '../lib/envelope.ts'
import { dateRangeParams, pageParams, paginate, sortItems, sortParams } from '../lib/query.ts'

export const reportRouter: Router = Router()

reportRouter.get('/rankings', (req, res) => {
  const state = getState()
  const { startDate, endDate } = dateRangeParams(req.query)
  const rows = state.abTests.map((abTest) => {
    const metrics = state.metrics.filter(
      (m) => m.entity_uid === abTest.uid && isWithin(m.date, startDate, endDate),
    )
    return { uid: abTest.uid, title: abTest.title, ...aggregate(metrics) }
  })
  const visible = applyEmptyState(req, rows)
  const sorted = sortItems(visible, sortParams(req.query), ['sales', 'roas', 'cv', 'title'])
  const page = pageParams(req.query)
  res.json({
    pagination: pagination(sorted.length, page.perPage, page.page),
    rows: paginate(sorted, page),
  })
})
