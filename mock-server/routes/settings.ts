/** 設定 / 通知 / レポート除外 / 課金・アドオン（企画書 §10-3）。 */
import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { currentTeamId } from '../store/current-team.ts'
import { getState, setState } from '../store/store.ts'
import { applyEmptyState } from '../lib/mock-state.ts'
import { errorEnvelope } from '../lib/envelope.ts'
import { makeUid } from '../store/ids.ts'
import { optionalBoolean, optionalString, requireString } from '../lib/validate.ts'
import { dateRangeParams, str } from '../lib/query.ts'
import { isIpLike, matchesExclusion } from '../store/exclusions.ts'
import type {
  ExclusionCondition,
  ExclusionKind,
  ExclusionMatch,
  ReportExclusion,
} from '../store/types.ts'

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

/**
 * 画面のテーマカラー。アカウントに紐づけて保存し、別のブラウザでも同じ色にする。
 * 受け取るのは `#RGB` / `#RRGGBB` だけ。任意の文字列をCSSへ流すと
 * そのまま値として差し込まれてしまうので、ここで形を確かめる。
 */
const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

settingsRouter.get('/settings/theme', (_req, res) => {
  const state = getState()
  res.json({ accent: state.themeAccent, mode: state.themeMode })
})

settingsRouter.put('/settings/theme', (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>
  // ライト／ダークだけを変える場合もある（色は送られてこない）
  if (!('accent' in body) && 'mode' in body) {
    const mode = body['mode']
    if (mode !== 'light' && mode !== 'dark') {
      res.status(422).json(errorEnvelope('validation_failed', '表示モードは light か dark を指定してください。'))
      return
    }
    setState((s) => ({ ...s, themeMode: mode }))
    res.json({ accent: getState().themeAccent, mode })
    return
  }
  const accent = requireString(req.body, 'accent')
  if (!accent.ok) {
    res.status(422).json(errorEnvelope('validation_failed', accent.message))
    return
  }
  if (!HEX_COLOR.test(accent.value.trim())) {
    res
      .status(422)
      .json(errorEnvelope('validation_failed', '色は #RRGGBB の形式で指定してください。'))
    return
  }
  const value = accent.value.trim().toUpperCase()
  setState((s) => ({ ...s, themeAccent: value }))
  res.json({ accent: value, mode: getState().themeMode })
})

settingsRouter.get('/report-exclusions', (req, res) => {
  const state = getState()
  const rows = applyEmptyState(req, state.reportExclusions)
  // 「除外アクセス数」は記録から数える。記録が無ければ null（実物も「―」）。
  const withCount = rows.map((r) => ({
    ...r,
    // 除外リンクの組み立てに要るので、合言葉はここで渡す
    exclude_token: r.exclude_token,
    excluded_count:
      state.requestLogs.length === 0
        ? null
        : state.requestLogs.filter((log) => matchesExclusion(log, r)).length,
  }))
  res.json({ report_exclusions: withCount })
})

/** 配信リクエストの集計（リファラ / ソースIP / パラメータ の多い順） */
settingsRouter.get('/report-exclusions/requests', (req, res) => {
  const state = getState()
  const { startDate, endDate } = dateRangeParams(req.query)
  const limitRaw = Number(str(req.query, 'limit') ?? '5')
  const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, Math.floor(limitRaw))) : 5
  const q = (str(req.query, 'ip') ?? '').trim()

  const logs = state.requestLogs.filter(
    (log) =>
      log.date >= startDate && log.date <= endDate && (q === '' || log.ip.includes(q)),
  )
  const rank = (values: readonly string[]): { value: string; count: number }[] => {
    const counts = new Map<string, number>()
    for (const v of values) {
      if (v === '') continue
      counts.set(v, (counts.get(v) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  }
  res.json({
    period: { start_date: startDate, end_date: endDate },
    total: logs.length,
    referers: rank(logs.map((l) => l.referer)),
    ips: rank(logs.map((l) => l.ip)),
    params: rank(logs.flatMap((l) => l.params)),
  })
})

settingsRouter.post('/report-exclusions', (req, res) => {
  const body = req.body as Record<string, unknown>
  const raw = Array.isArray(body['conditions']) ? (body['conditions'] as unknown[]) : []
  if (raw.length === 0) {
    res.status(422).json(errorEnvelope('validation_failed', '除外条件を1つ以上指定してください。'))
    return
  }

  const KINDS: readonly ExclusionKind[] = ['email', 'ip', 'referer', 'param', 'team']
  const MATCHES: readonly ExclusionMatch[] = ['exact', 'partial', 'prefix', 'suffix']
  const conditions: ExclusionCondition[] = []
  for (const item of raw) {
    const c = (item ?? {}) as Record<string, unknown>
    const kind = KINDS.find((k) => k === c['kind'])
    const match = MATCHES.find((m) => m === c['match_type'])
    const value = typeof c['value'] === 'string' ? c['value'].trim() : ''
    if (kind === undefined || match === undefined) {
      res.status(422).json(errorEnvelope('validation_failed', '除外条件の指定が正しくありません。'))
      return
    }
    if (value === '') {
      res.status(422).json(errorEnvelope('validation_failed', '値を入力してください。'))
      return
    }
    // IPの完全一致だけは形を確かめる。間違った値を黙って登録すると
    // 「除外したのに数字が減らない」原因が分からなくなる。
    // 部分一致などは一部だけを書くのが普通なので検査しない。
    if (kind === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      res
        .status(422)
        .json(errorEnvelope('validation_failed', 'メールアドレスの形式が正しくありません。'))
      return
    }
    if (kind === 'ip' && match === 'exact' && !isIpLike(value)) {
      res
        .status(422)
        .json(errorEnvelope('validation_failed', 'IPアドレスの形式が正しくありません。'))
      return
    }
    conditions.push({
      kind,
      match_type: match,
      value,
      join: c['join'] === 'and' ? 'and' : 'or',
    })
  }

  const state = getState()
  const created: ReportExclusion = {
    id: state.nextId,
    uid: makeUid('reportExclusion', state.reportExclusions.length + 1),
    team_id: currentTeamId(state),
    // 除外リンクは推測できてはいけないので、uidとは別に乱数を持たせる
    exclude_token: randomBytes(16).toString('hex'),
    conditions,
    is_whitelist: body['is_whitelist'] === true,
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
