/**
 * 審査のAPI（実SB「ツール > 審査」）。
 *
 * 実物は2画面あり、役割が違う（2026-09-10 に実機で確認）:
 *   /inspections         … 審査そのもの。Version / ポップアップ の2タブ、
 *                          絞り込みチップ すべて / 審査待ち / 審査中 / 承認済 / 非承認、
 *                          左にグループリストとグループにいないフォルダのツリー
 *   /inspections/folders … 「審査対象」。フォルダごとのトグルで、
 *                          どのフォルダを審査に載せるかを決める（ページタイトルも別）
 *
 * 審査対象がONのフォルダのものだけが審査画面に並ぶ。
 * （実際、対象が1つもONでない状態ではツリーの見出しだけが出て中身が空だった）
 */
import { Router } from 'express'
import { getState, setState } from '../store/store.ts'
import { errorEnvelope } from '../lib/envelope.ts'
import { str } from '../lib/query.ts'
import type { InspectionEntry, InspectionStatus, State } from '../store/types.ts'

export const inspectionsRouter: Router = Router()

const STATUSES: readonly InspectionStatus[] = ['waiting', 'reviewing', 'approved', 'rejected']

/** 実物の絞り込みチップの並びとラベル */
export const INSPECTION_STATUS_LABELS: readonly [InspectionStatus, string][] = [
  ['waiting', '審査待ち'],
  ['reviewing', '審査中'],
  ['approved', '承認済'],
  ['rejected', '非承認'],
]

function isStatus(v: string): v is InspectionStatus {
  return (STATUSES as readonly string[]).includes(v)
}

/** 記録が無いものは「審査待ち」（実物も未提出は審査待ちに並ぶ） */
function statusOf(state: State, kind: string, uid: string): InspectionEntry {
  const found = state.inspectionEntries.find((e) => e.kind === kind && e.target_uid === uid)
  return found ?? { kind, target_uid: uid, status: 'waiting', comment: '', updated_at: 0 }
}

/* ── 審査対象（/inspections/folders） ── */

/**
 * フォルダのツリー。実物どおり「グループリスト」と「グループにいないフォルダ」に分ける。
 * クローンのフォルダはグループを持たない（parent_id は常に null）ので、
 * 子を持つフォルダがあればグループとして扱う。
 */
inspectionsRouter.get('/inspections/folders', (_req, res) => {
  const state = getState()
  const parentIds = new Set(
    state.folders.map((f) => f.parent_id).filter((id): id is number => id !== null),
  )
  const row = (f: State['folders'][number]): Record<string, unknown> => ({
    uid: f.uid,
    name: f.name,
    is_favorite: f.is_favorite,
    inspection_target: f.inspection_target === true,
  })
  const groups = state.folders
    .filter((f) => parentIds.has(f.id))
    .map((g) => ({
      ...row(g),
      folders: state.folders.filter((f) => f.parent_id === g.id).map(row),
    }))
  const ungrouped = state.folders
    .filter((f) => f.parent_id === null && !parentIds.has(f.id))
    .map(row)
  res.json({ groups, ungrouped })
})

/** 審査対象のON/OFF */
inspectionsRouter.put('/inspections/folders/:uid', (req, res) => {
  const on = (req.body as { inspection_target?: unknown })?.inspection_target === true
  const found = getState().folders.find((f) => f.uid === req.params.uid)
  if (found === undefined) {
    res.status(404).json(errorEnvelope('not_found', 'フォルダが見つかりません。'))
    return
  }
  setState((s) => ({
    ...s,
    folders: s.folders.map((f) =>
      f.uid === req.params.uid ? { ...f, inspection_target: on } : f,
    ),
  }))
  res.json({ uid: req.params.uid, inspection_target: on })
})

/* ── 審査（/inspections） ── */

/**
 * 審査に並ぶもの。
 * 審査対象がONのフォルダに属する beyondページ の Version（または離脱防止ポップアップ）。
 */
inspectionsRouter.get('/inspections/entries', (req, res) => {
  const kind = str(req.query, 'kind') === 'popup' ? 'popup' : 'version'
  const filter = str(req.query, 'status') ?? 'all'
  const q = (str(req.query, 'q') ?? '').trim()
  const state = getState()

  const targetFolderIds = new Set(
    state.folders.filter((f) => f.inspection_target === true).map((f) => f.id),
  )
  const abTests = state.abTests.filter(
    (t) => t.folder_id !== null && targetFolderIds.has(t.folder_id),
  )

  const rows = abTests.flatMap((t) => {
    const folder = state.folders.find((f) => f.id === t.folder_id)
    const base = { folder_name: folder?.name ?? '', ab_test_uid: t.uid, ab_test_title: t.title }
    if (kind === 'popup') {
      return state.exitPopups
        .filter((p) => p.ab_test_id === t.id)
        .map((p) => ({ ...base, uid: p.uid, name: p.name, ...statusOf(state, 'popup', p.uid) }))
    }
    const articleIds = new Set(
      state.articles.filter((a) => a.ab_test_id === t.id && !a.archived).map((a) => a.id),
    )
    return state.versions
      .filter((v) => articleIds.has(v.article_id) && !v.archived)
      .map((v) => ({ ...base, uid: v.uid, name: v.name, ...statusOf(state, 'version', v.uid) }))
  })

  const filtered = rows
    .filter((r) => filter === 'all' || r.status === filter)
    .filter(
      (r) =>
        q === '' ||
        r.name.includes(q) ||
        r.ab_test_title.includes(q) ||
        r.folder_name.includes(q),
    )

  res.json({
    entries: filtered,
    counts: Object.fromEntries(
      STATUSES.map((s) => [s, rows.filter((r) => r.status === s).length]),
    ),
    total: rows.length,
  })
})

/** 審査の状態を変える（審査待ち → 審査中 → 承認済 / 非承認） */
inspectionsRouter.put('/inspections/entries/:uid', (req, res) => {
  const body = (req.body ?? {}) as { kind?: unknown; status?: unknown; comment?: unknown }
  const kind = body.kind === 'popup' ? 'popup' : 'version'
  const status = typeof body.status === 'string' ? body.status : ''
  if (!isStatus(status)) {
    res.status(422).json(errorEnvelope('invalid', '審査の状態が正しくありません。'))
    return
  }
  const comment = typeof body.comment === 'string' ? body.comment : ''
  const entry: InspectionEntry = {
    kind,
    target_uid: req.params.uid,
    status,
    comment,
    updated_at: Math.floor(Date.now() / 1000),
  }
  setState((s) => {
    const rest = s.inspectionEntries.filter(
      (e) => !(e.kind === kind && e.target_uid === req.params.uid),
    )
    return { ...s, inspectionEntries: [...rest, entry] }
  })
  res.json({ entry })
})
