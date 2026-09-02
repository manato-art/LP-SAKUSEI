/**
 * beyondページ（AbTest）系（企画書 §10-3）。
 * `/ab_tests/:uid/articles` はLPエディタ本体（§6-2）なので、
 * エディタが起動時に叩く ab_test / articles / versions をここで返す。
 */
import { Router } from 'express'
import {
  addArticle,
  addRedirectPage,
  createAbTest,
  deleteAbTest,
  deleteRedirectPage,
  updateRedirectPage,
} from '../store/actions.ts'
import { getState, setState } from '../store/store.ts'
import { SPLIT_TEST_DEFAULTS, isSplitTestType } from '../store/split-test-defaults.ts'
import { aggregate, deriveKpi, isWithin } from '../store/metrics.ts'
import { dailyKpiSeries } from '../store/report-aggregate.ts'
import { applyEmptyState } from '../lib/mock-state.ts'
import { errorEnvelope, pagination } from '../lib/envelope.ts'
import { dateRangeParams, filterItems, pageParams, paginate, searchItems, sortItems, sortParams, str } from '../lib/query.ts'
import { optionalNumber, optionalString, requireString } from '../lib/validate.ts'
import { serializeAbTest, serializeArticle } from '../lib/serialize.ts'
import type { AbTest, State } from '../store/types.ts'

export const abTestsRouter: Router = Router()

function findAbTest(state: State, uid: string): AbTest | undefined {
  return state.abTests.find((t) => t.uid === uid)
}

function notFound(res: Parameters<Parameters<Router['get']>[1]>[1], message: string): void {
  res.status(404).json(errorEnvelope('not_found', message))
}

/**
 * 実APIの一覧は **フォルダ配下の v2 エンドポイント**（2026-08-31 実測）:
 *   GET /api/v2/folders/:folder_uuid/ab_tests?include_reports=&target_date=&ad_status=&media_ids=&page=
 * `ad_status=except_finished` が一覧の既定フィルタ（＝画面の「終了以外」）。
 */
abTestsRouter.get('/folders/:folderUid/ab_tests', (req, res) => {
  const state = getState()
  const folder = state.folders.find((f) => f.uid === req.params.folderUid)
  if (folder === undefined) return notFound(res, 'フォルダが見つかりません。')

  const adStatus = str(req.query, 'ad_status') ?? 'except_finished'
  const inFolder = state.abTests.filter((t) => t.folder_id === folder.id)
  const byStatus =
    adStatus === 'all'
      ? inFolder
      : adStatus === 'except_finished'
        ? inFolder.filter((t) => t.ad_status !== 'finished')
        : inFolder.filter((t) => t.ad_status === adStatus)

  const mediaIds = str(req.query, 'media_ids')
    ?.split(',')
    .map(Number)
    .filter((n) => Number.isFinite(n))
  const byMedia =
    mediaIds === undefined || mediaIds.length === 0
      ? byStatus
      : byStatus.filter((t) => t.media_id !== null && mediaIds.includes(t.media_id))

  const visible = applyEmptyState(req, searchItems(byMedia, req.query))
  const page = pageParams(req.query)
  res.json({
    pagination: pagination(visible.length, page.perPage, page.page),
    ab_tests: paginate(visible, page).map((t) => serializeAbTest(state, t)),
  })
})

/** 一覧の合計行（実測: GET /api/v2/folders/:uuid/ab_tests/reports_total） */
abTestsRouter.get('/folders/:folderUid/ab_tests/reports_total', (req, res) => {
  const state = getState()
  const folder = state.folders.find((f) => f.uid === req.params.folderUid)
  if (folder === undefined) return notFound(res, 'フォルダが見つかりません。')
  const { startDate, endDate } = dateRangeParams(req.query)
  const uids = state.abTests.filter((t) => t.folder_id === folder.id).map((t) => t.uid)
  const metrics = state.metrics.filter(
    (m) => uids.includes(m.entity_uid) && isWithin(m.date, startDate, endDate),
  )
  res.json({ reports_total: aggregate(metrics) })
})

/** 関連数（Version数/ポップアップ数/中間ページ数）。実測: GET /api/v1/.../relation_counts?ids= */
abTestsRouter.get('/folders/:folderUid/ab_tests/relation_counts', (req, res) => {
  const state = getState()
  const ids = (str(req.query, 'ids') ?? '').split(',').map(Number).filter(Number.isFinite)
  const counts = ids.map((id) => {
    const abTest = state.abTests.find((t) => t.id === id)
    const articleIds = state.articles.filter((a) => a.ab_test_id === id).map((a) => a.id)
    return {
      id,
      versions_count: state.versions.filter((v) => articleIds.includes(v.article_id)).length,
      exit_popups_count: state.exitPopups.filter((p) => p.ab_test_id === id).length,
      // 中間ページ＝ファネルのステップ（実機で確認した概念。現状は常に0）
      funnel_steps_count: 0,
      ab_test_uid: abTest?.uid ?? null,
    }
  })
  res.json({ relation_counts: counts })
})

// ── 一覧 / 作成 ──────────────────────────────────────────
abTestsRouter.get('/ab_tests', (req, res) => {
  const state = getState()
  const filtered = filterItems(searchItems([...state.abTests], req.query), req.query, {
    media_id: 'media_id',
    folder_id: 'folder_id',
    published: 'published',
    ad_status: 'ad_status',
  })
  const visible = applyEmptyState(req, filtered)
  const sorted = sortItems(visible, sortParams(req.query), ['title', 'created_at', 'updated_at'])
  const page = pageParams(req.query)
  res.json({
    pagination: pagination(sorted.length, page.perPage, page.page),
    ab_tests: paginate(sorted, page).map((t) => serializeAbTest(state, t)),
  })
})

/** 作成フローの中核（§10-9）。記事1件と初期Versionも同時に作られ、直後にエディタが開ける。 */
abTestsRouter.post('/ab_tests', (req, res) => {
  const title = requireString(req.body, 'title', { maxLength: 150 })
  if (!title.ok) {
    res.status(422).json(errorEnvelope('validation_failed', title.message))
    return
  }
  let created: ReturnType<typeof createAbTest> | null = null
  setState((state) => {
    const out = createAbTest(state, {
      title: title.value,
      memo: optionalString(req.body, 'memo'),
      folder_id: optionalNumber(req.body, 'folder_id') ?? null,
      media_id: optionalNumber(req.body, 'media_id') ?? null,
      editor_version: optionalNumber(req.body, 'editor_version') ?? 2,
      conversion_unit_price: optionalNumber(req.body, 'conversion_unit_price') ?? 0,
    })
    created = out
    return out.state
  })
  const result = created as unknown as ReturnType<typeof createAbTest>
  res.status(201).json({
    ab_test: serializeAbTest(getState(), result.abTest),
    article: serializeArticle(result.article),
    version: result.version,
  })
})

abTestsRouter.get('/ab_tests/:uid', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  res.json({ ab_test: serializeAbTest(state, abTest) })
})

/**
 * `PUT /ab_tests/:uid` は「基本情報」タブが使う更新なので
 * `routes/panel-basic-info.ts` に移した（部分更新でフォルダ/媒体が消える不具合があったため）。
 */

abTestsRouter.delete('/ab_tests/:uid', (req, res) => {
  let deleted = false
  setState((state) => {
    const out = deleteAbTest(state, req.params.uid)
    deleted = out.deleted
    return out.state
  })
  if (!deleted) return notFound(res, 'beyondページが見つかりません。')
  res.status(204).end()
})

// ── エディタ起動時（§6-2・§9-1）──────────────────────────
abTestsRouter.get('/ab_tests/:uid/articles', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  const articles = state.articles.filter((a) => a.ab_test_id === abTest.id)
  res.json({ articles: applyEmptyState(req, articles.map(serializeArticle)) })
})

/** ファネルステップ（記事）を1つ追加する（指示⑮ ステップの作成） */
abTestsRouter.post('/ab_tests/:uid/articles', (req, res) => {
  const name = optionalString(req.body, 'name')
  const out = addArticle(getState(), req.params.uid, { name })
  if (out === null) return notFound(res, 'beyondページが見つかりません。')
  setState(() => out.state)
  res.status(201).json({ article: serializeArticle(out.article) })
})

// ── 離脱ポップアップ（§10-3）──
abTestsRouter.get('/ab_tests/:uid/exit_popups', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  const popups = state.exitPopups.filter((p) => p.ab_test_id === abTest.id)
  res.json({ exit_popups: applyEmptyState(req, popups) })
})

abTestsRouter.post('/ab_tests/:uid/exit_popups', (req, res) => {
  const name = requireString(req.body, 'name', { maxLength: 100 })
  if (!name.ok) {
    res.status(422).json(errorEnvelope('validation_failed', name.message))
    return
  }
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  const created = {
    id: state.nextId,
    uid: `EXITPOPUP_${String(state.exitPopups.length + 1).padStart(4, '0')}`,
    ab_test_id: abTest.id,
    name: name.value,
    trigger: optionalString(req.body, 'trigger') || 'exit_intent',
    html: '<div>サンプルポップアップ</div>',
    enabled: true,
  }
  setState((s) => ({ ...s, exitPopups: [...s.exitPopups, created], nextId: s.nextId + 1 }))
  res.status(201).json({ exit_popup: created })
})

// ── リダイレクトページ ──
abTestsRouter.get('/ab_tests/:uid/redirect_pages', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  const pages = state.redirectPages.filter((p) => p.ab_test_id === abTest.id)
  res.json({ redirect_pages: applyEmptyState(req, pages) })
})

abTestsRouter.put('/ab_tests/:uid/redirect_pages', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  res.json({ redirect_pages: state.redirectPages.filter((p) => p.ab_test_id === abTest.id) })
})

/** 中間ページを1つ追加（指示⑮ 中間ページを追加） */
abTestsRouter.post('/ab_tests/:uid/redirect_pages/create', (req, res) => {
  const out = addRedirectPage(getState(), req.params.uid)
  if (out.page === null) return notFound(res, 'beyondページが見つかりません。')
  setState(() => out.state)
  res.status(201).json({ redirect_page: out.page })
})

/** 中間ページの設定を更新（名前 / リダイレクト先 / リダイレクト時間） */
abTestsRouter.patch('/redirect_pages/:uid', (req, res) => {
  const name = optionalString(req.body, 'name')
  const url = optionalString(req.body, 'url')
  const redirectTime = optionalNumber(req.body, 'redirect_time')
  const referrerType = optionalString(req.body, 'referrer_type')
  const out = updateRedirectPage(getState(), req.params.uid, {
    ...(name !== '' ? { name } : {}),
    url,
    ...(redirectTime !== undefined ? { redirect_time: redirectTime } : {}),
    ...(referrerType !== '' ? { referrer_type: referrerType } : {}),
  })
  if (out.page === null) return notFound(res, '中間ページが見つかりません。')
  setState(() => out.state)
  res.json({ redirect_page: out.page })
})

abTestsRouter.delete('/redirect_pages/:uid', (req, res) => {
  const out = deleteRedirectPage(getState(), req.params.uid)
  if (!out.deleted) return notFound(res, '中間ページが見つかりません。')
  setState(() => out.state)
  res.status(204).end()
})

// ── スプリットテスト設定6種（§9-5）──
abTestsRouter.get('/ab_tests/:uid/split_test_settings/:type', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  const type = req.params.type
  if (!isSplitTestType(type)) return notFound(res, '設定種別が不正です。')
  const stored = state.splitTestSettings.find((s) => s.ab_test_id === abTest.id && s.type === type)
  res.json({
    split_test_setting: stored ?? {
      id: 0,
      ab_test_id: abTest.id,
      type,
      rules: SPLIT_TEST_DEFAULTS[type],
    },
  })
})

abTestsRouter.put('/ab_tests/:uid/split_test_settings/:type', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  const type = req.params.type
  if (!isSplitTestType(type)) return notFound(res, '設定種別が不正です。')
  const body = req.body as { rules?: unknown }
  const rules = Array.isArray(body.rules) ? body.rules : SPLIT_TEST_DEFAULTS[type]
  const setting = { id: state.nextId, ab_test_id: abTest.id, type, rules }
  setState((s) => ({
    ...s,
    splitTestSettings: [
      ...s.splitTestSettings.filter((x) => !(x.ab_test_id === abTest.id && x.type === type)),
      setting,
    ],
    nextId: s.nextId + 1,
  }))
  res.json({ split_test_setting: setting })
})

// ── 振り分け設定 ──
abTestsRouter.get('/ab_tests/:uid/options/devide', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  res.json({ devide: { ab_test_uid: abTest.uid, mode: 'ratio', enabled: false } })
})

abTestsRouter.put('/ab_tests/:uid/options/devide', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  res.json({
    devide: {
      ab_test_uid: abTest.uid,
      mode: optionalString(req.body, 'mode') || 'ratio',
      enabled: true,
    },
  })
})

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

abTestsRouter.get('/ab_tests/:uid/reports', (req, res) => {
  const out = reportRows(req.params.uid, 'version', req.query)
  if (out === null) return notFound(res, 'beyondページが見つかりません。')
  res.json({ ...out, rows: applyEmptyState(req, out.rows) })
})

abTestsRouter.get('/ab_tests/:uid/reports/lp', (req, res) => {
  const out = reportRows(req.params.uid, 'lp', req.query)
  if (out === null) return notFound(res, 'beyondページが見つかりません。')
  res.json({ ...out, rows: applyEmptyState(req, out.rows) })
})

abTestsRouter.get('/ab_tests/:uid/reports/swipe', (req, res) => {
  const out = reportRows(req.params.uid, 'version', req.query)
  if (out === null) return notFound(res, 'beyondページが見つかりません。')
  res.json({ ...out, rows: applyEmptyState(req, out.rows) })
})

abTestsRouter.get('/ab_tests/:uid/creative_report', (req, res) => {
  const out = reportRows(req.params.uid, 'creative', req.query)
  if (out === null) return notFound(res, 'beyondページが見つかりません。')
  res.json({ ...out, rows: applyEmptyState(req, out.rows) })
})

/** ヒートマップ比較（§9-4）。密度は再現対象外・すべて合成。 */
abTestsRouter.get('/ab_tests/:uid/heatmaps/comparisons', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  const heatmaps = state.heatmaps.filter((h) => h.ab_test_uid === abTest.uid)
  res.json({ heatmaps: applyEmptyState(req, heatmaps) })
})
