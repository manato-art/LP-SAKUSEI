/**
 * フォルダ一覧画面でファイルをまたいで共有するもの（folders.ts から分離）。
 *
 * 一覧・詳細パネルの両方が見るので、folders.ts に置いたままだと import が循環する。
 */
import type { AbTest, Folder, RelationCounts } from '../api.ts'

export interface PageContext {
  folders: readonly Folder[]
  folder: Folder | null
  abTests: readonly AbTest[]
  /** Version数/ポップアップ数/中間ページ数（relation_counts API） */
  relationCounts: readonly RelationCounts[]
}
/** 配信ステータスの表示名（正本は `mock-server/store/types.ts`） */
export const AD_STATUS_LABELS: Readonly<Record<string, string>> = {
  prepared: '準備中',
  delivered: '配信中',
  stopping: '停止中',
  finished: '終了',
}
