/**
 * Version系（企画書 §9-1[2][4]・§10-3）。LPエディタの編集・公開の実体。
 * 配信割合の更新 / Version追加 / LP(html,css)保存 / 公開 が実際に状態を変える（§10-9）。
 */
import { Router } from 'express'
import { currentTeamId } from '../store/current-team.ts'
import {
  addVersion,
  archiveVersion,
  unarchiveVersion,
  deleteVersion,
  duplicateVersion,
  duplicateVersionToArticle,
  setDeviceTargets,
  setVersionTargeting,
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

/** 別のbeyondページ（記事）へ複製（指示⑮） */
versionsRouter.post('/versions/:uid/duplicate_to', (req, res) => {
  const targetArticleUid = optionalString(req.body, 'target_article_uid')
  if (targetArticleUid === '') {
    res.status(422).json(errorEnvelope('validation_failed', '複製先のbeyondページを選んでください。'))
    return
  }
  let created: Version | null = null
  let reason: string | undefined
  setState((state) => {
    const out = duplicateVersionToArticle(state, req.params.uid, targetArticleUid)
    created = out.version
    reason = out.reason
    return out.state
  })
  if (created === null) {
    const msg = reason === 'target-notfound' ? '複製先のbeyondページが見つかりません。' : 'Versionが見つかりません。'
    res.status(404).json(errorEnvelope('not_found', msg))
    return
  }
  res.status(201).json({ version: serializeVersion(created) })
})

/** Versionをアーカイブする（一覧の「アーカイブ」タブへ移す） */
versionsRouter.post('/versions/:uid/archive', (req, res) => {
  let archived: Version | null = null
  let reason: string | undefined
  setState((state) => {
    const out = archiveVersion(state, req.params.uid)
    archived = out.version
    reason = out.reason
    return out.state
  })
  if (archived === null) {
    if (reason === 'need-active') {
      res
        .status(422)
        .json(errorEnvelope('unprocessable', '配信割合が1以上のVersionが1つ以上必要です。'))
      return
    }
    res.status(404).json(errorEnvelope('not_found', 'Versionが見つかりません。'))
    return
  }
  res.json({ version: serializeVersion(archived) })
})

/** アーカイブ解除（アーカイブ一覧からの復元・指示⑮） */
versionsRouter.post('/versions/:uid/unarchive', (req, res) => {
  let restored: Version | null = null
  setState((state) => {
    const out = unarchiveVersion(state, req.params.uid)
    restored = out.version
    return out.state
  })
  if (restored === null) {
    res.status(404).json(errorEnvelope('not_found', 'Versionが見つかりません。'))
    return
  }
  res.json({ version: serializeVersion(restored) })
})

/** デバイス別出し分け（Versionのデバイスごと配信ON/OFF）を更新する */
versionsRouter.patch('/versions/:uid/device_targets', (req, res) => {
  const body = req.body as { sp?: unknown; tablet?: unknown; pc?: unknown }
  const targets = {
    sp: body.sp !== false,
    tablet: body.tablet !== false,
    pc: body.pc !== false,
  }
  let updated: Version | null = null
  setState((state) => {
    const out = setDeviceTargets(state, req.params.uid, targets)
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
 * 流入元別/モバイルOS別/キャリア別/時間別/日付別 の版ごと設定を更新する。
 * body に含まれた項目だけ上書きする（部分更新）。
 */
versionsRouter.patch('/versions/:uid/targeting', (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>
  const patch: Parameters<typeof setVersionTargeting>[2] = {}
  if (Array.isArray(body['param_rules'])) patch.param_rules = body['param_rules'] as never
  if (Array.isArray(body['time_ranges'])) patch.time_ranges = body['time_ranges'] as never
  if (Array.isArray(body['date_periods'])) patch.date_periods = body['date_periods'] as never
  if (body['os_targets'] === null || typeof body['os_targets'] === 'object') {
    patch.os_targets = body['os_targets'] as never
  }
  if (body['carrier_targets'] === null || typeof body['carrier_targets'] === 'object') {
    patch.carrier_targets = body['carrier_targets'] as never
  }
  let updated: Version | null = null
  setState((state) => {
    const out = setVersionTargeting(state, req.params.uid, patch)
    updated = out.version
    return out.state
  })
  if (updated === null) {
    res.status(404).json(errorEnvelope('not_found', 'Versionが見つかりません。'))
    return
  }
  res.json({ version: serializeVersion(updated) })
})

/** LP保存（コード編集の保存・§9-1[4]） */
versionsRouter.put('/versions/:uid', (req, res) => {
  try {
    const html = optionalString(req.body, 'html')
    const css = optionalString(req.body, 'css')
    const name = optionalString(req.body, 'name')
    console.log(`[versions] PUT /versions/${req.params.uid} html=${html.length}bytes css=${css.length}bytes name="${name}"`)
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
      console.error(`[versions] PUT /versions/${req.params.uid} → 404: UID not found`)
      res.status(404).json(errorEnvelope('not_found', 'Versionが見つかりません。'))
      return
    }
    res.json({ version: serializeVersion(updated) })
  } catch (err) {
    console.error(`[versions] PUT /versions/${req.params.uid} → 500:`, (err as Error).message, (err as Error).stack)
    res.status(500).json(errorEnvelope('internal_server_error', `保存エラー: ${(err as Error).message}`))
  }
})

/**
 * 配信割合の更新（§9-1[2]）。
 * 0-100 の範囲外は 422。合計が100%でない場合はエラーにせず warning を返す（保存は通す）。
 * **1〜2バージョン時は自動調整**: アクティブなVersionが2つなら、片方を変えると
 * もう片方が `100 - 新値` に自動で追従し、合計100%を保つ。
 */
versionsRouter.patch('/versions/:uid/distribution', (req, res) => {
  const ratio = validateRatio(optionalNumber(req.body, 'distribution_ratio'))
  if (!ratio.ok) {
    res.status(422).json(errorEnvelope('validation_failed', ratio.message))
    return
  }
  let updated: Version | null = null
  const adjustedSiblings: Version[] = []
  setState((state) => {
    const out = updateVersion(state, req.params.uid, { distribution_ratio: ratio.value })
    updated = out.version
    let nextState = out.state
    // 2バージョン時: もう片方を自動調整して合計100%にする
    if (updated !== null) {
      const active = nextState.versions.filter(
        (v) => v.article_id === updated!.article_id && !v.archived,
      )
      if (active.length === 2) {
        const other = active.find((v) => v.uid !== updated!.uid)
        if (other !== undefined) {
          const otherRatio = Math.max(0, Math.min(100, 100 - ratio.value))
          const out2 = updateVersion(nextState, other.uid, { distribution_ratio: otherRatio })
          nextState = out2.state
          if (out2.version !== null) adjustedSiblings.push(out2.version)
        }
      }
    }
    return nextState
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
    adjusted_siblings: adjustedSiblings.map((v) => ({
      uid: v.uid,
      distribution_ratio: v.distribution_ratio,
    })),
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
