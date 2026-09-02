/**
 * フォルダ系（企画書 §10-3）。作成フローの起点（§1-4 creation flow）。
 * 新規アカウントでは0件 → ここで作ったフォルダがそのまま一覧に出て、beyondページの所属先になる。
 */
import { Router } from 'express'
import { createFolder, deleteFolder, updateFolder } from '../store/actions.ts'
import { getState, setState } from '../store/store.ts'
import { applyEmptyState } from '../lib/mock-state.ts'
import { errorEnvelope, pagination } from '../lib/envelope.ts'
import { filterItems, pageParams, paginate, searchItems, sortItems, sortParams } from '../lib/query.ts'
import { optionalNumber, optionalString, requireString } from '../lib/validate.ts'
import { serializeAbTest } from '../lib/serialize.ts'
import { makeUid } from '../store/ids.ts'

export const foldersRouter: Router = Router()

const FOLDER_SORT_KEYS = ['name', 'created_at', 'updated_at', 'ab_tests_count'] as const

foldersRouter.get('/folders', (req, res) => {
  const state = getState()
  const filtered = filterItems(
    searchItems([...state.folders], req.query, ['name']),
    req.query,
    { parent_id: 'parent_id' },
  )
  const visible = applyEmptyState(req, filtered)
  const sorted = sortItems(visible, sortParams(req.query), [...FOLDER_SORT_KEYS])
  const page = pageParams(req.query)
  res.json({
    pagination: pagination(sorted.length, page.perPage, page.page),
    folders: paginate(sorted, page),
  })
})

foldersRouter.post('/folders', (req, res) => {
  const name = requireString(req.body, 'name', { maxLength: 100 })
  if (!name.ok) {
    res.status(422).json(errorEnvelope('validation_failed', name.message))
    return
  }
  const parentId = optionalNumber(req.body, 'parent_id') ?? null
  let created = null
  setState((state) => {
    const out = createFolder(state, { name: name.value, parent_id: parentId })
    created = out.folder
    return out.state
  })
  res.status(201).json({ folder: created })
})

foldersRouter.get('/folders/:uid', (req, res) => {
  const state = getState()
  const folder = state.folders.find((f) => f.uid === req.params.uid)
  if (folder === undefined) {
    res.status(404).json(errorEnvelope('not_found', 'フォルダが見つかりません。'))
    return
  }
  const abTests = state.abTests
    .filter((t) => t.folder_id === folder.id)
    .map((t) => serializeAbTest(state, t))
  res.json({ folder, ab_tests: abTests })
})

foldersRouter.patch('/folders/:uid/favorite', (req, res) => {
  const isFavorite = req.body?.is_favorite
  if (typeof isFavorite !== 'boolean') {
    res.status(422).json(errorEnvelope('validation_failed', 'is_favorite は boolean で指定してください。'))
    return
  }
  const state = getState()
  const target = state.folders.find((f) => f.uid === req.params.uid)
  if (target === undefined) {
    res.status(404).json(errorEnvelope('not_found', 'フォルダが見つかりません。'))
    return
  }
  const updated = { ...target, is_favorite: isFavorite, updated_at: Math.floor(Date.now() / 1000) }
  setState((s) => ({
    ...s,
    folders: s.folders.map((f) => (f.uid === req.params.uid ? updated : f)),
  }))
  res.json({ folder: updated })
})

foldersRouter.put('/folders/:uid', (req, res) => {
  const name = requireString(req.body, 'name', { maxLength: 100 })
  if (!name.ok) {
    res.status(422).json(errorEnvelope('validation_failed', name.message))
    return
  }
  let updated = null
  setState((state) => {
    const out = updateFolder(state, req.params.uid, { name: name.value })
    updated = out.folder
    return out.state
  })
  if (updated === null) {
    res.status(404).json(errorEnvelope('not_found', 'フォルダが見つかりません。'))
    return
  }
  res.json({ folder: updated })
})

foldersRouter.delete('/folders/:uid', (req, res) => {
  let deleted = false
  setState((state) => {
    const out = deleteFolder(state, req.params.uid)
    deleted = out.deleted
    return out.state
  })
  if (!deleted) {
    res.status(404).json(errorEnvelope('not_found', 'フォルダが見つかりません。'))
    return
  }
  res.status(204).end()
})

// ── フォルダ配下のフォーム（§9-6）──
foldersRouter.get('/folders/:uid/forms', (req, res) => {
  const state = getState()
  const folder = state.folders.find((f) => f.uid === req.params.uid)
  const forms = state.forms.filter((f) => f.folder_id === folder?.id)
  res.json({ forms: applyEmptyState(req, forms) })
})

foldersRouter.get('/folders/:folderUid/forms/:uid', (req, res) => {
  const state = getState()
  const form = state.forms.find((f) => f.uid === req.params.uid)
  if (form === undefined) {
    res.status(404).json(errorEnvelope('not_found', 'フォームが見つかりません。'))
    return
  }
  res.json({ form })
})

foldersRouter.post('/folders/:uid/forms', (req, res) => {
  const name = requireString(req.body, 'name', { maxLength: 100 })
  if (!name.ok) {
    res.status(422).json(errorEnvelope('validation_failed', name.message))
    return
  }
  const state = getState()
  const folder = state.folders.find((f) => f.uid === req.params.uid)
  if (folder === undefined) {
    res.status(404).json(errorEnvelope('not_found', 'フォルダが見つかりません。'))
    return
  }
  const created = {
    id: state.nextId,
    uid: makeUid('form', state.forms.length + 1),
    folder_id: folder.id,
    name: name.value,
    fields: [{ name: 'お名前', type: 'text' as const, required: true }],
  }
  setState((s) => ({ ...s, forms: [...s.forms, created], nextId: s.nextId + 1 }))
  res.status(201).json({ form: created })
})

// ── コンバージョンタグ ──
foldersRouter.get('/folders/:uid/conversion_tags', (req, res) => {
  const state = getState()
  const folder = state.folders.find((f) => f.uid === req.params.uid)
  const tags = state.conversionTags.filter((t) => t.folder_id === folder?.id)
  res.json({ conversion_tags: applyEmptyState(req, tags) })
})

foldersRouter.post('/folders/:uid/conversion_tags', (req, res) => {
  const name = requireString(req.body, 'name', { maxLength: 100 })
  if (!name.ok) {
    res.status(422).json(errorEnvelope('validation_failed', name.message))
    return
  }
  const state = getState()
  const folder = state.folders.find((f) => f.uid === req.params.uid)
  if (folder === undefined) {
    res.status(404).json(errorEnvelope('not_found', 'フォルダが見つかりません。'))
    return
  }
  const created = {
    id: state.nextId,
    uid: makeUid('conversionTag', state.conversionTags.length + 1),
    folder_id: folder.id,
    name: name.value,
    tag_type: optionalString(req.body, 'tag_type') || 'html',
    snippet: '<!-- 合成タグ -->',
  }
  setState((s) => ({ ...s, conversionTags: [...s.conversionTags, created], nextId: s.nextId + 1 }))
  res.status(201).json({ conversion_tag: created })
})

// ── 運用者記事 ──
foldersRouter.get('/folders/:uid/operator_articles', (req, res) => {
  const state = getState()
  const folder = state.folders.find((f) => f.uid === req.params.uid)
  const items = state.operatorArticles.filter((a) => a.folder_id === folder?.id)
  res.json({ operator_articles: applyEmptyState(req, items) })
})

foldersRouter.get('/folders/:folderUid/operator_articles/:uid', (req, res) => {
  const state = getState()
  const item = state.operatorArticles.find((a) => a.uid === req.params.uid)
  if (item === undefined) {
    res.status(404).json(errorEnvelope('not_found', '記事が見つかりません。'))
    return
  }
  res.json({ operator_article: item })
})
