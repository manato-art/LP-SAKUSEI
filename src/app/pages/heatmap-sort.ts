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
 * 多い順に並べ替える。入力配列は書き換えない（§12 イミュータブル）。
 *
 * 2026-09-15: `ctr` も並べ替えるようにした。列見出しには CTR の数字を出しているのに
 * 並べ替えだけ拒んでいて、画面の中で矛盾していた（採取した実DOMの option も他と同格）。
 * 値はモックが `click / pv` で返しているものをそのまま使う。
 * 未知のキー（空文字など）は並べ替えずそのまま返す。
 */
export function sortVersions(
  rows: readonly ReportVersionRow[],
  key: HeatmapSortKey,
): readonly ReportVersionRow[] | null {
  if (!HEATMAP_SORT_KEYS.includes(key)) return null
  const value = (row: ReportVersionRow): number => {
    if (key === 'pv') return row.pv
    if (key === 'click') return row.click
    if (key === 'cv') return row.cv
    if (key === 'ctr') return row.ctr ?? -1
    return row.cvr ?? -1
  }
  return [...rows].sort((a, b) => value(b) - value(a))
}
