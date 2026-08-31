/**
 * レポートタブの表に、モックAPIの値を流し込む。
 *
 * 表のマークアップは採取した実物（MUI Table）をそのまま使い、
 * 採取済みの行を**テンプレートとして複製**して行数だけを合わせる。
 * セルの中身は `mock-server/store/metrics.ts` の恒等式で算出された値（企画書 §10-5）。
 */
import type { ReportDailyRow, ReportKpi, ReportVersionRow } from '../api.ts'
import { EMPTY_CELL, REPORT_COLUMNS, formatCell } from './report-columns.ts'

/** 見出し（h3）でMUIカードを特定する（Emotionのハッシュに依存しない） */
export function cardByHeading(root: HTMLElement, heading: string): HTMLElement | null {
  for (const node of root.querySelectorAll<HTMLElement>('h3')) {
    if ((node.textContent ?? '').trim() === heading) {
      return node.closest<HTMLElement>('.MuiPaper-root')
    }
  }
  return null
}

/** CSS Modules のセクション（クリエイティブ / ファネル）をタイトル文字で特定する */
export function sectionByTitle(root: HTMLElement, title: string): HTMLElement | null {
  for (const node of root.querySelectorAll<HTMLElement>('[class*="_title_"]')) {
    if ((node.textContent ?? '').trim() === title) {
      return node.closest<HTMLElement>('[class*="_reportWrapper_"]')
    }
  }
  return null
}

interface RowTemplates {
  tbody: HTMLElement
  first: HTMLTableRowElement
  second: HTMLTableRowElement
}

/** 採取済みの2行（合計行 / 明細行）をテンプレートとして取り出す */
function rowTemplates(card: HTMLElement): RowTemplates | null {
  const tbody = card.querySelector<HTMLElement>('tbody')
  if (tbody === null) return null
  const rows = tbody.querySelectorAll<HTMLTableRowElement>('tr')
  const first = rows[0]
  const second = rows[1]
  if (first === undefined || second === undefined) return null
  return { tbody, first, second }
}

/** セルの中に `<p>` があればそこへ、無ければセル自体へ書く（採取物の作りに合わせる） */
function writeCell(node: HTMLElement, value: string): void {
  const paragraph = node.querySelector<HTMLElement>('p')
  if (paragraph !== null) {
    paragraph.textContent = value
    return
  }
  node.textContent = value
}

/** 指標セル（先頭のラベル列を除いた13セル）に値を入れる */
function writeMetricCells(row: HTMLTableRowElement, kpi: ReportKpi, offset: number): void {
  const cells = row.querySelectorAll<HTMLElement>('td')
  REPORT_COLUMNS.forEach((column, index) => {
    const cell = cells[offset + index]
    if (cell === undefined) return
    writeCell(cell, formatCell(kpi, column))
  })
}

/**
 * デイリーレポート表（合計行 ＋ 日付ごとの行）。
 * 先頭列は指標ではなくラベル（`合計` / `YYYY-MM-DD`）。
 */
export function fillDailyTable(
  card: HTMLElement,
  totals: ReportKpi,
  daily: readonly ReportDailyRow[],
): boolean {
  const templates = rowTemplates(card)
  if (templates === null) {
    console.warn('[report] デイリーレポート表のテンプレート行が土台に見つかりませんでした')
    return false
  }
  const { tbody, first, second } = templates
  const totalRow = first.cloneNode(true) as HTMLTableRowElement
  writeMetricCells(totalRow, totals, 1)

  const dateRows = daily.map((row) => {
    const clone = second.cloneNode(true) as HTMLTableRowElement
    const label = clone.querySelector<HTMLElement>('td')
    if (label !== null) writeCell(label, row.date)
    writeMetricCells(clone, row, 1)
    return clone
  })

  tbody.replaceChildren(totalRow, ...dateRows)
  return true
}

export interface BranchRowInput {
  /** `タイトル` 列の1行目＝beyondページ名（上部バーの `_title_dcd38_67 p` と同じ値だった） */
  title: string
  /**
   * `タイトル` 列の2行目。前に付くSVGは `nosnsicon`（媒体アイコンの未設定プレースホルダ）で、
   * フォルダ名ではなく**媒体名**が入る位置。
   */
  mediaName: string
  totals: ReportKpi
  versions: readonly ReportVersionRow[]
}

/**
 * Branch Operation 表（beyondページ1行 ＋ Versionごとの行）。
 * 先頭列は `タイトル`、末尾列は `配信`（採取物では空セル）。
 */
export function fillBranchTable(card: HTMLElement, input: BranchRowInput): boolean {
  const templates = rowTemplates(card)
  if (templates === null) {
    console.warn('[report] Branch Operation 表のテンプレート行が土台に見つかりませんでした')
    return false
  }
  const { tbody, first, second } = templates

  const abTestRow = first.cloneNode(true) as HTMLTableRowElement
  const titleCell = abTestRow.querySelector<HTMLElement>('td')
  if (titleCell !== null) {
    const paragraphs = titleCell.querySelectorAll<HTMLElement>('p')
    const titleNode = paragraphs[0]
    const mediaNode = paragraphs[1]
    if (titleNode !== undefined) titleNode.textContent = input.title
    if (mediaNode !== undefined) mediaNode.textContent = input.mediaName
  }
  writeMetricCells(abTestRow, input.totals, 1)

  const versionRows = input.versions.map((version) => {
    const clone = second.cloneNode(true) as HTMLTableRowElement
    const nameCell = clone.querySelector<HTMLElement>('td')
    if (nameCell !== null) writeCell(nameCell, version.name)
    writeMetricCells(clone, version, 1)
    return clone
  })

  tbody.replaceChildren(abTestRow, ...versionRows)
  return true
}

/** ファネルの集計（PV / CV / CVR）。CVR は採取物どおり `%` を付ける */
export function fillFunnelSummary(section: HTMLElement, totals: ReportKpi): void {
  const items = section.querySelectorAll<HTMLElement>('[class*="_summaryData_"]')
  const values: readonly string[] = [
    totals.pv.toLocaleString('ja-JP'),
    totals.cv.toLocaleString('ja-JP'),
    totals.cvr === null ? EMPTY_CELL : `${(totals.cvr * 100).toFixed(2)}%`,
  ]
  items.forEach((item, index) => {
    const span = item.querySelector<HTMLElement>('span')
    const value = values[index]
    if (span !== null && value !== undefined) span.textContent = value
  })
}
