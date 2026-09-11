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
  setMediaMetrics,
  updateRedirectPage,
} from '../store/actions.ts'
import { getState, setState } from '../store/store.ts'
import { SPLIT_TEST_DEFAULTS, isSplitTestType } from '../store/split-test-defaults.ts'
import { aggregate, isWithin } from '../store/metrics.ts'
import { applyEmptyState } from '../lib/mock-state.ts'
import { errorEnvelope, pagination } from '../lib/envelope.ts'
import { dateRangeParams, filterItems, pageParams, paginate, searchItems, sortItems, sortParams, str } from '../lib/query.ts'
import { optionalNumber, optionalString, requireString } from '../lib/validate.ts'
import { serializeAbTest, serializeArticle } from '../lib/serialize.ts'
import { fetchMetaInsights } from '../meta-insights.ts'
import { findAbTest, notFound } from './ab-tests-shared.ts'
import { REDIRECT_SECONDS, isRedirectSeconds, redirectDestination } from '../lib/redirect-page-rules.ts'
import { migrateLegacyRedirectPageTags } from '../store/redirect-page-tags.ts'
import { abTestsPopupsRouter } from './ab-tests-popups.ts'
import { abTestsReportsRouter } from './ab-tests-reports.ts'

export const abTestsRouter: Router = Router()

// 分割したルーターを同じパス空間へ合流させる（パスは分ける前と同じ）
abTestsRouter.use(abTestsPopupsRouter)
abTestsRouter.use(abTestsReportsRouter)



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


// ── リダイレクトページ ──
abTestsRouter.get('/ab_tests/:uid/redirect_pages', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  // 旧形式（名前なしの2欄）で保存したタグは、名前付きのタグに置き換えてから返す（画面で1件ずつ直せるように）
  const migrated = migrateLegacyRedirectPageTags(state, abTest.id)
  if (migrated !== state) setState(() => migrated)
  const pages = migrated.redirectPages.filter((p) => p.ab_test_id === abTest.id)
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

/** 中間ページの設定を更新（名前 / リダイレクト先 / リダイレクト時間 / リファラー） */
abTestsRouter.patch('/redirect_pages/:uid', (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>
  const name = optionalString(body, 'name')
  const redirectTime = optionalNumber(body, 'redirect_time')
  const referrerType = optionalString(body, 'referrer_type')
  // 送られてきた項目だけを変える（一部だけ保存したときに、ほかの設定を消さない）
  const url = typeof body['url'] === 'string' ? body['url'].trim() : undefined
  // リダイレクト先は http / https のURLだけ（javascript: などで、開いた人のブラウザを動かされないように）。空は「未設定」
  if (url !== undefined && url !== '' && redirectDestination(url) === null) {
    res
      .status(422)
      .json(errorEnvelope('validation_failed', 'リダイレクト先は http:// または https:// から始まるURLを入力してください。'))
    return
  }
  if (redirectTime !== undefined && !isRedirectSeconds(redirectTime)) {
    res
      .status(422)
      .json(errorEnvelope('validation_failed', `リダイレクト時間は${REDIRECT_SECONDS.min}〜${REDIRECT_SECONDS.max}秒で入力してください。`))
    return
  }
  const out = updateRedirectPage(getState(), req.params.uid, {
    ...(name !== '' ? { name } : {}),
    ...(url !== undefined ? { url } : {}),
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


// ── Meta広告連携（媒体実績の取り込み）─────────────────────────
//
// トークンは環境変数 META_ACCESS_TOKEN のみ。Stateにも保存せず、レスポンスにも含めない。
// 紐付け（どの広告アカウント/キャンペーンがこのLPか）だけをStateに持つ。

/** 紐付けの保存。account のときIDは `act_` 有無どちらでも受け付ける。 */
abTestsRouter.put('/ab_tests/:uid/meta_link', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')

  const body = req.body as Record<string, unknown>
  const level = body.meta_level
  const isLevel = level === 'account' || level === 'campaign' || level === 'adset' || level === 'ad'
  const objectId = typeof body.meta_object_id === 'string' ? body.meta_object_id.trim() : ''

  // 空文字で送られたら紐付け解除
  if (objectId === '') {
    setState((s) => ({
      ...s,
      abTests: s.abTests.map((t) =>
        t.uid === abTest.uid ? { ...t, meta_level: undefined, meta_object_id: undefined } : t,
      ),
    }))
    res.json({ ok: true, meta_level: null, meta_object_id: null })
    return
  }
  if (!isLevel) {
    res.status(422).json(errorEnvelope('validation_failed', 'meta_level が不正です。'))
    return
  }
  if (!/^(act_)?\d{5,20}$/.test(objectId)) {
    res.status(422).json(errorEnvelope('validation_failed', 'IDは数字で入力してください。'))
    return
  }
  setState((s) => ({
    ...s,
    abTests: s.abTests.map((t) =>
      t.uid === abTest.uid ? { ...t, meta_level: level, meta_object_id: objectId } : t,
    ),
  }))
  res.json({ ok: true, meta_level: level, meta_object_id: objectId })
})

/**
 * 媒体実績の取り込み。Metaが返すのは日別の絶対値なので setMediaMetrics で**上書き**する
 * （再実行しても二重計上にならない）。LP側の実測（pv/click/cv）には触らない。
 */
abTestsRouter.post('/ab_tests/:uid/meta_sync', (req, res) => {
  const abTest = findAbTest(getState(), req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')

  const level = abTest.meta_level
  const objectId = abTest.meta_object_id ?? ''
  if (level === undefined || objectId === '') {
    res.status(422).json(errorEnvelope('not_linked', 'この beyondページにMeta広告が紐付いていません。'))
    return
  }
  const body = req.body as Record<string, unknown>
  const since = typeof body.start_date === 'string' ? body.start_date : ''
  const until = typeof body.end_date === 'string' ? body.end_date : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since) || !/^\d{4}-\d{2}-\d{2}$/.test(until)) {
    res.status(422).json(errorEnvelope('validation_failed', '期間は YYYY-MM-DD で指定してください。'))
    return
  }

  void fetchMetaInsights({ level, objectId, since, until }).then((result) => {
    if (!result.ok) {
      const status = result.reason === 'no_token' ? 503 : 502
      res.status(status).json(errorEnvelope(result.reason, result.message))
      return
    }
    setState((s) => {
      let metrics = s.metrics
      for (const row of result.rows) {
        metrics = setMediaMetrics(
          { ...s, metrics },
          abTest.uid,
          'ab_test',
          row.date,
          { ad_cost: row.ad_cost, imp: row.imp, media_click: row.media_click, media_cv: row.media_cv },
        )
      }
      return { ...s, metrics }
    })
    res.json({ ok: true, days: result.rows.length, start_date: since, end_date: until })
  })
})
