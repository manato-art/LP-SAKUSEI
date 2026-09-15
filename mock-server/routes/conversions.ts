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
import { jstNow } from '../lib/jst.ts'

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

  /**
   * 期間で絞る（実物の日付ピッカー「◯年◯月◯日 から ◯年◯月◯日 まで」）。
   * 指定が無いときは全部出す（今までどおり）。occurred_at はUNIX秒。
   */
  const q = req.query as Record<string, unknown>
  const hasRange = typeof q['start_date'] === 'string' && typeof q['end_date'] === 'string'
  const inRange = hasRange
    ? filtered.filter((row) => {
        const { startDate, endDate } = dateRangeParams(q)
        // 日付はJSTで判定する（本番のTZはUTCなので、そのまま読むと日本の朝が前日扱いになる）
        return isWithin(jstNow(new Date(row.occurred_at * 1000)).date, startDate, endDate)
      })
    : filtered

  /**
   * 検索（実物の「速報を検索」）。
   * 当てる先は画面に出ている文字＝フォルダ名・beyondページ名・Versionメモ・メディア名・成果識別ID。
   */
  const needle = typeof q['q'] === 'string' ? q['q'].trim().toLowerCase() : ''
  const searched =
    needle === ''
      ? inRange
      : inRange.filter((row) =>
          [row.folder_name, row.ab_test_title, row.version_memo, row.media?.name, row.uid]
            .filter((v): v is string => typeof v === 'string')
            .some((v) => v.toLowerCase().includes(needle)),
        )

  const visible = applyEmptyState(req, searched)
  const sorted = sortItems(visible, sortParams(req.query), ['occurred_at', 'amount'])
  const page = pageParams(req.query)
  res.json({
    pagination: pagination(sorted.length, page.perPage, page.page),
    conversions: paginate(sorted, page),
    /**
     * 画面の「最終更新」に出す時刻（いちばん新しいCVの時刻・UNIX秒）。
     * 1件も無ければ null（時刻を作らない）。
     */
    last_updated_at:
      rows.length === 0 ? null : Math.max(...rows.map((row) => row.occurred_at)),
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
