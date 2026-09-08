/**
 * CV速報 / コンバージョンレポート（企画書 §9-3・§10-3）。
 * 初期GETで既存分を描画し、WS push（ws/cable.ts）で先頭に追加される（§10-7）。
 */
import { Router } from 'express'
import { getState } from '../store/store.ts'
import { aggregate, isWithin } from '../store/metrics.ts'
import { applyEmptyState } from '../lib/mock-state.ts'
import { pagination } from '../lib/envelope.ts'
import { dateRangeParams, filterItems, pageParams, paginate, sortItems, sortParams } from '../lib/query.ts'

export const conversionsRouter: Router = Router()

conversionsRouter.get('/conversions', (req, res) => {
  const state = getState()
  // 実物のCV速報は8列（採取で確認）:
  //   フォルダ / beyondページ / Versionメモ / メディア / アクセス日時 / CV日時 / CVソース / 成果識別ID
  // このクローンが持っていない項目は埋めずに null を返す（UIで「-」）。
  //  - access_at: 訪問〜CVの紐付け（セッション追跡）をしていないので持てない
  //  - version_memo: Versionにメモ欄が無いのでVersion名で代替する
  const rows = state.conversions.map((c) => {
    const abTest = state.abTests.find((t) => t.uid === c.ab_test_uid)
    const version = state.versions.find((v) => v.uid === c.version_uid)
    const media = state.media.find((m) => m.id === c.media_id)
    const folder = state.folders.find((f) => f.id === abTest?.folder_id)
    return {
      ...c,
      folder_name: folder?.name ?? null,
      ab_test_title: abTest?.title ?? null,
      version_name: version?.name ?? null,
      version_memo: version?.name ?? null,
      media: media === undefined ? null : { name: media.name, icon_name: media.icon_name },
      access_at: null,
      // CVが増える経路はCV計測タグだけ（合成CVは廃止済み）
      cv_source: '計測タグ',
    }
  })
  const filtered = filterItems(rows, req.query, {
    ab_test_uid: 'ab_test_uid',
    version_uid: 'version_uid',
    media_id: 'media_id',
    status: 'status',
  })
  const visible = applyEmptyState(req, filtered)
  const sorted = sortItems(visible, sortParams(req.query), ['occurred_at', 'amount'])
  const page = pageParams(req.query)
  res.json({
    pagination: pagination(sorted.length, page.perPage, page.page),
    conversions: paginate(sorted, page),
  })
})

conversionsRouter.get('/conversion-reports', (req, res) => {
  const state = getState()
  const { startDate, endDate } = dateRangeParams(req.query)
  const rows = state.abTests.map((abTest) => {
    const metrics = state.metrics.filter(
      (m) => m.entity_uid === abTest.uid && isWithin(m.date, startDate, endDate),
    )
    return { uid: abTest.uid, title: abTest.title, ...aggregate(metrics) }
  })
  res.json({
    rows: applyEmptyState(req, rows),
    period: { start_date: startDate, end_date: endDate },
  })
})
