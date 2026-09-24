/**
 * レポート・ヒートマップ・実LP取得（ab-tests.ts から分離）。
 *
 * パスは分ける前と同じ。ab-tests.ts が `use()` で合流させる。
 */
import { Router } from 'express'
import { getState, setState } from '../store/store.ts'
import { deriveKpi, isWithin, sumPrimary } from '../store/metrics.ts'
import { errorEnvelope } from '../lib/envelope.ts'
import { dateRangeParams } from '../lib/query.ts'
import { ExternalPageError, fetchExternalPage } from '../external-page.ts'
import { applyEmptyState } from '../lib/mock-state.ts'
import { findAbTest, notFound } from './ab-tests-shared.ts'
import { PARAMETER_SCOPE_NAMES, parameterScopesOf } from '../store/parameter-scopes.ts'
import { reportRows } from './report-rows.ts'
import { heatmapStatsRouter } from './heatmap-stats.ts'
import type { ParameterScope } from '../store/types.ts'

export const abTestsReportsRouter: Router = Router()
abTestsReportsRouter.use(heatmapStatsRouter)

abTestsReportsRouter.get('/ab_tests/:uid/reports', (req, res) => {
  const out = reportRows(getState(), req.params.uid, 'version', req.query)
  if (out === null) return notFound(res, 'beyondページが見つかりません。')
  res.json({ ...out, rows: applyEmptyState(req, out.rows) })
})

abTestsReportsRouter.get('/ab_tests/:uid/reports/lp', (req, res) => {
  const out = reportRows(getState(), req.params.uid, 'lp', req.query)
  if (out === null) return notFound(res, 'beyondページが見つかりません。')
  res.json({ ...out, rows: applyEmptyState(req, out.rows) })
})

abTestsReportsRouter.get('/ab_tests/:uid/reports/swipe', (req, res) => {
  const out = reportRows(getState(), req.params.uid, 'version', req.query)
  if (out === null) return notFound(res, 'beyondページが見つかりません。')
  res.json({ ...out, rows: applyEmptyState(req, out.rows) })
})

abTestsReportsRouter.get('/ab_tests/:uid/creative_report', (req, res) => {
  const out = reportRows(getState(), req.params.uid, 'creative', req.query)
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
 * クリエイティブレポートの「列を選ぶ」→「保存」。
 * 名前は採取したチェックボックスの name そのまま（`_columnChoiceBody_1fhbq_117` の form）。
 */
const CREATIVE_COLUMN_NAMES = [
  'adSpending',
  'pv',
  'click',
  'ctr',
  'cv',
  'cvr',
  'ctvr',
  'cpa',
  'mcpa',
] as const

abTestsReportsRouter.get('/creative_report_user_columns', (_req, res) => {
  res.json({
    creative_report_user_columns: getState().creativeReportColumns.map((name) => ({ name })),
  })
})

abTestsReportsRouter.put('/creative_report_user_columns', (req, res) => {
  const body = req.body as { creative_report_user_columns?: unknown }
  const raw = Array.isArray(body.creative_report_user_columns)
    ? body.creative_report_user_columns
    : []
  // 採取した9つ以外は作らない。重複も潰す。
  const names = [
    ...new Set(
      raw
        .filter((n): n is string => typeof n === 'string')
        .filter((n) => (CREATIVE_COLUMN_NAMES as readonly string[]).includes(n)),
    ),
  ]
  // 列が1つも無い表は画面が成立しない（実物のフォームも全部外せない）
  if (names.length === 0) {
    return res
      .status(422)
      .json(errorEnvelope('validation_failed', '列は1つ以上選んでください。'))
  }
  setState((s) => ({ ...s, creativeReportColumns: names }))
  res.json({ creative_report_user_columns: names.map((name) => ({ name })) })
})

/**
 * ファネルの段（＝ステップ）と、その実測（2026-09-15）。
 *
 * ステップは記事（article）。段ごとの数字は、そのステップに属するVersionの実測を足したもの。
 * 別の記録は持たない（Versionから記事は辿れるので、二重に数える置き場所を作らない）。
 */
abTestsReportsRouter.get('/ab_tests/:uid/funnel_steps', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  const { startDate, endDate } = dateRangeParams(req.query)

  const articles = state.articles.filter((a) => a.ab_test_id === abTest.id)
  const steps = articles.map((article, index) => {
    const versionUids = state.versions
      .filter((v) => v.article_id === article.id)
      .map((v) => v.uid)
    const metrics = state.metrics.filter(
      (m) =>
        m.scope === 'version' &&
        versionUids.includes(m.entity_uid) &&
        isWithin(m.date, startDate, endDate),
    )
    const name = article.memo.trim()
    return {
      uid: article.uid,
      // 名前を付けずに作れるので、空なら何番目かで出す（空欄のまま並べると区別できない）
      name: name === '' ? `ステップ${index + 1}` : name,
      ...deriveKpi(sumPrimary(metrics)),
    }
  })
  res.json({ steps, period: { start_date: startDate, end_date: endDate } })
})

/**
 * レポート設定「表示するパラメータ」（歯車から開くモーダル）。
 * 採取した画面には保存ボタンが1つも無いので、触った時点で保存する作りにしている。
 */
abTestsReportsRouter.get('/ab_tests/:uid/parameter_scopes', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  res.json({ parameter_scopes: parameterScopesOf(state, abTest.uid) })
})

abTestsReportsRouter.put('/ab_tests/:uid/parameter_scopes', (req, res) => {
  const abTest = findAbTest(getState(), req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  const body = req.body as { parameter_scopes?: unknown }
  const incoming = Array.isArray(body.parameter_scopes) ? body.parameter_scopes : []

  setState((s) => {
    let rows = parameterScopesOf(s, abTest.uid)
    for (const raw of incoming) {
      const patch = raw as Partial<ParameterScope> & { name?: unknown }
      // 行は採取した6つだけ。知らない名前は作らない（画面に無いものを増やさない）
      if (typeof patch.name !== 'string') continue
      const name = patch.name
      if (!(PARAMETER_SCOPE_NAMES as readonly string[]).includes(name)) continue
      rows = rows.map((row) =>
        row.name === name
          ? {
              ...row,
              creative: typeof patch.creative === 'boolean' ? patch.creative : row.creative,
              branch_operation:
                typeof patch.branch_operation === 'boolean'
                  ? patch.branch_operation
                  : row.branch_operation,
              heatmap: typeof patch.heatmap === 'boolean' ? patch.heatmap : row.heatmap,
              description:
                typeof patch.description === 'string'
                  ? patch.description.slice(0, 1000)
                  : row.description,
            }
          : row,
      )
    }
    return {
      ...s,
      parameterScopes: [
        ...s.parameterScopes.filter((row) => row.ab_test_uid !== abTest.uid),
        ...rows,
      ],
    }
  })
  res.json({ parameter_scopes: parameterScopesOf(getState(), abTest.uid) })
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
