/** タスク / 審査（企画書 §10-3）。新規アカウントでは0件。作成すると一覧に出る（§10-9）。 */
import { normalizeReportItems } from '../report-items.ts'
import { Router } from 'express'
import type {
  TaskNotify,
  TaskReportSpan,
  TaskSchedule,
  TaskScheduleKind,
} from '../store/types.ts'
import { createTask, deleteTask, updateTask } from '../store/actions.ts'
import { TASK_STATUSES, isTaskStatus } from '../../src/shared/task-status.ts'
import { getState, setState } from '../store/store.ts'
import { INSPECTION_AUTHORITIES } from '../store/catalog.ts'
import { applyEmptyState } from '../lib/mock-state.ts'
import { errorEnvelope, pagination } from '../lib/envelope.ts'
import { filterItems, pageParams, paginate, searchItems, sortItems, sortParams } from '../lib/query.ts'
import { optionalNumber, optionalString, requireString } from '../lib/validate.ts'

export const tasksRouter: Router = Router()

tasksRouter.get('/tasks', (req, res) => {
  const state = getState()
  const filtered = filterItems(searchItems([...state.tasks], req.query, ['title']), req.query, {
    status: 'status',
    assignee_member_id: 'assignee_member_id',
  })
  const visible = applyEmptyState(req, filtered)
  const sorted = sortItems(visible, sortParams(req.query), ['title', 'due_at', 'created_at', 'status'])
  const page = pageParams(req.query)
  res.json({
    pagination: pagination(sorted.length, page.perPage, page.page),
    tasks: paginate(sorted, page),
  })
})

const SCHEDULE_KINDS: readonly TaskScheduleKind[] = [
  'once',
  'hourly',
  'daily',
  'weekly',
  'monthly_first',
  'monthly_last',
]
const SPANS: readonly TaskReportSpan[] = ['today', 'yesterday', 'last7days']

const two = (v: unknown, fallback: string): string =>
  typeof v === 'string' && /^\d{1,2}$/.test(v) ? v.padStart(2, '0') : fallback

/**
 * スケジュールを読む。曜日指定なのに曜日が無いと、永久に条件を満たさず
 * 黙って動かないタスクになるので断る。
 */
function parseSchedule(raw: unknown): { ok: true; value: TaskSchedule } | { ok: false; message: string } {
  const r = (raw ?? {}) as Record<string, unknown>
  const kind = SCHEDULE_KINDS.find((k) => k === r['kind']) ?? 'once'
  const weekdays = Array.isArray(r['weekdays'])
    ? (r['weekdays'] as unknown[]).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    : []
  if (kind === 'weekly' && weekdays.length === 0) {
    return { ok: false, message: '曜日を1つ以上選んでください。' }
  }
  return { ok: true, value: { kind, hour: two(r['hour'], '09'), minute: two(r['minute'], '00'), weekdays } }
}

/** 通知先を読む。LINEだけ送り先IDが空でよい（＝公式アカウントと友だちの全員へ送る） */
function parseNotify(raw: unknown): TaskNotify | null {
  const r = (raw ?? null) as Record<string, unknown> | null
  const service = r?.['service']
  const destinationId = r?.['destination_id']
  return (service === 'slack' || service === 'chatwork' || service === 'line') &&
    typeof destinationId === 'string' &&
    (destinationId !== '' || service === 'line')
    ? { service, destination_id: destinationId }
    : null
}

const RECURRING_NEEDS_NOTIFY = '定期タスクには通知先を指定してください。'

tasksRouter.post('/tasks', (req, res) => {
  const title = requireString(req.body, 'title', { maxLength: 150 })
  if (!title.ok) {
    res.status(422).json(errorEnvelope('validation_failed', title.message))
    return
  }
  /**
   * スケジュールと通知先。画面はここまで送ってくるので、受けて保存する。
   * 受け取らずに捨てると、定期タスクを作っても永久に動かない。
   */
  const body = req.body as Record<string, unknown>
  const schedule = parseSchedule(body['schedule'])
  if (!schedule.ok) {
    res.status(422).json(errorEnvelope('validation_failed', schedule.message))
    return
  }
  const notify = parseNotify(body['notify'])
  // 定期なのに送り先が無いと、動いても誰にも届かない
  if (schedule.value.kind !== 'once' && notify === null) {
    res.status(422).json(errorEnvelope('validation_failed', RECURRING_NEEDS_NOTIFY))
    return
  }

  // レポートに載せる項目。指定が無ければ既定（全部）
  const reportItems = normalizeReportItems(body['report_items'])

  let created = null
  setState((state) => {
    const out = createTask(state, {
      title: title.value,
      report_items: reportItems,
      assignee_member_id: optionalNumber(req.body, 'assignee_member_id') ?? null,
      due_at: optionalString(req.body, 'due_at') || null,
      description: optionalString(req.body, 'description'),
      schedule: schedule.value,
      span: SPANS.find((sp) => sp === body['span']) ?? 'today',
      notify,
    })
    created = out.task
    return out.state
  })
  res.status(201).json({ task: created })
})

/**
 * タスクの編集（名前・状態・スケジュール・通知先・レポート内容・説明）。
 * 送ってきた項目だけ変える。状態は共有の言葉（src/shared/task-status.ts）以外を断る
 * （以前は知らない言葉を黙って捨て、画面は「変えました」と出していた）。
 */
tasksRouter.put('/tasks/:uid', (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>
  const current = getState().tasks.find((t) => t.uid === req.params.uid)
  if (current === undefined) {
    res.status(404).json(errorEnvelope('not_found', 'タスクが見つかりません。'))
    return
  }
  const patch: Parameters<typeof updateTask>[2] = {}

  if ('status' in body) {
    if (!isTaskStatus(body['status'])) {
      res
        .status(400)
        .json(errorEnvelope('validation_failed', `状態は ${TASK_STATUSES.join(' / ')} のどれかにしてください。`))
      return
    }
    patch.status = body['status']
  }
  if ('title' in body) {
    const title = requireString(body, 'title', { maxLength: 150 })
    if (!title.ok) {
      res.status(422).json(errorEnvelope('validation_failed', 'タスク名を入力してください（150文字まで）。'))
      return
    }
    patch.title = title.value.trim()
  }
  if ('description' in body) patch.description = optionalString(body, 'description')
  if ('span' in body) {
    const span = SPANS.find((sp) => sp === body['span'])
    if (span === undefined) {
      res.status(422).json(errorEnvelope('validation_failed', 'レポート内容の指定が正しくありません。'))
      return
    }
    patch.span = span
  }
  if ('schedule' in body) {
    const schedule = parseSchedule(body['schedule'])
    if (!schedule.ok) {
      res.status(422).json(errorEnvelope('validation_failed', schedule.message))
      return
    }
    patch.schedule = schedule.value
  }
  if ('notify' in body) patch.notify = parseNotify(body['notify'])
  if ('report_items' in body) patch.report_items = normalizeReportItems(body['report_items'])

  const nextKind = patch.schedule?.kind ?? current.schedule.kind
  const nextNotify = patch.notify === undefined ? current.notify : patch.notify
  if (nextKind !== 'once' && nextNotify === null) {
    res.status(422).json(errorEnvelope('validation_failed', RECURRING_NEEDS_NOTIFY))
    return
  }

  let updated = null
  setState((state) => {
    const out = updateTask(state, req.params.uid, patch)
    updated = out.task
    return out.state
  })
  if (updated === null) {
    res.status(404).json(errorEnvelope('not_found', 'タスクが見つかりません。'))
    return
  }
  res.json({ task: updated })
})

/** タスクを消す（画面は確認カードを出してから呼ぶ） */
tasksRouter.delete('/tasks/:uid', (req, res) => {
  let removed = false
  setState((state) => {
    const out = deleteTask(state, req.params.uid)
    removed = out.removed
    return out.state
  })
  if (!removed) {
    res.status(404).json(errorEnvelope('not_found', 'タスクが見つかりません。'))
    return
  }
  res.status(204).end()
})

tasksRouter.get('/inspections', (req, res) => {
  res.json({ inspections: applyEmptyState(req, getState().inspections) })
})

tasksRouter.get('/inspections/authorities', (req, res) => {
  res.json({
    authorities: applyEmptyState(
      req,
      INSPECTION_AUTHORITIES.map((name, i) => ({ id: i + 1, name })),
    ),
  })
})

/**
 * 審査対象（/inspections/folders）は `routes/inspections.ts` が実装している。
 * ここにフォルダ名だけを返す置き石があったが、先に登録されていて
 * 本実装を横取りしてしまうため削除した（マジック置換で踏んだのと同じ罠）。
 */
