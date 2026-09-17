/**
 * 配信の切り替え予約のAPI（2026-09-16・本人の依頼・store/scheduled-switches.ts）。
 *
 *   GET    /articles/:uid/scheduled_switches   … そのステップの予約（これからのもの＋最近の結果5件）
 *   POST   /articles/:uid/scheduled_switches   … 予約する
 *   DELETE /scheduled_switches/:uid            … 取り消す（まだ実行していないものだけ）
 *
 * ⚠️ このシステムだけの機能（実物のSquadBeyondには無い）。
 */
import { Router } from 'express'
import { errorEnvelope } from '../lib/envelope.ts'
import { jstNow } from '../lib/jst.ts'
import { freshUid } from '../store/actions-shared.ts'
import { makeUid } from '../store/ids.ts'
import { validateSwitchInput, type ScheduledSwitch } from '../store/scheduled-switches.ts'
import { getState, setState } from '../store/store.ts'
import type { State } from '../store/types.ts'

export const scheduledSwitchesRouter: Router = Router()

/** 画面に出す最近の結果の件数 */
const RECENT_RESULTS = 5

/** 今（日本時間 'YYYY-MM-DDTHH:MM'） */
function nowJst(): string {
  const t = jstNow()
  return `${t.date}T${t.hhmm}`
}

/** 画面で「どのVersionを何%に」を出せるよう、Version名を添える（消えたVersionは空文字） */
function forClient(state: State, sw: ScheduledSwitch) {
  return {
    ...sw,
    ratios: sw.ratios.map((r) => ({
      ...r,
      name: state.versions.find((v) => v.uid === r.version_uid)?.name ?? '',
    })),
  }
}

scheduledSwitchesRouter.get('/articles/:uid/scheduled_switches', (req, res) => {
  const state = getState()
  const mine = state.scheduledSwitches.filter((s) => s.article_uid === req.params.uid)
  const upcoming = mine
    .filter((s) => s.status === 'pending')
    .sort((a, b) => a.run_at.localeCompare(b.run_at))
  const recent = mine
    .filter((s) => s.status !== 'pending')
    .sort((a, b) => (b.done_at ?? b.run_at).localeCompare(a.done_at ?? a.run_at))
    .slice(0, RECENT_RESULTS)
  res.json({ switches: [...upcoming, ...recent].map((s) => forClient(state, s)) })
})

scheduledSwitchesRouter.post('/articles/:uid/scheduled_switches', (req, res) => {
  const articleUid = req.params.uid
  const state = getState()
  if (!state.articles.some((a) => a.uid === articleUid)) {
    res.status(404).json(errorEnvelope('not_found', 'ステップが見つかりません。'))
    return
  }
  const input = validateSwitchInput(state, articleUid, req.body, nowJst())
  if (!input.ok) {
    res.status(422).json(errorEnvelope('validation_failed', input.message))
    return
  }
  let created: ScheduledSwitch | null = null
  setState((s) => {
    const next: ScheduledSwitch = {
      uid: freshUid(s.scheduledSwitches, s.nextId, (n) => makeUid('scheduledSwitch', n)),
      article_uid: articleUid,
      run_at: input.value.run_at,
      ratios: input.value.ratios,
      status: 'pending',
      note: '',
      created_at: Math.floor(Date.now() / 1000),
      done_at: null,
    }
    created = next
    return { ...s, scheduledSwitches: [...s.scheduledSwitches, next], nextId: s.nextId + 1 }
  })
  res.status(201).json({ switch: forClient(getState(), created as unknown as ScheduledSwitch) })
})

scheduledSwitchesRouter.delete('/scheduled_switches/:uid', (req, res) => {
  const target = getState().scheduledSwitches.find((s) => s.uid === req.params.uid)
  if (target === undefined) {
    res.status(404).json(errorEnvelope('not_found', '予約が見つかりません。'))
    return
  }
  if (target.status !== 'pending') {
    res.status(409).json(errorEnvelope('conflict', 'この予約はもう実行されたか、取り消されています。'))
    return
  }
  setState((s) => ({
    ...s,
    scheduledSwitches: s.scheduledSwitches.map((x) =>
      x.uid === target.uid ? { ...x, status: 'canceled' as const } : x,
    ),
  }))
  res.status(204).end()
})
