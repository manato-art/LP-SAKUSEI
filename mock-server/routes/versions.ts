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
import { externalizeDataUrls } from '../lib/uploads.ts'
import { editorSessionOf } from '../lib/editor-session.ts'
import { activeVersionsOf, applyRatios, balanceAfterChange } from '../store/ratio-balance.ts'
import { unwrapLinksInHtml } from '../../src/shared/link-html.ts'
import { renderPreviewDocument } from './delivery-preview.ts'
import { buildVisitorContext } from './delivery-targeting.ts'

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

/**
 * 比較モードのプレビュー（2026-09-24 点検36）。まだ保存していない本文や、履歴の本文を、
 * プレビュー（/preview）と同じ見た目のページにして返す（比較モードだけ別の組み立てで、配信と見た目が違っていた）
 */
versionsRouter.post('/versions/:uid/preview_document', (req, res) => {
  const state = getState()
  const version = state.versions.find((v) => v.uid === req.params.uid)
  const html = optionalString(req.body, 'html')
  const document =
    version === undefined
      ? null
      : renderPreviewDocument(state, version, { html: html === '' ? undefined : html, bare: true, device: buildVisitorContext(req).device })
  if (document === null) {
    res.status(404).json(errorEnvelope('not_found', 'Versionが見つかりません。'))
    return
  }
  res.json({ document })
})

/** Version複製の「リンク設定」（2026-09-24 点検13: 以前は受け取るだけで、どれを選んでもリンクが残っていた） */
const LINK_MODES = {
  leave_links: null,
  remove_links: 'all',
  remove_tracking_links: 'tracking',
} as const

/** Version複製（元Versionの直後に新Versionを作る） */
versionsRouter.post('/versions/:uid/duplicate', (req, res) => {
  const mode = optionalString(req.body, 'link_mode') || 'leave_links'
  if (!(mode in LINK_MODES)) {
    res.status(422).json(errorEnvelope('validation_failed', 'リンク設定の指定が正しくありません。'))
    return
  }
  const unwrap = LINK_MODES[mode as keyof typeof LINK_MODES]
  let created: Version | null = null
  setState((state) => {
    const out = duplicateVersion(state, req.params.uid, unwrap === null ? undefined : (html) => unwrapLinksInHtml(html, unwrap))
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

/**
 * LP保存（コード編集の保存・§9-1[4]）。
 *
 * `base_revision`（エディタが開いたとき・最後に保存したときの中身の版）を添えると、
 * そのあと別の人・別のタブが中身を保存していたら 409 で止め、相手の中身を返す（2026-09-24）。
 * 自分のタブ（X-Editor-Session が同じ）で進めたぶんは止めない。添えなければ今までどおり上書きする。
 */
versionsRouter.put('/versions/:uid', (req, res) => {
  try {
    // 埋め込み画像（data URL）は別ファイルにしてから保存する（保存データとLPを軽くする・lib/uploads.ts）
    const html = externalizeDataUrls(optionalString(req.body, 'html')).text
    const css = externalizeDataUrls(optionalString(req.body, 'css')).text
    const name = optionalString(req.body, 'name')
    const writer = editorSessionOf(req)
    const baseRevision = optionalNumber(req.body, 'base_revision')
    console.log(`[versions] PUT /versions/${req.params.uid} html=${html.length}bytes css=${css.length}bytes name="${name}"`)
    const current = getState().versions.find((v) => v.uid === req.params.uid)
    if (
      current !== undefined &&
      baseRevision !== undefined &&
      (html !== '' || css !== '') &&
      (current.content_revision ?? 0) !== baseRevision &&
      (current.content_writer ?? '') !== writer
    ) {
      res.status(409).json({
        ...errorEnvelope('conflict', 'ほかの人（または別のタブ）が、このVersionを先に保存しました。'),
        version: serializeVersion(current),
      })
      return
    }
    let updated: Version | null = null
    setState((state) => {
      const out = updateVersion(
        state,
        req.params.uid,
        {
          ...(html !== '' ? { html } : {}),
          ...(css !== '' ? { css } : {}),
          ...(name !== '' ? { name } : {}),
        },
        writer,
      )
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
    // 中の事情は記録にだけ残す（画面へは出さない）
    console.error(`[versions] PUT /versions/${req.params.uid} → 500:`, (err as Error).message, (err as Error).stack)
    res.status(500).json(errorEnvelope('internal_server_error', '保存できませんでした。時間をおいてもう一度お試しください。'))
  }
})

/**
 * 配信割合の更新（§9-1[2]）。0-100 の範囲外は 422。
 * 合計はいつも100%（2026-09-24・本人「合計で100%にして」）: ほかのVersionを今の比のまま分け直す
 * （以前は2つのときだけ「もう片方＝100−その値」で、3つ以上は合計がずれたまま保存していた）。
 * Versionが1つなら100%のまま。分け直したVersionは adjusted_siblings で返す（画面のカードをそろえるため）。
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
    const target = state.versions.find((v) => v.uid === req.params.uid)
    if (target === undefined) return state
    if (target.archived === true) {
      // アーカイブ済みは配信に入らないので、そのまま書く
      const out = updateVersion(state, target.uid, { distribution_ratio: ratio.value })
      updated = out.version
      return out.state
    }
    const active = activeVersionsOf(state, target.article_id)
    const next = balanceAfterChange(
      active.map((v) => ({ uid: v.uid, ratio: v.distribution_ratio })),
      target.uid,
      ratio.value,
    )
    const out = applyRatios(state, next)
    const stamped = updateVersion(out.state, target.uid, {})
    updated = stamped.version
    adjustedSiblings.push(...out.changed.filter((v) => v.uid !== target.uid))
    return stamped.state
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
  let reason: string | undefined
  setState((state) => {
    const out = deleteVersion(state, req.params.uid)
    deleted = out.deleted
    reason = out.reason
    return out.state
  })
  if (reason === 'last-version') {
    res.status(422).json(errorEnvelope('unprocessable', 'このページのVersionが1つだけなので削除できません。'))
    return
  }
  if (reason === 'need-active') {
    res
      .status(422)
      .json(
        errorEnvelope(
          'unprocessable',
          '配信割合が1以上のVersionがほかに無いため削除できません。先に別のVersionの配信割合を上げてください。',
        ),
      )
    return
  }
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
