/**
 * 一括タグ設定（/teams/tags）のストア操作。
 * 範囲(チーム/フォルダグループ/フォルダ)で対象フォルダを決め、配信ページへ head/body JS・
 * noindex をまとめて適用する。個別タグ(Articleのhtml_tags)とは別レイヤー。
 */
import type { BulkTagSetting, Folder, State } from './types.ts'

let nextId = 1
function genUid(): string {
  return `BULKTAG_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function nowTs(): number {
  return Date.now()
}

/** チームの一括タグ設定一覧（新しい順） */
export function listBulkTags(state: State, teamId: number): BulkTagSetting[] {
  return state.bulkTags.filter((t) => t.team_id === teamId).slice().sort((a, b) => b.created_at - a.created_at)
}

/** 空の一括タグ設定を1件作る（実SBの「＋タグ設定を追加」相当） */
export function createBulkTag(state: State, teamId: number): { state: State; tag: BulkTagSetting } {
  const now = nowTs()
  const tag: BulkTagSetting = {
    id: nextId++,
    uid: genUid(),
    team_id: teamId,
    name: '',
    team_wide: false,
    folder_group_ids: [],
    folder_ids: [],
    asp_account_id: null,
    cv_condition: null,
    noindex: false,
    head_js: '',
    body_js: '',
    created_at: now,
    updated_at: now,
  }
  return { state: { ...state, bulkTags: [...state.bulkTags, tag] }, tag }
}

/** 一括タグ設定を部分更新する */
export function updateBulkTag(
  state: State,
  uid: string,
  patch: Partial<Omit<BulkTagSetting, 'id' | 'uid' | 'team_id' | 'created_at'>>,
): { state: State; tag: BulkTagSetting | null } {
  const target = state.bulkTags.find((t) => t.uid === uid)
  if (target === undefined) return { state, tag: null }
  const updated: BulkTagSetting = { ...target, ...patch, updated_at: nowTs() }
  return {
    state: { ...state, bulkTags: state.bulkTags.map((t) => (t.uid === uid ? updated : t)) },
    tag: updated,
  }
}

/** 一括タグ設定を削除する */
export function deleteBulkTag(state: State, uid: string): { state: State; deleted: boolean } {
  const exists = state.bulkTags.some((t) => t.uid === uid)
  return { state: { ...state, bulkTags: state.bulkTags.filter((t) => t.uid !== uid) }, deleted: exists }
}

/** そのフォルダ(id)の祖先フォルダ id をすべて返す（フォルダグループ判定用） */
function ancestorFolderIds(folders: readonly Folder[], folderId: number): number[] {
  const byId = new Map(folders.map((f) => [f.id, f]))
  const out: number[] = []
  let cur = byId.get(folderId)?.parent_id ?? null
  const guard = new Set<number>()
  while (cur !== null && !guard.has(cur)) {
    guard.add(cur)
    out.push(cur)
    cur = byId.get(cur)?.parent_id ?? null
  }
  return out
}

/**
 * 指定フォルダの配信ページに適用される一括タグ設定を返す。
 * 適用条件: team_wide（全対象） / folder_ids に該当 / folder_group_ids に自身または祖先が該当。
 */
export function bulkTagsForFolder(
  state: State,
  teamId: number,
  folderId: number | null,
): BulkTagSetting[] {
  const ancestors = folderId === null ? [] : ancestorFolderIds(state.folders, folderId)
  return state.bulkTags.filter((t) => {
    if (t.team_id !== teamId) return false
    if (t.team_wide) return true
    if (folderId !== null && t.folder_ids.includes(folderId)) return true
    // フォルダグループ = 親フォルダ。自身または祖先が group に含まれれば対象
    if (folderId !== null && t.folder_group_ids.includes(folderId)) return true
    if (ancestors.some((a) => t.folder_group_ids.includes(a))) return true
    return false
  })
}
