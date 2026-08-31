/**
 * ヒートマップ画面の並び替え（純粋関数）。
 *
 * `heatmap.ts` は `main.ts`（＝起動時に描画を始める）を import するため node のテストから読めない。
 * 判断のロジックだけをここに切り出してテスト可能にしている（共通指示 §5）。
 */
import type { ReportVersionRow } from '../api.ts'

/** 採取した並び替え `<select>` の option value */
export const HEATMAP_SORT_KEYS = ['pv', 'click', 'ctr', 'cv', 'cvr'] as const

export type HeatmapSortKey = (typeof HEATMAP_SORT_KEYS)[number]

/**
 * 多い順に並べ替える。
 * `ctr` は `mock-server/store/metrics.ts` の恒等式（企画書 §10-5）に計算式が無いので
 * **並べ替えず null を返す**（勝手に定義しない）。
 * 入力配列は書き換えない（§12 イミュータブル）。
 */
export function sortVersions(
  rows: readonly ReportVersionRow[],
  key: HeatmapSortKey,
): readonly ReportVersionRow[] | null {
  if (key === 'ctr') return null
  const value = (row: ReportVersionRow): number => {
    if (key === 'pv') return row.pv
    if (key === 'click') return row.click
    if (key === 'cv') return row.cv
    return row.cvr ?? -1
  }
  return [...rows].sort((a, b) => value(b) - value(a))
}
