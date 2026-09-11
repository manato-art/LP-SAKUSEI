/**
 * 中間ページタグ設定のAPI（本体: HEAD / BODY を押すとタグが1件増え、タグ名と JavaScript は入力するとその場で保存、1件ずつ削除）。
 * 本体のURLは `/api/v1/ab_tests/:uid/redirect_pages/:id/tags/:tag_id`。クローンは中間ページ設定の保存と同じく、中間ページの uid で受ける。
 */
import { Router } from 'express'
import { getState, setState } from '../store/store.ts'
import { findUnclosedTag } from '../store/html-tags.ts'
import {
  addRedirectPageTag,
  deleteRedirectPageTag,
  redirectPageTags,
  updateRedirectPageTag,
} from '../store/redirect-page-tags.ts'
import { errorEnvelope } from '../lib/envelope.ts'
import { optionalString } from '../lib/validate.ts'

export const redirectPageTagsRouter: Router = Router()

/** 記事のタグ設定と同じ上限（貼り付けたタグを丸ごと受ける） */
const MAX_TAG_BODY_LENGTH = 20000

redirectPageTagsRouter.post('/redirect_pages/:uid/tags', (req, res) => {
  const property = optionalString(req.body, 'document_property')
  if (property !== 'head' && property !== 'body') {
    res.status(422).json(errorEnvelope('validation_failed', 'document_propertyは head または body を指定してください。'))
    return
  }
  const out = addRedirectPageTag(getState(), req.params.uid, property)
  if (out.tag === null) {
    res.status(404).json(errorEnvelope('not_found', '中間ページが見つかりません。'))
    return
  }
  setState(() => out.state)
  res.status(201).json({ tag: out.tag })
})

redirectPageTagsRouter.patch('/redirect_pages/:uid/tags/:id', (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>
  const name = typeof body['name'] === 'string' ? body['name'] : undefined
  const script = typeof body['body'] === 'string' ? body['body'] : undefined
  const tagId = Number(req.params.id)
  const page = getState().redirectPages.find((p) => p.uid === req.params.uid)
  const current = page === undefined ? undefined : redirectPageTags(page).find((t) => t.id === tagId)
  if (current === undefined) {
    res.status(404).json(errorEnvelope('not_found', 'タグが見つかりません。'))
    return
  }
  if (script !== undefined && script.length > MAX_TAG_BODY_LENGTH) {
    res.status(422).json(errorEnvelope('validation_failed', `タグは${MAX_TAG_BODY_LENGTH}文字以内で入力してください。`))
    return
  }
  // 閉じていないタグは、中間ページの移動のスクリプトまで壊すので保存しない（記事のタグ設定と同じ検査）
  if (script !== undefined && findUnclosedTag(script) !== null) {
    res.status(422).json(errorEnvelope(`invalid_script_${current.document_property}`, 'タグが正しく閉じられてません。'))
    return
  }
  const out = updateRedirectPageTag(getState(), req.params.uid, tagId, {
    ...(name !== undefined ? { name } : {}),
    ...(script !== undefined ? { body: script } : {}),
  })
  if (out.tag === null) {
    res.status(404).json(errorEnvelope('not_found', 'タグが見つかりません。'))
    return
  }
  setState(() => out.state)
  res.json({ tag: out.tag })
})

redirectPageTagsRouter.delete('/redirect_pages/:uid/tags/:id', (req, res) => {
  const out = deleteRedirectPageTag(getState(), req.params.uid, Number(req.params.id))
  if (!out.deleted) {
    res.status(404).json(errorEnvelope('not_found', 'タグが見つかりません。'))
    return
  }
  setState(() => out.state)
  res.status(204).end()
})
