/**
 * ページ一覧のKPI列と、その集計期間（folders.ts から分離）。
 *
 * 期間は画面をまたいで1つだけ持つ。`let` を直接 export すると
 * 取り込み先から代入できないので、読み書きは関数を通す。
 */
import { api } from '../api.ts'
import { defaultRange, toRangeQuery, type DateRange } from './report-period.ts'
import { formatPeriodLabel } from '../panels/period-picker.ts'
import { EMPTY_CELL, formatCell, type ReportColumn } from './report-columns.ts'

/** 一覧KPIの集計期間。既定は「今日1日」＝レポート画面の既定と同じ数え方に揃える。 */
/** 一覧のKPIを何日ぶんで出すか。既定は report-period の既定期間。 */
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
/** 一覧の各行のKPI列を、選択中の集計期間の実データで埋める。 */
export async function applyListMetrics(area: HTMLElement): Promise<void> {
  const rows = [...area.querySelectorAll<HTMLElement>('[data-ab-test-uid]')]
  await Promise.all(
    rows.map(async (row) => {
      const uid = row.dataset['abTestUid'] ?? ''
      if (uid === '') return
      try {
        const { totals } = await api.report(uid, toRangeQuery(listRange))
        const cells = row.querySelectorAll<HTMLElement>('.e14sgd470')
        for (const { index, column } of LIST_METRIC_CELLS) {
          const cell = cells[index]
          if (cell === undefined) continue
          const text = formatCell(totals, column)
          cell.textContent =
            text === EMPTY_CELL
              ? EMPTY_CELL
              : column.format === 'yen'
                ? `¥${text}`
                : column.format === 'percent'
                  ? `${text}%`
                  : text
        }
      } catch {
        // 取得できなければ採取値のまま（数字を発明しない）
      }
    }),
  )
}
/** 「集計期間：YYYY/MM/DD 〜 YYYY/MM/DD」のラベルを現在の期間へ更新する（∨アイコンは残す）。 */
export function setPeriodLabel(periodSelect: HTMLElement): void {
  const label =
    [...periodSelect.querySelectorAll<HTMLElement>('*')].find(
      (el) => el.children.length === 0 && (el.textContent ?? '').includes('集計期間'),
    ) ?? periodSelect
  label.textContent = formatPeriodLabel(listRange)
}
