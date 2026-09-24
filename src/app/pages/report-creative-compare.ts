/**
 * クリエイティブレポートの右側「比較」の枠（2026-09-24・点検19）。
 *
 * 以前は「表の行から比較したいものを選ぶと、ここに並びます」と書いてあるのに、選ぶ手段が無かった。
 * 下の広告の一覧の各行に「比較」の印を付けると、選んだ広告がここに並び、
 * 今出している列（配信金額 / CTR / CV …）の値を横に並べて見比べられる。
 */
import type { ReportVersionRow } from '../api.ts'
import type { KpiKey } from './report-v2-kpi.ts'

/** 一度に並べられる数（枠が狭いので多すぎると読めない） */
export const MAX_COMPARED = 5

export interface CompareColumn {
  key: KpiKey
  label: string
}

/** 印を付けた広告を、一覧に出ている順で返す（絞り込みで消えたものは出さない） */
export function comparedRows(
  rows: readonly ReportVersionRow[],
  picked: ReadonlySet<string>,
): ReportVersionRow[] {
  return rows.filter((row) => picked.has(row.name))
}

/**
 * 比較の表を組む。何も選んでいなければ null（呼び出し側が空の案内を出す）。
 * 値の書き方は一覧と同じ関数（format）を使う。
 */
export function buildCompareTable(
  rows: readonly ReportVersionRow[],
  columns: readonly CompareColumn[],
  format: (row: ReportVersionRow, key: KpiKey) => string,
): HTMLElement | null {
  if (rows.length === 0) return null
  const table = document.createElement('table')
  table.className = 'rv2-table rv2-compare'
  const thead = document.createElement('thead')
  const headRow = document.createElement('tr')
  for (const text of ['広告', ...columns.map((c) => c.label)]) {
    const th = document.createElement('th')
    th.textContent = text
    if (text !== '広告') th.className = 'num'
    headRow.append(th)
  }
  thead.append(headRow)
  const tbody = document.createElement('tbody')
  for (const row of rows) {
    const tr = document.createElement('tr')
    const name = document.createElement('td')
    name.textContent = row.name
    name.title = row.name
    name.dataset['label'] = '広告'
    tr.append(name)
    for (const column of columns) {
      const td = document.createElement('td')
      td.className = 'num'
      td.dataset['label'] = column.label
      td.textContent = format(row, column.key)
      tr.append(td)
    }
    tbody.append(tr)
  }
  table.append(thead, tbody)
  const wrap = document.createElement('div')
  wrap.className = 'rv2-scroll'
  wrap.append(table)
  return wrap
}
