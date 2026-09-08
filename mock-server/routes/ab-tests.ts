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
import { aggregate, deriveKpi, isWithin } from '../store/metrics.ts'
import { dailyKpiSeries } from '../store/report-aggregate.ts'
import { applyEmptyState } from '../lib/mock-state.ts'
import { errorEnvelope, pagination } from '../lib/envelope.ts'
import { dateRangeParams, filterItems, pageParams, paginate, searchItems, sortItems, sortParams, str } from '../lib/query.ts'
import { optionalNumber, optionalString, requireString } from '../lib/validate.ts'
import { serializeAbTest, serializeArticle } from '../lib/serialize.ts'
import { fetchMetaInsights } from '../meta-insights.ts'
import { ExternalPageError, fetchExternalPage } from '../external-page.ts'
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
  const body = req.body as Record<string, unknown>
  const created = {
    id: state.nextId,
    uid: `EXITPOPUP_${String(state.exitPopups.length + 1).padStart(4, '0')}`,
    ab_test_id: abTest.id,
    name: name.value,
    ratio: typeof body.ratio === 'number' ? body.ratio : 0,
    enabled: true,
    preset_id: optionalString(req.body, 'preset_id') || null,
    visit_count: optionalString(req.body, 'visit_count') || 'all',
    phone_number: optionalString(req.body, 'phone_number') || '',
    link_url: optionalString(req.body, 'link_url') || '',
    link_target: optionalString(req.body, 'link_target') || '_blank',
    tracking_urls: Array.isArray(body.tracking_urls)
      ? body.tracking_urls.filter((u): u is string => typeof u === 'string' && u !== '')
      : [],
    animation: optionalString(req.body, 'animation') || 'fade',
    delay_seconds: optionalNumber(req.body, 'delay_seconds') ?? 0,
    scroll_trigger: body.scroll_trigger === true,
    scroll_position: optionalNumber(req.body, 'scroll_position') ?? 50,
    countdown_trigger: body.countdown_trigger === true,
    countdown_seconds: optionalNumber(req.body, 'countdown_seconds') ?? 0,
    back_button_trigger: body.back_button_trigger === true,
    exit_trigger: body.exit_trigger !== false,
    position_x: optionalNumber(req.body, 'position_x') ?? 50,
    position_y: optionalNumber(req.body, 'position_y') ?? 50,
    device_sp: body.device_sp !== false,
    device_tablet: body.device_tablet !== false,
    device_pc: body.device_pc !== false,
    html: optionalString(req.body, 'html') || '<div class="popup-wrap"><p>ポップアップ</p></div>',
    javascript: optionalString(req.body, 'javascript') || '',
    head_tag: optionalString(req.body, 'head_tag') || '',
    body_tag: optionalString(req.body, 'body_tag') || '',
    // 指示176/172: 種別と触ったときの動作
    popup_kind: (body.popup_kind === 'instant' ? 'instant' : 'exit') as 'exit' | 'instant',
    link_action: (body.link_action === 'close' ? 'close' : 'link') as 'link' | 'close',
  }
  setState((s) => ({ ...s, exitPopups: [...s.exitPopups, created], nextId: s.nextId + 1 }))
  res.status(201).json({ exit_popup: created })
})

abTestsRouter.put('/ab_tests/:uid/exit_popups/:popup_uid', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  const idx = state.exitPopups.findIndex(
    (p) => p.uid === req.params.popup_uid && p.ab_test_id === abTest.id,
  )
  if (idx === -1) {
    res.status(404).json(errorEnvelope('not_found', 'ポップアップが見つかりません。'))
    return
  }
  const existing = state.exitPopups[idx]!
  const body = req.body as Record<string, unknown>
  const updated = {
    ...existing,
    ...(typeof body.name === 'string' ? { name: body.name } : {}),
    ...(typeof body.ratio === 'number' ? { ratio: Math.max(0, Math.min(100, Math.round(body.ratio))) } : {}),
    ...(typeof body.enabled === 'boolean' ? { enabled: body.enabled } : {}),
    ...(typeof body.visit_count === 'string' ? { visit_count: body.visit_count } : {}),
    ...(typeof body.phone_number === 'string' ? { phone_number: body.phone_number } : {}),
    ...(typeof body.link_url === 'string' ? { link_url: body.link_url } : {}),
    ...(typeof body.link_target === 'string' ? { link_target: body.link_target } : {}),
    ...(Array.isArray(body.tracking_urls)
      ? { tracking_urls: body.tracking_urls.filter((u): u is string => typeof u === 'string' && u !== '') }
      : {}),
    ...(typeof body.animation === 'string' ? { animation: body.animation } : {}),
    ...(typeof body.delay_seconds === 'number' ? { delay_seconds: body.delay_seconds } : {}),
    ...(typeof body.scroll_trigger === 'boolean' ? { scroll_trigger: body.scroll_trigger } : {}),
    ...(typeof body.scroll_position === 'number' ? { scroll_position: body.scroll_position } : {}),
    ...(typeof body.countdown_trigger === 'boolean' ? { countdown_trigger: body.countdown_trigger } : {}),
    ...(typeof body.countdown_seconds === 'number' ? { countdown_seconds: body.countdown_seconds } : {}),
    ...(typeof body.back_button_trigger === 'boolean' ? { back_button_trigger: body.back_button_trigger } : {}),
    ...(typeof body.exit_trigger === 'boolean' ? { exit_trigger: body.exit_trigger } : {}),
    ...(typeof body.position_x === 'number' ? { position_x: body.position_x } : {}),
    ...(typeof body.position_y === 'number' ? { position_y: body.position_y } : {}),
    ...(typeof body.device_sp === 'boolean' ? { device_sp: body.device_sp } : {}),
    ...(typeof body.device_tablet === 'boolean' ? { device_tablet: body.device_tablet } : {}),
    ...(typeof body.device_pc === 'boolean' ? { device_pc: body.device_pc } : {}),
    ...(typeof body.html === 'string' ? { html: body.html } : {}),
    ...(typeof body.javascript === 'string' ? { javascript: body.javascript } : {}),
    ...(typeof body.head_tag === 'string' ? { head_tag: body.head_tag } : {}),
    ...(typeof body.body_tag === 'string' ? { body_tag: body.body_tag } : {}),
    ...(body.popup_kind === 'exit' || body.popup_kind === 'instant'
      ? { popup_kind: body.popup_kind as 'exit' | 'instant' }
      : {}),
    ...(body.link_action === 'link' || body.link_action === 'close'
      ? { link_action: body.link_action as 'link' | 'close' }
      : {}),
  }
  // 配信割合の自動バランス（Versionと同じ挙動）:
  // この beyondページの離脱防止ポップが「ちょうど2個」のとき、片方の割合を変えると
  // もう片方が `100 - 新値` に追従して合計100%を保つ。返り値に adjusted_siblings を含める。
  // 指示176: 種別（exit/instant）ごとに独立してバランスする（別タブのポップと混ざらない）
  const kindOf = (p: { popup_kind?: 'exit' | 'instant' }): 'exit' | 'instant' => p.popup_kind ?? 'exit'
  const existingKind = kindOf(existing)
  const adjustedSiblings: { uid: string; ratio: number }[] = []
  const siblingPopups = state.exitPopups.filter(
    (p) => p.ab_test_id === abTest.id && kindOf(p) === existingKind,
  )
  if (typeof body.ratio === 'number' && siblingPopups.length === 2) {
    const otherIdx = state.exitPopups.findIndex(
      (p) => p.ab_test_id === abTest.id && kindOf(p) === existingKind && p.uid !== req.params.popup_uid,
    )
    if (otherIdx !== -1) {
      const other = state.exitPopups[otherIdx]!
      const otherRatio = Math.max(0, Math.min(100, 100 - updated.ratio))
      const adjustedOther = { ...other, ratio: otherRatio }
      adjustedSiblings.push({ uid: adjustedOther.uid, ratio: otherRatio })
      setState((s) => ({
        ...s,
        exitPopups: s.exitPopups.map((p, i) =>
          i === idx ? updated : i === otherIdx ? adjustedOther : p,
        ),
      }))
      res.json({ exit_popup: updated, adjusted_siblings: adjustedSiblings })
      return
    }
  }
  setState((s) => ({
    ...s,
    exitPopups: s.exitPopups.map((p, i) => (i === idx ? updated : p)),
  }))
  res.json({ exit_popup: updated, adjusted_siblings: adjustedSiblings })
})

abTestsRouter.delete('/ab_tests/:uid/exit_popups/:popup_uid', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  const idx = state.exitPopups.findIndex(
    (p) => p.uid === req.params.popup_uid && p.ab_test_id === abTest.id,
  )
  if (idx === -1) {
    res.status(404).json(errorEnvelope('not_found', 'ポップアップが見つかりません。'))
    return
  }
  setState((s) => ({
    ...s,
    exitPopups: s.exitPopups.filter((_, i) => i !== idx),
  }))
  res.status(204).end()
})

// ── 追尾型ポップアップ（指示85）──
abTestsRouter.get('/ab_tests/:uid/follow_popups', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  const popups = state.followPopups.filter((p) => p.ab_test_id === abTest.id)
  res.json({ follow_popups: applyEmptyState(req, popups) })
})

abTestsRouter.post('/ab_tests/:uid/follow_popups', (req, res) => {
  const name = requireString(req.body, 'name', { maxLength: 100 })
  if (!name.ok) {
    res.status(422).json(errorEnvelope('validation_failed', name.message))
    return
  }
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  const body = req.body as Record<string, unknown>
  const created = {
    id: state.nextId,
    uid: `FOLLOWPOPUP_${String(state.followPopups.length + 1).padStart(4, '0')}`,
    ab_test_id: abTest.id,
    name: name.value,
    enabled: true,
    preset_id: optionalString(req.body, 'preset_id') || null,
    position: (['top', 'bottom', 'bottom-right', 'bottom-left'].includes(String(body.position)) ? String(body.position) : 'bottom') as 'top' | 'bottom' | 'bottom-right' | 'bottom-left',
    show_after_scroll: optionalNumber(req.body, 'show_after_scroll') ?? 0,
    show_close_button: body.show_close_button !== false,
    animation: optionalString(req.body, 'animation') || 'slideUp',
    device_sp: body.device_sp !== false,
    device_tablet: body.device_tablet !== false,
    device_pc: body.device_pc !== false,
    html: optionalString(req.body, 'html') || '<div class="follow-popup-wrap"><p>追尾バナー</p></div>',
    javascript: optionalString(req.body, 'javascript') || '',
    css: optionalString(req.body, 'css') || '',
  }
  setState((s) => ({ ...s, followPopups: [...s.followPopups, created], nextId: s.nextId + 1 }))
  res.status(201).json({ follow_popup: created })
})

abTestsRouter.put('/ab_tests/:uid/follow_popups/:popup_uid', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  const idx = state.followPopups.findIndex(
    (p) => p.uid === req.params.popup_uid && p.ab_test_id === abTest.id,
  )
  if (idx === -1) {
    res.status(404).json(errorEnvelope('not_found', '追尾ポップアップが見つかりません。'))
    return
  }
  const existing = state.followPopups[idx]!
  const body = req.body as Record<string, unknown>
  const updated = {
    ...existing,
    ...(typeof body.name === 'string' ? { name: body.name } : {}),
    ...(typeof body.enabled === 'boolean' ? { enabled: body.enabled } : {}),
    ...(typeof body.position === 'string' && ['top', 'bottom', 'bottom-right', 'bottom-left'].includes(body.position) ? { position: body.position as 'top' | 'bottom' | 'bottom-right' | 'bottom-left' } : {}),
    ...(typeof body.show_after_scroll === 'number' ? { show_after_scroll: body.show_after_scroll } : {}),
    ...(typeof body.show_close_button === 'boolean' ? { show_close_button: body.show_close_button } : {}),
    ...(typeof body.animation === 'string' ? { animation: body.animation } : {}),
    ...(typeof body.device_sp === 'boolean' ? { device_sp: body.device_sp } : {}),
    ...(typeof body.device_tablet === 'boolean' ? { device_tablet: body.device_tablet } : {}),
    ...(typeof body.device_pc === 'boolean' ? { device_pc: body.device_pc } : {}),
    ...(typeof body.html === 'string' ? { html: body.html } : {}),
    ...(typeof body.javascript === 'string' ? { javascript: body.javascript } : {}),
    ...(typeof body.css === 'string' ? { css: body.css } : {}),
  }
  setState((s) => ({
    ...s,
    followPopups: s.followPopups.map((p, i) => (i === idx ? updated : p)),
  }))
  res.json({ follow_popup: updated })
})

abTestsRouter.delete('/ab_tests/:uid/follow_popups/:popup_uid', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  const idx = state.followPopups.findIndex(
    (p) => p.uid === req.params.popup_uid && p.ab_test_id === abTest.id,
  )
  if (idx === -1) {
    res.status(404).json(errorEnvelope('not_found', '追尾ポップアップが見つかりません。'))
    return
  }
  setState((s) => ({
    ...s,
    followPopups: s.followPopups.filter((_, i) => i !== idx),
  }))
  res.status(204).end()
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
abTestsRouter.get('/ab_tests/:uid/heatmaps/stats', (req, res) => {
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

abTestsRouter.get('/ab_tests/:uid/external_page', (req, res) => {
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
