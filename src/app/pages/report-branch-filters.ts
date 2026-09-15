/**
 * Branch Operation の絞り込み（2026-09-15・実物の採取に合わせて追加）。
 *
 * 実物は見出しの「フィルター」ボタンで開く面に、
 *   広告ステータス（値 all）／アーカイブ（except_archived）／端末（0）／
 *   version/sb_article_uid検索／parameter検索
 * が並ぶ（capture/clean/ab_tests__UID__reports/report-settings-modal）。
 * 選択肢の中身はMUIが開いたときだけ描くので採取できていない。
 * 値はクローンが実際に持っているもの（Versionの状態・端末の出し分け設定）を使う。
 */
import type { ReportVersionRow } from '../api.ts'

/** 端末の値。`0` は実物の「全端末」のときの値そのまま。 */
export type DeviceFilter = '0' | 'sp' | 'tablet' | 'pc'

export interface BranchFilter {
  /** `all` ＝ 全ステータス。ほかは Version の状態そのもの */
  status: 'all' | '準備中' | '公開中' | '停止'
  archive: 'except_archived' | 'all'
  device: DeviceFilter
  /** version/sb_article_uid検索 */
  versionQuery: string
  /** parameter検索 */
  paramQuery: string
}

export const BRANCH_FILTER_DEFAULT: BranchFilter = {
  status: 'all',
  archive: 'except_archived',
  device: '0',
  versionQuery: '',
  paramQuery: '',
}

function matches(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase())
}

/**
 * その端末に配信する行か。
 * 端末の設定を持たない行（外部LPや設定前）は「全端末に出す」扱いにする。
 * 持っていないことを「出さない」と読むと、設定していないだけの行が消える。
 */
function deliversTo(row: ReportVersionRow, device: DeviceFilter): boolean {
  if (device === '0') return true
  const targets = row.device_targets
  if (targets === undefined) return true
  return targets[device]
}

export function filterBranchRows(
  rows: readonly ReportVersionRow[],
  filter: BranchFilter,
): ReportVersionRow[] {
  const out: ReportVersionRow[] = []
  for (const row of rows) {
    if (filter.archive === 'except_archived' && row.archived === true) continue
    if (filter.status !== 'all' && row.status !== filter.status) continue
    if (!deliversTo(row, filter.device)) continue
    if (filter.versionQuery !== '') {
      const hit = matches(row.name, filter.versionQuery) || matches(row.entity_uid, filter.versionQuery)
      if (!hit) continue
    }
    if (filter.paramQuery === '') {
      out.push(row)
      continue
    }
    // 広告で絞ったときは、当たった広告の行だけを残す（当たらないVersionごと落とす）
    const children = (row.children ?? []).filter((child) => matches(child.name, filter.paramQuery))
    if (children.length === 0) continue
    out.push({ ...row, children })
  }
  return out
}
