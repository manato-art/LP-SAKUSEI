/**
 * ステップ（記事）の名前・色の変更と削除（2026-09-24）。
 *   PATCH  /articles/:uid  { memo?, color? }
 *   DELETE /articles/:uid  （最初のステップは消さない）
 */
import { Router } from 'express'
import { errorEnvelope } from '../lib/envelope.ts'
import { serializeArticle } from '../lib/serialize.ts'
import { STEP_NAME_MAX, deleteArticle, normalizeStepColor, updateArticle } from '../store/article-edit.ts'
import { getState, setState } from '../store/store.ts'
import type { Article } from '../store/types.ts'

export const articlesEditRouter: Router = Router()

articlesEditRouter.patch('/articles/:uid', (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>
  const memo = typeof body['memo'] === 'string' ? body['memo'].trim() : undefined
  if (memo !== undefined && [...memo].length > STEP_NAME_MAX) {
    res.status(422).json(errorEnvelope('validation_failed', `ステップ名は${String(STEP_NAME_MAX)}文字までです。`))
    return
  }
  const color = typeof body['color'] === 'string' ? normalizeStepColor(body['color']) : undefined
  if (color === null) {
    res.status(422).json(errorEnvelope('validation_failed', '色の指定が正しくありません。'))
    return
  }
  let updated: Article | null = null
  setState((state) => {
    const out = updateArticle(state, req.params.uid, { memo, color })
    updated = out.article
    return out.state
  })
  if (updated === null) {
    res.status(404).json(errorEnvelope('not_found', 'ステップが見つかりません。'))
    return
  }
  res.json({ article: serializeArticle(updated) })
})

articlesEditRouter.delete('/articles/:uid', (req, res) => {
  const out = deleteArticle(getState(), req.params.uid)
  if (out.reason === 'first-step') {
    res.status(422).json(errorEnvelope('unprocessable', '最初のステップは、配信URLで最初に開くページなので削除できません。'))
    return
  }
  if (!out.deleted) {
    res.status(404).json(errorEnvelope('not_found', 'ステップが見つかりません。'))
    return
  }
  setState(() => out.state)
  res.status(204).end()
})
