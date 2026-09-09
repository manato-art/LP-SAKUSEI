/**
 * レポート・ヒートマップ・実LP取得（ab-tests.ts から分離）。
 *
 * パスは分ける前と同じ。ab-tests.ts が `use()` で合流させる。
 */
import { Router } from 'express'
import { getState } from '../store/store.ts'
import { aggregate, deriveKpi, isWithin } from '../store/metrics.ts'
import { dailyKpiSeries } from '../store/report-aggregate.ts'
import { errorEnvelope } from '../lib/envelope.ts'
import { dateRangeParams } from '../lib/query.ts'
import { ExternalPageError, fetchExternalPage } from '../external-page.ts'
import { applyEmptyState } from '../lib/mock-state.ts'
import { findAbTest, notFound } from './ab-tests-shared.ts'

export const abTestsReportsRouter: Router = Router()

// ── レポート系（§10-3・派生KPIは §10-5 恒等式）──
function reportRows(uid: string, scope: 'version' | 'lp' | 'creative', query: unknown) {
  const state = getState()
  const abTest = findAbTest(state, uid)
  if (abTest === undefined) return null
  const { startDate, endDate } = dateRangeParams(query as Record<string, unknown>)
  const articleIds = state.articles.filter((a) => a.ab_test_id === abTest.id).map((a) => a.id)
  const versions = state.versions.filter((v) => articleIds.includes(v.article_id))
  const rows = versions.map((version) => {
    const metrics = state.metrics.filter(
      (m) => m.entity_uid === version.uid && isWithin(m.date, startDate, endDate),
    )
    return {
      scope,
      entity_uid: version.uid,
      name: version.name,
      status: version.status,
      distribution_ratio: version.distribution_ratio,
      ...(metrics.length === 0 ? deriveKpi({ pv: 0, click: 0, cv: 0, ad_cost: 0 }) : aggregate(metrics)),
    }
  })
  const abTestMetrics = state.metrics.filter((m) => m.entity_uid === abTest.uid)
  return {
    rows,
    totals: aggregate(abTestMetrics.filter((m) => isWithin(m.date, startDate, endDate))),
    /** レポートタブ「デイリーレポート」表の日付別の行（§10-5・両端含む） */
    daily: dailyKpiSeries(abTestMetrics, startDate, endDate),
    period: { start_date: startDate, end_date: endDate },
  }
}

abTestsReportsRouter.get('/ab_tests/:uid/reports', (req, res) => {
  const out = reportRows(req.params.uid, 'version', req.query)
  if (out === null) return notFound(res, 'beyondページが見つかりません。')
  res.json({ ...out, rows: applyEmptyState(req, out.rows) })
})

abTestsReportsRouter.get('/ab_tests/:uid/reports/lp', (req, res) => {
  const out = reportRows(req.params.uid, 'lp', req.query)
  if (out === null) return notFound(res, 'beyondページが見つかりません。')
  res.json({ ...out, rows: applyEmptyState(req, out.rows) })
})

abTestsReportsRouter.get('/ab_tests/:uid/reports/swipe', (req, res) => {
  const out = reportRows(req.params.uid, 'version', req.query)
  if (out === null) return notFound(res, 'beyondページが見つかりません。')
  res.json({ ...out, rows: applyEmptyState(req, out.rows) })
})

abTestsReportsRouter.get('/ab_tests/:uid/creative_report', (req, res) => {
  const out = reportRows(req.params.uid, 'creative', req.query)
  if (out === null) return notFound(res, 'beyondページが見つかりません。')
  res.json({ ...out, rows: applyEmptyState(req, out.rows) })
})

/** ヒートマップ比較（§9-4）。密度は再現対象外・すべて合成。 */
abTestsReportsRouter.get('/ab_tests/:uid/heatmaps/comparisons', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  const heatmaps = state.heatmaps.filter((h) => h.ab_test_uid === abTest.uid)
  res.json({ heatmaps: applyEmptyState(req, heatmaps) })
})

/**
 * ヒートマップの実測集計（計測タグ由来）。
 *
 * 実物のヒートマップが持つ4モードぶんを、Versionごとにバンド単位で返す:
 *   arrival  到達率 = そのバンドまで到達した訪問 / PV
 *   exit     離脱率 = そのバンドで離脱した訪問 / PV
 *   attention 滞在時間 = 平均ミリ秒（サンプルが無いバンドは0）
 *   elementClick クリック数 = そのバンドに落ちたクリック数
 * 期間指定は日別集計を合算する。データが無ければ空配列（数字を作らない）。
 */
abTestsReportsRouter.get('/ab_tests/:uid/heatmaps/stats', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  const { startDate, endDate } = dateRangeParams(req.query)

  const rows = state.heatmapStats.filter(
    (h) => h.ab_test_uid === abTest.uid && isWithin(h.date, startDate, endDate),
  )
  // Version ごとに日別を合算する
  const byVersion = new Map<string, typeof rows>()
  for (const row of rows) {
    const list = byVersion.get(row.version_uid) ?? []
    list.push(row)
    byVersion.set(row.version_uid, list)
  }

  const versions = [...byVersion.entries()].map(([versionUid, all]) => {
    // 分割数を変えた前後のデータが混ざることがある。長さの違う配列を足すと
    // 数字が壊れるので、PVが最も多い分割数のぶんだけを使う。
    const pvByBands = new Map<number, number>()
    for (const row of all) pvByBands.set(row.bands, (pvByBands.get(row.bands) ?? 0) + row.pv)
    let bands = all[0]?.bands ?? 20
    let best = -1
    for (const [b, pv] of pvByBands) {
      if (pv > best) {
        best = pv
        bands = b
      }
    }
    const list = all.filter((row) => row.bands === bands)
    const zero = (): number[] => new Array<number>(bands).fill(0)
    const sum = { pv: 0, reach: zero(), exit: zero(), dwellMs: zero(), dwellN: zero() }
    const clicks: { x: number; y: number }[] = []
    for (const row of list) {
      sum.pv += row.pv
      for (let i = 0; i < bands; i++) {
        sum.reach[i] = (sum.reach[i] ?? 0) + (row.reach[i] ?? 0)
        sum.exit[i] = (sum.exit[i] ?? 0) + (row.exit[i] ?? 0)
        sum.dwellMs[i] = (sum.dwellMs[i] ?? 0) + (row.dwell_ms[i] ?? 0)
        sum.dwellN[i] = (sum.dwellN[i] ?? 0) + (row.dwell_n[i] ?? 0)
      }
      clicks.push(...row.clicks)
    }
    const ratio = (n: number): number | null => (sum.pv === 0 ? null : n / sum.pv)
    // クリックはバンドへ落として本数を数える（座標そのものも返す）
    const clickBands = zero()
    for (const c of clicks) {
      const i = Math.max(0, Math.min(bands - 1, Math.floor(c.y * bands)))
      clickBands[i] = (clickBands[i] ?? 0) + 1
    }
    const version = state.versions.find((v) => v.uid === versionUid)
    return {
      version_uid: versionUid,
      version_name: version?.name ?? null,
      bands,
      pv: sum.pv,
      arrival: sum.reach.map((n) => ratio(n)),
      exit: sum.exit.map((n) => ratio(n)),
      attention: sum.dwellMs.map((ms, i) => {
        const n = sum.dwellN[i] ?? 0
        return n === 0 ? 0 : Math.round(ms / n)
      }),
      elementClick: clickBands,
      clicks: clicks.slice(-2000),
    }
  })

  res.json({ period: { start_date: startDate, end_date: endDate }, versions })
})

/**
 * ヒートマップの背景に敷く「実LP」のHTML。
 *
 * 外部LP（別アカウントで配信中のLP）は自前のVersion HTMLを持たないため、
 * このシステム側の背景がサンプルLPになってしまい、色の位置が実物と合わない。
 * そこでサーバーが実LPを取得して返す（ブラウザからは x-frame-options で読めない）。
 *
 * URLは計測タグが最初のPVで知らせてきたもの（`ab_test.external_url`）だけを使う。
 * 任意のURLを外から指定させない＝この口をSSRFの入口にしない。
 */
const externalPageCache = new Map<string, { html: string; finalUrl: string; at: number }>()
const EXTERNAL_PAGE_TTL_MS = 10 * 60 * 1000

abTestsReportsRouter.get('/ab_tests/:uid/external_page', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')

  const url = abTest.external_url
  if (url === undefined || url === '') {
    return notFound(
      res,
      '外部LPの場所がまだ分かりません。計測タグを貼ったLPが1回以上表示されると分かります。',
    )
  }

  const hit = externalPageCache.get(url)
  if (hit !== undefined && Date.now() - hit.at < EXTERNAL_PAGE_TTL_MS) {
    res.json({ html: hit.html, final_url: hit.finalUrl, cached: true })
    return
  }

  void fetchExternalPage(url)
    .then(({ html, finalUrl }) => {
      externalPageCache.set(url, { html, finalUrl, at: Date.now() })
      res.json({ html, final_url: finalUrl, cached: false })
    })
    .catch((error: unknown) => {
      const isKnown = error instanceof ExternalPageError
      res.status(502).json(
        errorEnvelope(
          isKnown ? error.code : 'fetch_failed',
          isKnown ? error.message : '実LPを取得できませんでした。',
        ),
      )
    })
})
