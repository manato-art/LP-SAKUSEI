/**
 * 一括タグ設定 API（実SB「ツール>一括タグ」= /teams/tags）。
 * チーム単位の一括タグ設定を CRUD する。配信への適用は delivery.ts が bulkTagsForFolder で行う。
 */
import { Router } from 'express'
import { currentTeamId } from '../store/current-team.ts'
import { getState, setState } from '../store/store.ts'
import { errorEnvelope } from '../lib/envelope.ts'
import { createBulkTag, deleteBulkTag, listBulkTags, updateBulkTag } from '../store/bulk-tags.ts'
import type { BulkTagSetting } from '../store/types.ts'

export const bulkTagsRouter: Router = Router()

function serialize(t: BulkTagSetting): Record<string, unknown> {
  return {
    uid: t.uid,
    name: t.name,
    team_wide: t.team_wide,
    folder_group_ids: t.folder_group_ids,
    folder_ids: t.folder_ids,
    asp_account_id: t.asp_account_id,
    cv_condition: t.cv_condition,
    noindex: t.noindex,
    head_js: t.head_js,
    body_js: t.body_js,
    created_at: t.created_at,
    updated_at: t.updated_at,
  }
}

bulkTagsRouter.get('/bulk_tags', (_req, res) => {
  const teamId = currentTeamId(getState())
  res.json({ bulk_tags: listBulkTags(getState(), teamId).map(serialize) })
})

bulkTagsRouter.post('/bulk_tags', (_req, res) => {
  const teamId = currentTeamId(getState())
  let created: BulkTagSetting | null = null
  setState((state) => {
    const out = createBulkTag(state, teamId)
    created = out.tag
    return out.state
  })
  res.json({ bulk_tag: created !== null ? serialize(created) : null })
})

bulkTagsRouter.patch('/bulk_tags/:uid', (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>
  const patch: Parameters<typeof updateBulkTag>[2] = {}
  if (typeof body['name'] === 'string') patch.name = body['name']
  if (typeof body['team_wide'] === 'boolean') patch.team_wide = body['team_wide']
  if (Array.isArray(body['folder_group_ids'])) patch.folder_group_ids = (body['folder_group_ids'] as number[]).filter((n) => typeof n === 'number')
  if (Array.isArray(body['folder_ids'])) patch.folder_ids = (body['folder_ids'] as number[]).filter((n) => typeof n === 'number')
  if (body['asp_account_id'] === null || typeof body['asp_account_id'] === 'number') patch.asp_account_id = body['asp_account_id'] as number | null
  if (body['cv_condition'] === null || typeof body['cv_condition'] === 'string') patch.cv_condition = body['cv_condition'] as string | null
  if (typeof body['noindex'] === 'boolean') patch.noindex = body['noindex']
  if (typeof body['head_js'] === 'string') patch.head_js = body['head_js']
  if (typeof body['body_js'] === 'string') patch.body_js = body['body_js']

  let updated: BulkTagSetting | null = null
  setState((state) => {
    const out = updateBulkTag(state, req.params.uid, patch)
    updated = out.tag
    return out.state
  })
  if (updated === null) {
    res.status(404).json(errorEnvelope('not_found', '一括タグ設定が見つかりません。'))
    return
  }
  res.json({ bulk_tag: serialize(updated) })
})

bulkTagsRouter.delete('/bulk_tags/:uid', (req, res) => {
  let deleted = false
  setState((state) => {
    const out = deleteBulkTag(state, req.params.uid)
    deleted = out.deleted
    return out.state
  })
  if (!deleted) {
    res.status(404).json(errorEnvelope('not_found', '一括タグ設定が見つかりません。'))
    return
  }
  res.json({ ok: true })
})
