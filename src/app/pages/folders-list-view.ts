/**
 * ページ一覧の「絞り込み」と「並び替え」の決まり（DOMを触らない・2026-09-24）。
 *
 * 以前は、配信ステータスのラベルが採取物の「終了以外」のまま動かず、選択肢に「終了以外」が無く、
 * フォルダを切り替えると選んだ絞り込みが行に効いていなかった。「更新順」は押しても何も起きなかった。
 * ラベル・メニュー・行をここの1つの状態から出す。
 */
import { UNFILED_FOLDER_UID } from '../../shared/unfiled-folder.ts'

/** 配信ステータスの絞り込み。'all'／'except_finished'（終了以外）／各ステータスの値 */
export type StatusFilter = 'all' | 'except_finished' | 'prepared' | 'delivered' | 'stopping' | 'finished'

export const STATUS_FILTER_OPTIONS: readonly { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'すべて' },
  { value: 'except_finished', label: '終了以外' },
  { value: 'prepared', label: '準備中' },
  { value: 'delivered', label: '配信中' },
  { value: 'stopping', label: '停止中' },
  { value: 'finished', label: '終了' },
]

export function statusFilterLabel(filter: StatusFilter): string {
  const label = STATUS_FILTER_OPTIONS.find((o) => o.value === filter)?.label ?? 'すべて'
  return `配信ステータス：${label}`
}

export type SortKey = 'updated' | 'created' | 'name' | 'pv' | 'cv'

/** needsMetrics: 一覧の数値（集計期間のPV/CV）が読めてから使える並び */
export const SORT_OPTIONS: readonly { value: SortKey; label: string; needsMetrics: boolean }[] = [
  { value: 'updated', label: '更新順', needsMetrics: false },
  { value: 'created', label: '作成順', needsMetrics: false },
  { value: 'name', label: '名前順', needsMetrics: false },
  { value: 'pv', label: 'PV順', needsMetrics: true },
  { value: 'cv', label: 'CV順', needsMetrics: true },
]

export function sortLabel(key: SortKey): string {
  return SORT_OPTIONS.find((o) => o.value === key)?.label ?? '更新順'
}

/** 並び替え・絞り込みに要る、ページの値だけ */
export interface ListPage {
  uid: string
  title: string
  ad_status: string
  created_at?: number
  updated_at?: number
}

export interface ListFilter {
  status: StatusFilter
  /** ページ名の検索（小文字にしたもの。空なら絞らない） */
  query: string
}

export function isPageVisible(page: ListPage, filter: ListFilter): boolean {
  const statusOk =
    filter.status === 'all'
      ? true
      : filter.status === 'except_finished'
        ? page.ad_status !== 'finished'
        : page.ad_status === filter.status
  const query = filter.query.trim().toLowerCase()
  return statusOk && (query === '' || page.title.toLowerCase().includes(query))
}

/** 新しい配列を返す（元の並びは変えない）。同じ値どうしは元の並びのまま */
export function sortPages<P extends ListPage>(
  pages: readonly P[],
  key: SortKey,
  metrics: ReadonlyMap<string, { pv: number; cv: number }>,
): P[] {
  const byNumberDesc = (pick: (p: P) => number | undefined) => (a: P, b: P): number => {
    const x = pick(a)
    const y = pick(b)
    if (x === undefined && y === undefined) return 0
    if (x === undefined) return 1
    if (y === undefined) return -1
    return y - x
  }
  const compare: Record<SortKey, (a: P, b: P) => number> = {
    updated: byNumberDesc((p) => p.updated_at),
    created: byNumberDesc((p) => p.created_at),
    name: (a, b) => a.title.localeCompare(b.title, 'ja'),
    pv: byNumberDesc((p) => metrics.get(p.uid)?.pv),
    cv: byNumberDesc((p) => metrics.get(p.uid)?.cv),
  }
  return [...pages].sort(compare[key])
}

/**
 * ページ行のボタンの行き先（main.ts のルートと同じ形）。
 * 以前は歯車が main.ts に無い `/ab_tests/:uid/basic_info`（「この画面はまだ作っていません」）へ、
 * ヒートマップがレポートへ飛んでいた。フォルダなしのページは `unfiled` を通す。
 */
export function pageRowRoutes(
  abTestUid: string,
  folderUid: string | null,
): Readonly<Record<'basicInfo' | 'heatmap' | 'report' | 'editor', string>> {
  const folder = folderUid ?? UNFILED_FOLDER_UID
  return {
    basicInfo: `#/folders/${folder}/ab_tests/${abTestUid}/edit`,
    heatmap: `#/ab_tests/${abTestUid}/articles/htmls/heatmaps/comparisons`,
    report: `#/ab_tests/${abTestUid}/reports`,
    editor: `#/ab_tests/${abTestUid}/articles`,
  }
}
