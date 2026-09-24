/**
 * ポップアップ画面の「このVersionで配信」（2026-09-24）。
 *
 * Version ごとに、そのVersionを配信するときにポップアップ（離脱防止・表示直後・追従型）を出すかを決める。
 * 保存先は Version の popup_delivery（未設定は true＝今までどおり出す）。配信側は delivery-popups.ts が見る。
 *
 *   GET /ab_tests/:uid/popup_delivery              … このLPの Version（アーカイブ済みは除く）と、それぞれのON/OFF
 *   PUT /ab_tests/:uid/popup_delivery/:version_uid  … { enabled: boolean } でON/OFFを変える
 */
import { Router } from 'express'
import { getState, setState } from '../store/store.ts'
import { errorEnvelope } from '../lib/envelope.ts'
import type { State, Version } from '../store/types.ts'
import { findAbTest, notFound } from './ab-tests-shared.ts'

export const popupDeliveryRouter: Router = Router()

interface PopupDeliveryRow {
  uid: string
  name: string
  /** 何番目のステップか（1始まり） */
  step: number
  distribution_ratio: number
  popup_delivery: boolean
}

/** このLPの Version をステップ順に並べる（アーカイブ済みのステップ・Versionは除く） */
function versionsOfPage(state: State, abTestId: number): readonly { version: Version; step: number }[] {
  const articles = state.articles.filter((a) => a.ab_test_id === abTestId && !a.archived)
  return articles.flatMap((article, i) =>
    state.versions
      .filter((v) => v.article_id === article.id && v.archived !== true)
      .map((version) => ({ version, step: i + 1 })),
  )
}

function row(version: Version, step: number): PopupDeliveryRow {
  return {
    uid: version.uid,
    name: version.name,
    step,
    distribution_ratio: version.distribution_ratio,
    popup_delivery: version.popup_delivery !== false,
  }
}

popupDeliveryRouter.get('/ab_tests/:uid/popup_delivery', (req, res) => {
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  res.json({ versions: versionsOfPage(state, abTest.id).map((v) => row(v.version, v.step)) })
})

popupDeliveryRouter.put('/ab_tests/:uid/popup_delivery/:version_uid', (req, res) => {
  const enabled = (req.body as { enabled?: unknown } | undefined)?.enabled
  if (typeof enabled !== 'boolean') {
    res.status(422).json(errorEnvelope('validation_failed', 'ON/OFF を指定してください。'))
    return
  }
  const state = getState()
  const abTest = findAbTest(state, req.params.uid)
  if (abTest === undefined) return notFound(res, 'beyondページが見つかりません。')
  // このLPの Version だけを変えられる（別のLPの Version の uid を渡されても変えない）
  const found = versionsOfPage(state, abTest.id).find((v) => v.version.uid === req.params.version_uid)
  if (found === undefined) return notFound(res, 'Versionが見つかりません。')
  const updated: Version = { ...found.version, popup_delivery: enabled }
  setState((s) => ({
    ...s,
    versions: s.versions.map((v) => (v.id === updated.id ? { ...v, popup_delivery: enabled } : v)),
  }))
  res.json({ version: row(updated, found.step) })
})
