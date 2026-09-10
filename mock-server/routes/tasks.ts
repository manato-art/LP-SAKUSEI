/** タスク / 審査（企画書 §10-3）。新規アカウントでは0件。作成すると一覧に出る（§10-9）。 */
import { Router } from 'express'
import type {
  TaskNotify,
  TaskReportSpan,
  TaskScheduleKind,
} from '../store/types.ts'
import { createTask, updateTask } from '../store/actions.ts'
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
  const KINDS: readonly TaskScheduleKind[] = [
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

  const raw = (body['schedule'] ?? {}) as Record<string, unknown>
  const kind = KINDS.find((k) => k === raw['kind']) ?? 'once'
  const weekdays = Array.isArray(raw['weekdays'])
    ? (raw['weekdays'] as unknown[])
        .map(Number)
        .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    : []
  // 曜日指定なのに曜日が無いと、永久に条件を満たさず黙って動かないタスクになる
  if (kind === 'weekly' && weekdays.length === 0) {
    res.status(422).json(errorEnvelope('validation_failed', '曜日を1つ以上選んでください。'))
    return
  }

  const notifyRaw = (body['notify'] ?? null) as Record<string, unknown> | null
  const service = notifyRaw?.['service']
  const destinationId = notifyRaw?.['destination_id']
  const notify: TaskNotify | null =
    (service === 'slack' || service === 'chatwork') &&
    typeof destinationId === 'string' &&
    destinationId !== ''
      ? { service, destination_id: destinationId }
      : null
  // 定期なのに送り先が無いと、動いても誰にも届かない
  if (kind !== 'once' && notify === null) {
    res
      .status(422)
      .json(errorEnvelope('validation_failed', '定期タスクには通知先を指定してください。'))
    return
  }

  let created = null
  setState((state) => {
    const out = createTask(state, {
      title: title.value,
      assignee_member_id: optionalNumber(req.body, 'assignee_member_id') ?? null,
      due_at: optionalString(req.body, 'due_at') || null,
      description: optionalString(req.body, 'description'),
      schedule: {
        kind,
        hour: two(raw['hour'], '09'),
        minute: two(raw['minute'], '00'),
        weekdays,
      },
      span: SPANS.find((sp) => sp === body['span']) ?? 'today',
      notify,
    })
    created = out.task
    return out.state
  })
  res.status(201).json({ task: created })
})

tasksRouter.put('/tasks/:uid', (req, res) => {
  let updated = null
  setState((state) => {
    const status = optionalString(req.body, 'status')
    const out = updateTask(state, req.params.uid, {
      ...(optionalString(req.body, 'title') !== '' ? { title: optionalString(req.body, 'title') } : {}),
      ...(status === 'todo' || status === 'doing' || status === 'done' ? { status } : {}),
    })
    updated = out.task
    return out.state
  })
  if (updated === null) {
    res.status(404).json(errorEnvelope('not_found', 'タスクが見つかりません。'))
    return
  }
  res.json({ task: updated })
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
