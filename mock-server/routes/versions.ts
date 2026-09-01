/**
 * Version系（企画書 §9-1[2][4]・§10-3）。LPエディタの編集・公開の実体。
 * 配信割合の更新 / Version追加 / LP(html,css)保存 / 公開 が実際に状態を変える（§10-9）。
 */
import { Router } from 'express'
import { currentTeamId } from '../store/current-team.ts'
import {
  addVersion,
  deleteVersion,
  duplicateVersion,
  publishVersion,
  updateVersion,
} from '../store/actions.ts'
import { getState, setState } from '../store/store.ts'
import { applyEmptyState } from '../lib/mock-state.ts'
import { errorEnvelope } from '../lib/envelope.ts'
import { serializeVersion, serializeVersions } from '../lib/serialize.ts'
import { checkRatioTotal, optionalNumber, optionalString, validateRatio } from '../lib/validate.ts'
import type { State, Version } from '../store/types.ts'

export const versionsRouter: Router = Router()

function siblingsOf(state: State, version: Version): readonly Version[] {
  return state.versions.filter((v) => v.article_id === version.article_id)
}

/** 記事配下のVersion一覧（エディタ左Versionパネルの中身） */
versionsRouter.get('/articles/:uid/versions', (req, res) => {
  const state = getState()
  const article = state.articles.find((a) => a.uid === req.params.uid)
  if (article === undefined) {
    res.status(404).json(errorEnvelope('not_found', '記事が見つかりません。'))
    return
  }
  const versions = state.versions.filter((v) => v.article_id === article.id)
  const total = checkRatioTotal(versions.map((v) => v.distribution_ratio))
  res.json({
    versions: applyEmptyState(req, serializeVersions(versions)),
    distribution_total: total.total,
    distribution_warning: total.warning,
  })
})

/** Version追加（§9-1[2]） */
versionsRouter.post('/articles/:uid/versions', (req, res) => {
  let created: Version | null = null
  setState((state) => {
    const out = addVersion(state, req.params.uid)
    created = out.version
    return out.state
  })
  if (created === null) {
    res.status(404).json(errorEnvelope('not_found', '記事が見つかりません。'))
    return
  }
  res.status(201).json({ version: serializeVersion(created) })
})

/** Version複製（元Versionの直後に新Versionを作る） */
versionsRouter.post('/versions/:uid/duplicate', (req, res) => {
  let created: Version | null = null
  setState((state) => {
    const out = duplicateVersion(state, req.params.uid)
    created = out.version
    return out.state
  })
  if (created === null) {
    res.status(404).json(errorEnvelope('not_found', 'Versionが見つかりません。'))
    return
  }
  res.status(201).json({ version: serializeVersion(created) })
})

/** LP保存（コード編集の保存・§9-1[4]） */
versionsRouter.put('/versions/:uid', (req, res) => {
  const html = optionalString(req.body, 'html')
  const css = optionalString(req.body, 'css')
  const name = optionalString(req.body, 'name')
  let updated: Version | null = null
  setState((state) => {
    const out = updateVersion(state, req.params.uid, {
      ...(html !== '' ? { html } : {}),
      ...(css !== '' ? { css } : {}),
      ...(name !== '' ? { name } : {}),
    })
    updated = out.version
    return out.state
  })
  if (updated === null) {
    res.status(404).json(errorEnvelope('not_found', 'Versionが見つかりません。'))
    return
  }
  res.json({ version: serializeVersion(updated) })
})

/**
 * 配信割合の更新（§9-1[2]）。
 * 0-100 の範囲外は 422。合計が100%でない場合はエラーにせず warning を返す（保存は通す）。
 */
versionsRouter.patch('/versions/:uid/distribution', (req, res) => {
  const ratio = validateRatio(optionalNumber(req.body, 'distribution_ratio'))
  if (!ratio.ok) {
    res.status(422).json(errorEnvelope('validation_failed', ratio.message))
    return
  }
  let updated: Version | null = null
  setState((state) => {
    const out = updateVersion(state, req.params.uid, { distribution_ratio: ratio.value })
    updated = out.version
    return out.state
  })
  if (updated === null) {
    res.status(404).json(errorEnvelope('not_found', 'Versionが見つかりません。'))
    return
  }
  const state = getState()
  const total = checkRatioTotal(siblingsOf(state, updated).map((v) => v.distribution_ratio))
  res.json({
    version: serializeVersion(updated),
    distribution_total: total.total,
    distribution_warning: total.warning,
  })
})

/** 公開（§9-1[4]）。状態バッジ 準備中→公開中。実反映はしない。 */
versionsRouter.post('/versions/:uid/publish', (req, res) => {
  let updated: Version | null = null
  setState((state) => {
    const out = publishVersion(state, req.params.uid)
    updated = out.version
    return out.state
  })
  if (updated === null) {
    res.status(404).json(errorEnvelope('not_found', 'Versionが見つかりません。'))
    return
  }
  res.json({ version: serializeVersion(updated) })
})

versionsRouter.delete('/versions/:uid', (req, res) => {
  let deleted = false
  setState((state) => {
    const out = deleteVersion(state, req.params.uid)
    deleted = out.deleted
    return out.state
  })
  if (!deleted) {
    res.status(404).json(errorEnvelope('not_found', 'Versionが見つかりません。'))
    return
  }
  res.status(204).end()
})

/** プレビュー（§10-3 GET /articles/:uid/previews） */
versionsRouter.get('/articles/:uid/previews', (req, res) => {
  const state = getState()
  const article = state.articles.find((a) => a.uid === req.params.uid)
  if (article === undefined) {
    res.status(404).json(errorEnvelope('not_found', '記事が見つかりません。'))
    return
  }
  const version =
    state.versions.find((v) => v.uid === req.query['version_uid']) ??
    state.versions.find((v) => v.article_id === article.id)
  res.json({ preview: { html: version?.html ?? '', css: version?.css ?? '' } })
})

/** エディタの画像追加が引く画像ライブラリ（§9-7・§10-3） */
versionsRouter.get('/teams/media_assets', (req, res) => {
  const state = getState()
  res.json({ media_assets: applyEmptyState(req, state.mediaAssets) })
})

versionsRouter.post('/teams/media_assets', (req, res) => {
  const state = getState()
  const created = {
    id: state.nextId,
    uid: `ASSET_${String(state.mediaAssets.length + 1).padStart(4, '0')}`,
    team_id: currentTeamId(state),
    url: optionalString(req.body, 'url') || '/capture/assets/placeholder.png',
    width: optionalNumber(req.body, 'width') ?? 600,
    height: optionalNumber(req.body, 'height') ?? 400,
    name: optionalString(req.body, 'name') || 'アップロード画像',
  }
  setState((s) => ({ ...s, mediaAssets: [...s.mediaAssets, created], nextId: s.nextId + 1 }))
  res.status(201).json({ media_asset: created })
})
