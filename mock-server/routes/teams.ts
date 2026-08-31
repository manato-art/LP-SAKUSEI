/** チーム / 外部連携（企画書 §10-3）。新規アカウントでは連携0件＝未接続状態が既定。 */
import { Router } from 'express'
import { currentTeamId } from '../store/current-team.ts'
import { getState, setState } from '../store/store.ts'
import { ASP_ROSTER } from '../store/catalog.ts'
import { makeUid } from '../store/ids.ts'
import { applyEmptyState } from '../lib/mock-state.ts'
import { errorEnvelope } from '../lib/envelope.ts'
import { optionalString, requireString } from '../lib/validate.ts'
import type { AdProvider } from '../store/types.ts'

export const teamsRouter: Router = Router()

const AD_PROVIDERS: readonly AdProvider[] = ['facebook', 'google', 'microsoft', 'x', 'yahoo']

teamsRouter.get('/teams/ad_accounts', (req, res) => {
  res.json({
    ad_accounts: applyEmptyState(req, getState().adAccounts),
    available_providers: AD_PROVIDERS,
  })
})

teamsRouter.get('/teams/asp_accounts', (req, res) => {
  res.json({ asp_accounts: applyEmptyState(req, getState().aspAccounts), available_asps: ASP_ROSTER })
})

teamsRouter.get('/teams/domains', (req, res) => {
  res.json({ domains: applyEmptyState(req, getState().domains) })
})

teamsRouter.post('/teams/domains', (req, res) => {
  const host = requireString(req.body, 'host', { maxLength: 253 })
  if (!host.ok) {
    res.status(422).json(errorEnvelope('validation_failed', host.message))
    return
  }
  const state = getState()
  const created = {
    id: state.nextId,
    uid: makeUid('domain', state.domains.length + 1),
    team_id: currentTeamId(state),
    host: host.value,
    status: 'pending' as const,
    ssl: false,
  }
  setState((s) => ({ ...s, domains: [...s.domains, created], nextId: s.nextId + 1 }))
  res.status(201).json({ domain: created })
})

teamsRouter.get('/teams/tags', (req, res) => {
  res.json({ tags: applyEmptyState(req, getState().tags) })
})

teamsRouter.post('/teams/tags', (req, res) => {
  const name = requireString(req.body, 'name', { maxLength: 50 })
  if (!name.ok) {
    res.status(422).json(errorEnvelope('validation_failed', name.message))
    return
  }
  const state = getState()
  const created = {
    id: state.nextId,
    uid: makeUid('tag', state.tags.length + 1),
    team_id: currentTeamId(state),
    name: name.value,
    color: optionalString(req.body, 'color') || '#0091FF',
  }
  setState((s) => ({ ...s, tags: [...s.tags, created], nextId: s.nextId + 1 }))
  res.status(201).json({ tag: created })
})

teamsRouter.get('/teams/product_search_forms', (req, res) => {
  res.json({ product_search_forms: applyEmptyState(req, getState().productSearchForms) })
})

teamsRouter.get('/teams/plans', (_req, res) => {
  const state = getState()
  res.json({
    plans: state.plans,
    current_plan_id: state.plans.find((p) => p.current)?.id ?? null,
  })
})

teamsRouter.get('/teams/:teamUid/members/:memberUid/invitation', (req, res) => {
  const state = getState()
  const member = state.members.find((m) => m.uid === req.params.memberUid)
  if (member === undefined) {
    res.status(404).json(errorEnvelope('not_found', 'メンバーが見つかりません。'))
    return
  }
  res.json({ invitation: { member_uid: member.uid, email: member.email, role: member.role } })
})

teamsRouter.put('/teams/:teamUid/members/:memberUid/invitation', (req, res) => {
  const state = getState()
  const member = state.members.find((m) => m.uid === req.params.memberUid)
  if (member === undefined) {
    res.status(404).json(errorEnvelope('not_found', 'メンバーが見つかりません。'))
    return
  }
  res.json({
    invitation: {
      member_uid: member.uid,
      email: member.email,
      role: optionalString(req.body, 'role') || member.role,
    },
  })
})

/** 媒体ロスター（作成モーダルの選択肢・実機では約65種） */
teamsRouter.get('/teams/media', (_req, res) => {
  res.json({ media: getState().media })
})

teamsRouter.get('/teams/members', (_req, res) => {
  res.json({ members: getState().members })
})
