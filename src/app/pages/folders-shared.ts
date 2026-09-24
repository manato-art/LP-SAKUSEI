/**
 * フォルダ一覧画面でファイルをまたいで共有するもの（folders.ts から分離）。
 *
 * 一覧・詳細パネルの両方が見るので、folders.ts に置いたままだと import が循環する。
 */
import type { AbTest, Folder, RelationCounts } from '../api.ts'

export interface PageContext {
  folders: readonly Folder[]
  folder: Folder | null
  /** URLで選んでいるフォルダ（`unfiled`＝フォルダなし）。未選択は null */
  folderUid: string | null
  abTests: readonly AbTest[]
  /** 行のアイコン・右パネルの件数（relation_counts API）。取れなかったら null（「-」で出す） */
  relationCounts: readonly RelationCounts[] | null
}
/** 配信ステータスの表示名（正本は `mock-server/store/types.ts`） */
export const AD_STATUS_LABELS: Readonly<Record<string, string>> = {
  prepared: '準備中',
  delivered: '配信中',
  stopping: '停止中',
  finished: '終了',
}
