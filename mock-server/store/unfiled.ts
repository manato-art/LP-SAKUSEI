/**
 * 「フォルダなし」をフォルダ配下のAPIで扱うための小さな道具（2026-09-24）。
 * 名前の正本は src/shared/unfiled-folder.ts（画面と同じ名前を使う）。
 */
import { UNFILED_FOLDER_UID } from '../../src/shared/unfiled-folder.ts'
import type { State } from './types.ts'

export { UNFILED_FOLDER_UID }

/**
 * URLのフォルダuidを、ページの folder_id の値へ。
 * `unfiled` は folder_id が null のページ（フォルダを消したページ）。無いフォルダは undefined。
 */
export function folderIdForUid(state: State, folderUid: string): number | null | undefined {
  if (folderUid === UNFILED_FOLDER_UID) return null
  return state.folders.find((f) => f.uid === folderUid)?.id
}

/** folder_id として受け付けてよい値か（null＝フォルダなし・それ以外は実在するフォルダ） */
export function isKnownFolderId(state: State, folderId: number | null): boolean {
  return folderId === null || state.folders.some((f) => f.id === folderId)
}
