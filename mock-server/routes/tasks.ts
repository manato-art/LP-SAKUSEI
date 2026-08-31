/** タスク / 審査（企画書 §10-3）。新規アカウントでは0件。作成すると一覧に出る（§10-9）。 */
import { Router } from 'express'
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
  let created = null
  setState((state) => {
    const out = createTask(state, {
      title: title.value,
      assignee_member_id: optionalNumber(req.body, 'assignee_member_id') ?? null,
      due_at: optionalString(req.body, 'due_at') || null,
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

tasksRouter.get('/inspections/folders', (req, res) => {
  const state = getState()
  res.json({
    folders: applyEmptyState(
      req,
      state.folders.map((f) => ({ id: f.id, uid: f.uid, name: f.name })),
    ),
  })
})
