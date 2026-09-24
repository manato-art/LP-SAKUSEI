/**
 * 審査の一覧の並び替え（純粋関数）。「↑↓」で昇順と降順を入れ替える。
 * 並びはページ名 → Version（ポップアップ）名。審査対象の画面（フォルダ名順）と同じく名前で並べる。
 */
import type { InspectionEntry } from '../api.ts'

export function sortInspectionEntries(entries: readonly InspectionEntry[], asc: boolean): InspectionEntry[] {
  const dir = asc ? 1 : -1
  return [...entries].sort(
    (a, b) =>
      dir *
      (a.ab_test_title.localeCompare(b.ab_test_title, 'ja') || a.name.localeCompare(b.name, 'ja', { numeric: true })),
  )
}
