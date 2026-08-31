/** 設定 / 通知 / レポート除外 / 課金・アドオン（企画書 §10-3）。 */
import { Router } from 'express'
import { currentTeamId } from '../store/current-team.ts'
import { getState, setState } from '../store/store.ts'
import { applyEmptyState } from '../lib/mock-state.ts'
import { errorEnvelope } from '../lib/envelope.ts'
import { makeUid } from '../store/ids.ts'
import { optionalBoolean, optionalString, requireString } from '../lib/validate.ts'

export const settingsRouter: Router = Router()

settingsRouter.get('/settings/internal_notifications/:scope', (req, res) => {
  const scope = req.params.scope
  if (scope !== 'member' && scope !== 'team') {
    res.status(404).json(errorEnvelope('not_found', '設定が見つかりません。'))
    return
  }
  const setting = getState().notificationSettings.find((s) => s.scope === scope)
  res.json({ settings: setting ?? null })
})

settingsRouter.put('/settings/internal_notifications/:scope', (req, res) => {
  const scope = req.params.scope
  if (scope !== 'member' && scope !== 'team') {
    res.status(404).json(errorEnvelope('not_found', '設定が見つかりません。'))
    return
  }
  setState((state) => ({
    ...state,
    notificationSettings: state.notificationSettings.map((s) =>
      s.scope === scope
        ? {
            ...s,
            cv_notify: optionalBoolean(req.body, 'cv_notify') ?? s.cv_notify,
            daily_report: optionalBoolean(req.body, 'daily_report') ?? s.daily_report,
            ad_alert: optionalBoolean(req.body, 'ad_alert') ?? s.ad_alert,
          }
        : s,
    ),
  }))
  res.json({ settings: getState().notificationSettings.find((s) => s.scope === scope) ?? null })
})

settingsRouter.get('/report-exclusions', (req, res) => {
  res.json({ report_exclusions: applyEmptyState(req, getState().reportExclusions) })
})

settingsRouter.post('/report-exclusions', (req, res) => {
  const target = requireString(req.body, 'target')
  if (!target.ok) {
    res.status(422).json(errorEnvelope('validation_failed', target.message))
    return
  }
  const state = getState()
  const created = {
    id: state.nextId,
    uid: makeUid('reportExclusion', state.reportExclusions.length + 1),
    team_id: currentTeamId(state),
    target: target.value,
    reason: optionalString(req.body, 'reason'),
  }
  setState((s) => ({ ...s, reportExclusions: [...s.reportExclusions, created], nextId: s.nextId + 1 }))
  res.status(201).json({ report_exclusion: created })
})

settingsRouter.delete('/report-exclusions/:uid', (req, res) => {
  const before = getState().reportExclusions.length
  setState((state) => ({
    ...state,
    reportExclusions: state.reportExclusions.filter((r) => r.uid !== req.params.uid),
  }))
  if (getState().reportExclusions.length === before) {
    res.status(404).json(errorEnvelope('not_found', '除外設定が見つかりません。'))
    return
  }
  res.status(204).end()
})

settingsRouter.get('/plans/:uid', (req, res) => {
  const plan = getState().plans.find((p) => p.uid === req.params.uid)
  if (plan === undefined) {
    res.status(404).json(errorEnvelope('not_found', 'プランが見つかりません。'))
    return
  }
  res.json({ plan })
})

/** 決済は実行しない。モックが ok を返すだけ（§3-2）。 */
settingsRouter.post('/plans/:uid/checkout', (req, res) => {
  const plan = getState().plans.find((p) => p.uid === req.params.uid)
  if (plan === undefined) {
    res.status(404).json(errorEnvelope('not_found', 'プランが見つかりません。'))
    return
  }
  res.json({ ok: true })
})

settingsRouter.get('/addon/option-list', (req, res) => {
  res.json({ addons: applyEmptyState(req, getState().addons) })
})
