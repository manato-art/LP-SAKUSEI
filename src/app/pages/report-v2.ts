/**
 * 指示178: レポート画面の中身を、指定されたデザインで組み直す。
 *
 * ナビ・パンくず・上部タブは採取物のまま（`report.ts` が用意する）。
 * ここが差し替えるのは**レポート本体の中身だけ**。
 *
 * 構成（指定画像どおり）:
 *   フィルター行 → KPIカード7枚 → クリエイティブレポート → レポート一覧 → Branch Operation
 */
import { api, type ReportKpi, type ReportResponse } from '../api.ts'
import { toast } from '../ui.ts'
import { toDateKey, toRangeQuery, type DateRange } from './report-period.ts'
import { injectReportStyles } from './report-v2-style.ts'
import { buildKpiCards } from './report-v2-kpi.ts'
import { buildCreativeReport } from './report-v2-chart.ts'
import { buildBranchOperation, buildReportList } from './report-v2-tables.ts'

/** 同じ日数だけ手前にずらした期間（増減の比較対象） */
export function previousRange(range: DateRange): DateRange {
  const start = new Date(`${range.startDate}T00:00:00`)
  const end = new Date(`${range.endDate}T00:00:00`)
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1)
  const prevEnd = new Date(start)
  prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd)
  prevStart.setDate(prevStart.getDate() - (days - 1))
  return { startDate: toDateKey(prevStart), endDate: toDateKey(prevEnd) }
}

function field(label: string, control: HTMLElement): HTMLElement {
  const wrap = document.createElement('label')
  wrap.className = 'rv2-field'
  const text = document.createElement('span')
  text.className = 'rv2-field-label'
  text.textContent = label
  wrap.append(text, control)
  return wrap
}

/** 値が固定の絞り込み（採取物に選択肢が無いものは「全て」だけ出す） */
function fixedSelect(options: readonly string[]): HTMLSelectElement {
  const sel = document.createElement('select')
  for (const o of options) {
    const opt = document.createElement('option')
    opt.textContent = o
    sel.append(opt)
  }
  return sel
}

interface FilterDeps {
  range: DateRange
  onApply: (range: DateRange) => void
}

function buildFilters(deps: FilterDeps): HTMLElement {
  const card = document.createElement('section')
  card.className = 'rv2-card rv2-filters'

  const rangeBox = document.createElement('div')
  rangeBox.className = 'rv2-daterange'
  rangeBox.innerHTML =
    '<svg class="rv2-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" ' +
    'height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>'
  const start = document.createElement('input')
  start.type = 'date'
  start.value = deps.range.startDate
  const tilde = document.createElement('span')
  tilde.textContent = '〜'
  tilde.style.color = '#98a2b3'
  const end = document.createElement('input')
  end.type = 'date'
  end.value = deps.range.endDate
  rangeBox.append(start, tilde, end)

  const apply = document.createElement('button')
  apply.type = 'button'
  apply.className = 'rv2-apply'
  apply.innerHTML =
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round"><path d="M3 5h18l-7 8v6l-4 2v-8Z"/></svg>'
  const applyText = document.createElement('span')
  applyText.textContent = '絞り込み'
  apply.append(applyText)
  apply.addEventListener('click', () => {
    const a = start.value
    const b = end.value
    if (a === '' || b === '') {
      toast('開始日と終了日を入れてください', 'error')
      return
    }
    deps.onApply(a <= b ? { startDate: a, endDate: b } : { startDate: b, endDate: a })
  })

  card.append(
    field('配信期間', rangeBox),
    // 以下は実物にある絞り込み。当システムは Version 単位でしか持たないので、
    // 選択肢を発明せず「全て」だけを出す（推測で埋めない）。
    field('バージョン', fixedSelect(['全て'])),
    field('アーカイブ', fixedSelect(['全て'])),
    field('デバイス', fixedSelect(['全て'])),
    field('広告主', fixedSelect(['全て'])),
    field('キャンペーン', fixedSelect(['全て'])),
    field('クリエイティブ', fixedSelect(['全て'])),
    apply,
  )
  return card
}

/** Version別の実績をCSVにして落とす */
function downloadCsv(report: ReportResponse, title: string, range: DateRange): void {
  const header = ['名前', '配信金額', 'PV', 'CLICK', 'CTR', 'CV', 'CVR', 'CPA']
  const lines = [header.join(',')]
  for (const r of report.rows) {
    lines.push(
      [
        `"${r.name.replace(/"/g, '""')}"`,
        r.ad_cost,
        r.pv,
        r.click,
        r.ctr === null ? '' : (r.ctr * 100).toFixed(2),
        r.cv,
        r.cvr === null ? '' : (r.cvr * 100).toFixed(2),
        r.cpa ?? '',
      ].join(','),
    )
  }
  // Excel が文字化けしないよう BOM を付ける
  const blob = new Blob([`\ufeff${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title}_${range.startDate}_${range.endDate}.csv`
  a.click()
  URL.revokeObjectURL(url)
  toast('CSVをダウンロードしました')
}

export interface ReportBodyDeps {
  abTestUid: string
  title: string
  range: DateRange
  report: ReportResponse
  onRangeChange: (range: DateRange) => void
}

/**
 * レポート本体を組み立てて返す。
 * 前期間のKPIは増減表示にだけ使うので、取れなくても画面は出す。
 */
export async function buildReportBody(deps: ReportBodyDeps): Promise<HTMLElement> {
  injectReportStyles()

  let previous: ReportKpi | null = null
  try {
    const prev = await api.report(deps.abTestUid, toRangeQuery(previousRange(deps.range)))
    previous = prev.totals
  } catch {
    /* 増減が出ないだけなので、画面は出す */
  }

  const root = document.createElement('div')
  root.className = 'rv2'
  const csv = (): void => downloadCsv(deps.report, deps.title, deps.range)

  root.append(
    buildFilters({ range: deps.range, onApply: deps.onRangeChange }),
    buildKpiCards({ totals: deps.report.totals, daily: deps.report.daily, previous }),
    buildCreativeReport({ daily: deps.report.daily, range: deps.range, onDownloadCsv: csv }),
    buildReportList({ rows: deps.report.rows, range: deps.range }),
    buildBranchOperation({ rows: deps.report.rows, onDownloadCsv: csv }),
  )
  return root
}
