/**
 * 管理者 / 周辺ルート / 広告OAuthコールバック / 外部ランキングのローカルミラー（企画書 §10-3）。
 * OAuthは本番へ飛ばさず、結果画面用のステータスだけを返す（§3-2）。
 */
import { Router } from 'express'
import { currentTeamId } from '../store/current-team.ts'
import { getState, setState } from '../store/store.ts'
import { applyEmptyState } from '../lib/mock-state.ts'
import { errorEnvelope, pagination } from '../lib/envelope.ts'
import { pageParams, paginate } from '../lib/query.ts'
import { requireString } from '../lib/validate.ts'
import { aggregate } from '../store/metrics.ts'
import type { AdProvider } from '../store/types.ts'

export const miscRouter: Router = Router()

const AD_PROVIDERS: readonly AdProvider[] = ['facebook', 'google', 'microsoft', 'x', 'yahoo']

// ── 広告OAuthコールバック（結果画面用） ──
miscRouter.get('/redirections/ad_accounts/:provider/status', (req, res) => {
  const provider = req.params.provider
  if (!(AD_PROVIDERS as readonly string[]).includes(provider)) {
    res.status(404).json(errorEnvelope('not_found', '連携先が見つかりません。'))
    return
  }
  const connected = getState().adAccounts.some((a) => a.provider === provider && a.connected)
  res.json({
    provider,
    connected,
    message: connected ? '連携が完了しました。' : '連携されていません。',
  })
})

miscRouter.get('/redirections/ab_tests/google_postback_setting', (_req, res) => {
  res.json({ status: 'not_configured' })
})

// ── 周辺 ──
miscRouter.get('/permissions', (req, res) => {
  res.json({ permissions: applyEmptyState(req, getState().permissions) })
})

miscRouter.get('/introductions', (req, res) => {
  res.json({ introductions: applyEmptyState(req, getState().introductions) })
})

miscRouter.get('/seminar', (req, res) => {
  res.json({ seminars: applyEmptyState(req, getState().seminars) })
})

miscRouter.get('/terms', (_req, res) => {
  res.json({ html: '<h1>利用規約</h1><p>これは合成データです。</p>' })
})

/** 記事一括置換（/articles/bulk_replaces） */
miscRouter.get('/articles/bulk_replaces', (req, res) => {
  res.json({ bulk_replaces: applyEmptyState(req, []) })
})

miscRouter.post('/articles/bulk_replaces', (req, res) => {
  const from = requireString(req.body, 'from')
  if (!from.ok) {
    res.status(422).json(errorEnvelope('validation_failed', from.message))
    return
  }
  res.json({ ok: true, replaced_count: 0 })
})

// ── 管理者（§10-3 /admin/*）──
miscRouter.get('/admin/report', (req, res) => {
  const state = getState()
  const rows = state.teams.map((team) => ({
    team_uid: team.uid,
    team_name: team.name,
    ...aggregate(state.metrics),
  }))
  res.json({ rows: applyEmptyState(req, rows) })
})

miscRouter.get('/admin/articles/html_parts', (req, res) => {
  res.json({ html_parts: applyEmptyState(req, getState().htmlParts) })
})

miscRouter.get('/admin/plans', (req, res) => {
  res.json({ plans: applyEmptyState(req, getState().plans) })
})

miscRouter.post('/admin/plans', (req, res) => {
  const name = requireString(req.body, 'name')
  if (!name.ok) {
    res.status(422).json(errorEnvelope('validation_failed', name.message))
    return
  }
  const state = getState()
  const created = {
    id: state.nextId,
    uid: `PLAN_${String(state.plans.length + 1).padStart(4, '0')}`,
    team_id: currentTeamId(state),
    name: name.value,
    price: 0,
    seats: 1,
    current: false,
  }
  setState((s) => ({ ...s, plans: [...s.plans, created], nextId: s.nextId + 1 }))
  res.status(201).json({ plan: created })
})

miscRouter.get('/admin/preset_access_denials', (req, res) => {
  res.json({ items: applyEmptyState(req, []) })
})

miscRouter.get('/admin/product_search_forms', (req, res) => {
  res.json({ items: applyEmptyState(req, getState().productSearchForms) })
})

miscRouter.get('/admin/teams', (req, res) => {
  const state = getState()
  const page = pageParams(req.query)
  const visible = applyEmptyState(req, state.teams)
  res.json({
    pagination: pagination(visible.length, page.perPage, page.page),
    teams: paginate(visible, page),
  })
})

miscRouter.post('/admin/teams', (req, res) => {
  const name = requireString(req.body, 'name')
  if (!name.ok) {
    res.status(422).json(errorEnvelope('validation_failed', name.message))
    return
  }
  const state = getState()
  const created = {
    id: state.nextId,
    uid: `TEAM_${String(state.teams.length + 1).padStart(4, '0')}`,
    name: name.value,
    plan_id: state.plans[0]?.id ?? 1,
  }
  setState((s) => ({ ...s, teams: [...s.teams, created], nextId: s.nextId + 1 }))
  res.status(201).json({ team: created })
})

miscRouter.get('/admin/teams/:teamUid/members', (req, res) => {
  const state = getState()
  const team = state.teams.find((t) => t.uid === req.params.teamUid)
  if (team === undefined) {
    res.status(404).json(errorEnvelope('not_found', 'チームが見つかりません。'))
    return
  }
  res.json({ members: state.members.filter((m) => m.team_id === team.id) })
})

miscRouter.get('/admin/teams/:teamUid/plans/payments', (req, res) => {
  const state = getState()
  const team = state.teams.find((t) => t.uid === req.params.teamUid)
  if (team === undefined) {
    res.status(404).json(errorEnvelope('not_found', 'チームが見つかりません。'))
    return
  }
  res.json({ payments: applyEmptyState(req, []) })
})
