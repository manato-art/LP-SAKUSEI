/**
 * ページ一覧のKPI列・合計行と、その集計期間（folders.ts から分離）。
 *
 * 期間は画面をまたいで1つだけ持つ。`let` を直接 export すると
 * 取り込み先から代入できないので、読み書きは関数を通す。
 *
 * 数字を発明しない（2026-09-24）:
 *   - 行のKPIは読み込む前も失敗したときも「-」。以前は失敗すると採取物の数字（¥0・0%）が残った。
 *   - 合計行は採取物のフェイク値（¥0 / PV 1,031 / Click 141 / CTR 10.31% …）がフォルダを選んでも残っていた。
 *     行と同じ数字（ページ単位の計測）を /folders/:uid/ab_tests/reports_total で足す。
 */
import { api, type ReportKpi } from '../api.ts'
import { pageListApi } from '../api-page-list.ts'
import { toast } from '../ui.ts'
import { defaultRange, toRangeQuery, type DateRange } from './report-period.ts'
import { formatPeriodLabel } from '../panels/period-picker.ts'
import { EMPTY_CELL, formatCell, type ReportColumn } from './report-columns.ts'

/** 一覧KPIの集計期間。既定は「今日1日」＝レポート画面の既定と同じ数え方に揃える。 */
let listRange: DateRange = defaultRange()

export function getListRange(): DateRange {
  return listRange
}

export function setListRange(range: DateRange): void {
  listRange = range
}
/**
 * 一覧のKPI列（1行あたり `.e14sgd470` が13個）を実データで埋める。
 * 列の並びは採取した実ヘッダのとおり（0番目の配信ステータスだけ指標ではないので触らない）。
 *
 * 一次値の出所:
 *   pv / click / cv          … LPに貼った計測タグ（実測）
 *   ad_cost / imp /
 *   media_click / media_cv   … 媒体（Meta広告）からの取り込み。未取得なら0
 * 派生は metrics.ts の恒等式（ctr = click/pv, ctvr = cv/pv, media_ctr = media_click/imp,
 * mcpa = ad_cost/media_cv, roas = sales/ad_cost）。ゼロ除算は「-」。
 */
const LIST_METRIC_CELLS: readonly { index: number; column: ReportColumn }[] = [
  { index: 1, column: { label: '配信金額', unit: '円', metric: 'ad_cost', format: 'yen' } },
  { index: 2, column: { label: 'PV', unit: '', metric: 'pv', format: 'integer' } },
  { index: 3, column: { label: 'Click', unit: '', metric: 'click', format: 'integer' } },
  { index: 4, column: { label: 'CTR', unit: '%', metric: 'ctr', format: 'percent' } },
  { index: 5, column: { label: 'CV', unit: '', metric: 'cv', format: 'integer' } },
  { index: 6, column: { label: 'CVR', unit: '%', metric: 'cvr', format: 'percent' } },
  { index: 7, column: { label: 'CTVR', unit: '%', metric: 'ctvr', format: 'percent' } },
  { index: 8, column: { label: 'CPA', unit: '円', metric: 'cpa', format: 'yen' } },
  { index: 9, column: { label: 'MCPA', unit: '円', metric: 'mcpa', format: 'yen' } },
  { index: 10, column: { label: '媒体Click', unit: '', metric: 'media_click', format: 'integer' } },
  { index: 11, column: { label: '媒体CTR', unit: '%', metric: 'media_ctr', format: 'percent' } },
  { index: 12, column: { label: 'ROAS', unit: '%', metric: 'roas', format: 'percent' } },
]

/** 行のKPIのセル（先頭は配信ステータスなので、指標は1つずれる） */
const ROW_CELL = '.e14sgd470'
/** 合計行のセル（配信ステータスの列が無いので、指標は0番目から） */
const TOTAL_CELL = '.en4zj401'

function formatListCell(totals: ReportKpi, column: ReportColumn): string {
  const text = formatCell(totals, column)
  if (text === EMPTY_CELL) return EMPTY_CELL
  if (column.format === 'yen') return `¥${text}`
  if (column.format === 'percent') return `${text}%`
  return text
}

/** 数字を「-」にして、理由があれば添える（採取物の数字を残さない） */
function blankCells(cells: readonly HTMLElement[], reason: string | null): void {
  for (const cell of cells) {
    cell.textContent = EMPTY_CELL
    if (reason === null) cell.removeAttribute('title')
    else cell.title = reason
  }
}

function rowMetricCells(row: HTMLElement): HTMLElement[] {
  const cells = [...row.querySelectorAll<HTMLElement>(ROW_CELL)]
  return LIST_METRIC_CELLS.map(({ index }) => cells[index]).filter((c): c is HTMLElement => c !== undefined)
}

/** 読み込む前の行。採取物の数字（¥0・0%）を見せない */
export function clearRowMetrics(row: HTMLElement): void {
  blankCells(rowMetricCells(row), null)
}

/**
 * 一覧の各行のKPI列を、選択中の集計期間の実データで埋める。
 * 返り値は読めたページの PV/CV（PV順・CV順の並び替えに使う）。
 */
export async function applyListMetrics(area: HTMLElement): Promise<Map<string, { pv: number; cv: number }>> {
  const rows = [...area.querySelectorAll<HTMLElement>('[data-ab-test-uid]')]
  const loaded = new Map<string, { pv: number; cv: number }>()
  const failures: string[] = []
  await Promise.all(
    rows.map(async (row) => {
      const uid = row.dataset['abTestUid'] ?? ''
      if (uid === '') return
      try {
        const { totals } = await api.report(uid, toRangeQuery(listRange))
        const cells = row.querySelectorAll<HTMLElement>(ROW_CELL)
        for (const { index, column } of LIST_METRIC_CELLS) {
          const cell = cells[index]
          if (cell !== undefined) cell.textContent = formatListCell(totals, column)
        }
        loaded.set(uid, { pv: totals.pv, cv: totals.cv })
      } catch (error) {
        // 採取物の数字を残さない。理由はセルに添え、まとめて1回だけ知らせる
        blankCells(rowMetricCells(row), `数値を取得できませんでした: ${(error as Error).message}`)
        failures.push(uid)
      }
    }),
  )
  if (failures.length > 0) toast(`${failures.length}件のページの数値を取得できませんでした`, 'error')
  return loaded
}

/**
 * 合計行（`.en4zj406`）を、表に出ている行の合計にする。
 * 行が1つも出ていなければ「-」。取得に失敗したら「-」と理由。
 */
export async function applyTotalRow(
  area: HTMLElement,
  folderUid: string,
  visibleUids: readonly string[],
): Promise<void> {
  const cells = [...area.querySelectorAll<HTMLElement>(`.en4zj406 ${TOTAL_CELL}`)]
  blankCells(cells, null)
  if (visibleUids.length === 0) return
  try {
    const { reports_total } = await pageListApi.reportsTotal(folderUid, visibleUids, toRangeQuery(listRange))
    LIST_METRIC_CELLS.forEach(({ column }, i) => {
      const cell = cells[i]
      if (cell !== undefined) cell.textContent = formatListCell(reports_total, column)
    })
  } catch (error) {
    const reason = `合計を取得できませんでした: ${(error as Error).message}`
    blankCells(cells, reason)
    toast(reason, 'error')
  }
}

/** 「集計期間：YYYY/MM/DD 〜 YYYY/MM/DD」のラベルを現在の期間へ更新する（∨アイコンは残す）。 */
export function setPeriodLabel(periodSelect: HTMLElement): void {
  const label =
    [...periodSelect.querySelectorAll<HTMLElement>('*')].find(
      (el) => el.children.length === 0 && (el.textContent ?? '').includes('集計期間'),
    ) ?? periodSelect
  label.textContent = formatPeriodLabel(listRange)
}
