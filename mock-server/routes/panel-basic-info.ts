/**
 * 「基本情報」タブ（`/folders/:folder_uid/ab_tests/:ab_test_uid/edit`）のモックAPI。
 *
 * エンドポイント名は**実機が実際に叩いていたもの**を使う
 * （`capture/clean/folders__UID__ab_tests__UID__edit/default/api-urls.json` の実測）:
 *
 *   GET  /ab_tests/:uid/edit                 … フォームの初期値
 *   GET  /medias                             … 媒体ロスター
 *   GET  /affiliate_service_providers        … 計測ツール・ASPロスター
 *
 * 保存は採取時に押していないため未観測。Railsの `edit` に対応する
 *   PUT  /ab_tests/:uid
 * を使う（＝既存の同エンドポイントを、部分更新できるように置き換えたもの）。
 */
import { Router } from 'express'
import { ASP_ROSTER } from '../store/catalog.ts'
import { errorEnvelope } from '../lib/envelope.ts'
import { applyEmptyState } from '../lib/mock-state.ts'
import { serializeAbTest } from '../lib/serialize.ts'
import { mergeConversionSetting, parseAbTestPatch } from '../store/ab-test-patch.ts'
import { updateAbTest } from '../store/actions.ts'
import { getState, setState } from '../store/store.ts'
import type { AbTest } from '../store/types.ts'

export const basicInfoRouter: Router = Router()

const NOT_FOUND = errorEnvelope('not_found', 'beyondページが見つかりません。')

basicInfoRouter.get('/ab_tests/:uid/edit', (req, res) => {
  const state = getState()
  const abTest = state.abTests.find((t) => t.uid === req.params.uid)
  if (abTest === undefined) {
    res.status(404).json(NOT_FOUND)
    return
  }
  res.json({ ab_test: serializeAbTest(state, abTest) })
})

/** 媒体ロスター。実機のパスは `/medias`（`/teams/media` とは別物） */
basicInfoRouter.get('/medias', (req, res) => {
  res.json({ medias: applyEmptyState(req, getState().media) })
})

/**
 * 計測ツール・ASPロスター。
 * 実物のレスポンス形状は未採取のため、ストアが持つ形（名前の配列）をそのまま返す。
 */
basicInfoRouter.get('/affiliate_service_providers', (req, res) => {
  res.json({ affiliate_service_providers: applyEmptyState(req, ASP_ROSTER) })
})

basicInfoRouter.put('/ab_tests/:uid', (req, res) => {
  const current = getState().abTests.find((t) => t.uid === req.params.uid)
  if (current === undefined) {
    res.status(404).json(NOT_FOUND)
    return
  }
  const parsed = parseAbTestPatch(req.body)
  if (!parsed.ok) {
    res.status(422).json(errorEnvelope('validation_failed', parsed.message))
    return
  }
  // 実機の「編集タイプ」は disabled で「後から変更できません」。ここでも受け付けない。
  const patch = mergeConversionSetting(current, parsed.value)

  let updated: AbTest | null = null
  setState((state) => {
    const out = updateAbTest(state, req.params.uid, patch)
    updated = out.abTest
    return out.state
  })
  if (updated === null) {
    res.status(404).json(NOT_FOUND)
    return
  }
  res.json({ ab_test: serializeAbTest(getState(), updated) })
})
