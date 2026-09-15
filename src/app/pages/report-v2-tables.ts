/**
 * 指示178: 「レポート一覧」と「Branch Operation」の表。
 *
 * 実物と同じく、レポート一覧は見出しが2段（配信実績 / 成果）に分かれる。
 * 並び替えとページ送りはこの画面の中だけで完結させる（再取得しない）。
 */
import { DAILY_LABEL_COLUMN, REPORT_COLUMNS, formatCell } from './report-columns.ts'
import type { ReportDailyRow, ReportKpi, ReportVersionRow } from '../api.ts'
import type { DateRange } from './report-period.ts'

const yen = (v: number | null): string =>
  v === null ? '-' : `¥ ${Math.round(v).toLocaleString('ja-JP')}`
const int = (v: number | null): string => (v === null ? '-' : Math.round(v).toLocaleString('ja-JP'))
const pct = (v: number | null): string => (v === null ? '-' : `${(v * 100).toFixed(2)}%`)

type SortKey = 'name' | 'ad_cost' | 'pv' | 'click' | 'ctr' | 'cv' | 'cvr' | 'cpa'

function sortValue(row: ReportVersionRow, key: SortKey): number | string {
  switch (key) {
    case 'name':
      return row.name
    case 'ad_cost':
      return row.ad_cost
    case 'pv':
      return row.pv
    case 'click':
      return row.click
    case 'cv':
      return row.cv
    case 'ctr':
      return row.ctr ?? -1
    case 'cvr':
      return row.cvr ?? -1
    case 'cpa':
      return row.cpa ?? -1
  }
}

interface Col {
  key: SortKey
  label: string
  num: boolean
  cell: (row: ReportVersionRow) => string
}

const PERF_COLS: readonly Col[] = [
  { key: 'ad_cost', label: '配信金額', num: true, cell: (r) => yen(r.ad_cost) },
  { key: 'pv', label: 'PV', num: true, cell: (r) => int(r.pv) },
  { key: 'click', label: 'CLICK', num: true, cell: (r) => int(r.click) },
  { key: 'ctr', label: 'CTR', num: true, cell: (r) => pct(r.ctr) },
]
const RESULT_COLS: readonly Col[] = [
  { key: 'cv', label: 'CV', num: true, cell: (r) => int(r.cv) },
  { key: 'cvr', label: 'CVR', num: true, cell: (r) => pct(r.cvr) },
  { key: 'cpa', label: 'CPA', num: true, cell: (r) => yen(r.cpa) },
]

function sortableTh(col: { key: SortKey; label: string; num: boolean }, state: {
  key: SortKey
  asc: boolean
}, onSort: (key: SortKey) => void): HTMLTableCellElement {
  const th = document.createElement('th')
  th.className = `rv2-sort${col.num ? ' num' : ''}${state.key === col.key ? ' on' : ''}`
  th.textContent = col.label
  const mark = document.createElement('span')
  mark.textContent = state.key === col.key ? (state.asc ? '▲' : '▼') : '⇅'
  th.append(mark)
  th.addEventListener('click', () => onSort(col.key))
  return th
}

export interface ReportListDeps {
  rows: readonly ReportVersionRow[]
  range: DateRange
}

/** 「レポート一覧」= 2段見出し・並び替え・ページ送り */
export function buildReportList(deps: ReportListDeps): HTMLElement {
  const card = document.createElement('section')
  card.className = 'rv2-card'

  const head = document.createElement('div')
  head.className = 'rv2-head'
  const title = document.createElement('span')
  title.className = 'rv2-title'
  title.textContent = 'レポート一覧'
  const hint = document.createElement('span')
  hint.className = 'rv2-hint'
  hint.textContent = 'i'
  hint.title = 'Versionごとの実績。列見出しを押すと並び替わる。'
  const right = document.createElement('div')
  right.className = 'rv2-head-right'
  const perLabel = document.createElement('span')
  perLabel.textContent = '表示件数'
  perLabel.style.cssText = 'font-size:11px;color:var(--sb-c-6b7280, #6B7280)'
  const per = document.createElement('select')
  per.className = 'rv2-btn'
  for (const n of [10, 25, 50]) {
    const o = document.createElement('option')
    o.value = String(n)
    o.textContent = String(n)
    per.append(o)
  }
  right.append(perLabel, per)
  head.append(title, hint, right)

  const scroll = document.createElement('div')
  scroll.className = 'rv2-scroll'
  const foot = document.createElement('div')
  foot.className = 'rv2-foot'

  const state = { key: 'ad_cost' as SortKey, asc: false, page: 1 }
  const onSort = (key: SortKey): void => {
    if (state.key === key) state.asc = !state.asc
    else {
      state.key = key
      state.asc = false
    }
    render()
  }

  function render(): void {
    const perPage = Number(per.value)
    const sorted = [...deps.rows].sort((a, b) => {
      const av = sortValue(a, state.key)
      const bv = sortValue(b, state.key)
      const cmp =
        typeof av === 'string' || typeof bv === 'string'
          ? String(av).localeCompare(String(bv), 'ja')
          : av - bv
      return state.asc ? cmp : -cmp
    })
    const pages = Math.max(1, Math.ceil(sorted.length / perPage))
    if (state.page > pages) state.page = pages
    const from = (state.page - 1) * perPage
    const shown = sorted.slice(from, from + perPage)

    const table = document.createElement('table')
    table.className = 'rv2-table'
    const thead = document.createElement('thead')

    // 1段目: 左のまとまりは2行ぶち抜き、右は「配信実績 / 成果」でまとめる
    const r1 = document.createElement('tr')
    for (const label of ['配信期間', 'バージョン', 'アーカイブ', 'デバイス']) {
      const th = document.createElement('th')
      th.rowSpan = 2
      th.textContent = label
      r1.append(th)
    }
    const perf = document.createElement('th')
    perf.className = 'group'
    perf.colSpan = PERF_COLS.length
    perf.textContent = '配信実績'
    const res = document.createElement('th')
    res.className = 'group'
    res.colSpan = RESULT_COLS.length
    res.textContent = '成果'
    const menu = document.createElement('th')
    menu.rowSpan = 2
    r1.append(perf, res, menu)

    const r2 = document.createElement('tr')
    for (const c of [...PERF_COLS, ...RESULT_COLS]) r2.append(sortableTh(c, state, onSort))
    thead.append(r1, r2)

    const tbody = document.createElement('tbody')
    for (const row of shown) {
      const tr = document.createElement('tr')
      const period = document.createElement('td')
      period.textContent = `${deps.range.startDate} 〜 ${deps.range.endDate}`
      const ver = document.createElement('td')
      ver.textContent = row.name
      const arch = document.createElement('td')
      arch.textContent = '-'
      const dev = document.createElement('td')
      // 出し分けはVersion側の設定。レポートは端末別に分けていないので「全て」。
      dev.textContent = '全て'
      tr.append(period, ver, arch, dev)
      for (const c of [...PERF_COLS, ...RESULT_COLS]) {
        const td = document.createElement('td')
        td.className = 'num'
        td.textContent = c.cell(row)
        tr.append(td)
      }
      const last = document.createElement('td')
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'rv2-rowmenu'
      btn.textContent = '⋮'
      btn.title = 'この行の操作（未実装）'
      last.append(btn)
      tr.append(last)
      tbody.append(tr)
    }
    table.append(thead, tbody)
    scroll.replaceChildren(table)

    const info = document.createElement('span')
    info.textContent =
      sorted.length === 0
        ? '表示できるレポートがありません'
        : `全 ${sorted.length} 件中 ${from + 1} 〜 ${from + shown.length} 件を表示`
    const pager = document.createElement('div')
    pager.className = 'rv2-pager'
    const mk = (label: string, page: number, disabled: boolean, on = false): HTMLButtonElement => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = `rv2-page${on ? ' on' : ''}`
      b.textContent = label
      b.disabled = disabled
      b.addEventListener('click', () => {
        state.page = page
        render()
      })
      return b
    }
    pager.append(mk('‹', state.page - 1, state.page <= 1))
    for (let p = 1; p <= pages; p++) pager.append(mk(String(p), p, false, p === state.page))
    pager.append(mk('›', state.page + 1, state.page >= pages))
    foot.replaceChildren(info, pager)
  }

  per.addEventListener('change', () => {
    state.page = 1
    render()
  })
  render()
  card.append(head, scroll, foot)
  return card
}

export /**
 * 絞り込んだ行の合計を出す。比率・単価は足し算できないので、必ず素の値から出し直す
 * （足した比率を足すと必ず狂う）。
 */
type TotalsRow = Pick<
  ReportKpi,
  | 'ad_cost'
  | 'pv'
  | 'click'
  | 'cv'
  | 'ctr'
  | 'cvr'
  | 'ctvr'
  | 'cpa'
  | 'mcpa'
  | 'fver'
  | 'sver'
  | 'fsver'
  | 'oar'
>

function sumRows(rows: readonly ReportVersionRow[]): TotalsRow {
  const sum = (pick: (r: ReportVersionRow) => number): number =>
    rows.reduce((total, row) => total + pick(row), 0)
  const pv = sum((r) => r.pv)
  const click = sum((r) => r.click)
  const cv = sum((r) => r.cv)
  const adCost = sum((r) => r.ad_cost)
  const ratio = (numerator: number, denominator: number): number | null =>
    denominator === 0 ? null : numerator / denominator
  return {
    ad_cost: adCost,
    pv,
    click,
    cv,
    ctr: ratio(click, pv),
    cvr: ratio(cv, click),
    ctvr: ratio(cv, pv),
    cpa: ratio(adCost, cv),
    mcpa: ratio(adCost, click),
    // スクロールの記録は行に載っていないので、絞り込み中の合計では出さない（「-」）
    fver: null,
    sver: null,
    fsver: null,
    oar: null,
  }
}

interface BranchDeps {
  rows: readonly ReportVersionRow[]
  /** 期間の合計。実物は表の**先頭行**に「合計」を置く（2026-09-15に採取物で確認） */
  totals: TotalsRow
  onDownloadCsv: () => void
}

/**
 * Branch Operation の1行。
 * `nested` は広告パラメータの行（Versionの下にぶら下がる）。
 * 配信割合はVersionに対する設定なので、パラメータの行では出さない。
 */
function branchLine(row: ReportVersionRow, nested: boolean): HTMLElement {
  const line = document.createElement('tr')
  if (nested) line.className = 'rv2-sub'
  const name = document.createElement('td')
  name.textContent = row.name
  line.append(name)
  for (const text of [
    yen(row.ad_cost),
    int(row.pv),
    int(row.click),
    pct(row.ctr),
    int(row.cv),
    pct(row.cvr),
    pct(row.ctvr),
    yen(row.cpa),
    yen(row.mcpa),
    pct(row.fver),
    pct(row.sver),
    pct(row.fsver),
    pct(row.oar),
    nested ? '' : `${row.distribution_ratio}%`,
  ]) {
    const td = document.createElement('td')
    td.className = 'num'
    td.textContent = text
    line.append(td)
  }
  return line
}

/** 「Branch Operation」= 検索つきの一覧 */
export function buildBranchOperation(deps: BranchDeps): HTMLElement {
  const card = document.createElement('section')
  card.className = 'rv2-card'

  const head = document.createElement('div')
  head.className = 'rv2-head'
  const title = document.createElement('span')
  title.className = 'rv2-title'
  title.textContent = 'Branch Operation'
  const hint = document.createElement('span')
  hint.className = 'rv2-hint'
  hint.textContent = 'i'
  hint.title = '配信先ごとの実績。名前で絞り込める。'

  // 実物の見出しにある2つ（2026-09-15に採取物で確認して追加）
  const exclude = document.createElement('a')
  exclude.className = 'rv2-btn'
  exclude.textContent = '配信除外設定'
  exclude.href = '#/report-exclusions'
  exclude.style.textDecoration = 'none'
  const ratioHelp = document.createElement('span')
  ratioHelp.className = 'rv2-hint'
  ratioHelp.textContent = 'i'
  ratioHelp.title =
    '配信割合について：Versionごとに何％の人へ配信するかの設定。合計100％になるように配る。'
  const ratioLabel = document.createElement('span')
  ratioLabel.className = 'rv2-subscript'
  ratioLabel.textContent = '配信割合について'

  const search = document.createElement('div')
  search.className = 'rv2-search'
  search.innerHTML =
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#98a2b3" ' +
    'stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>'
  const input = document.createElement('input')
  input.type = 'search'
  input.placeholder = '名前で検索…'
  search.append(input)

  const right = document.createElement('div')
  right.className = 'rv2-head-right'
  const csv = document.createElement('button')
  csv.type = 'button'
  csv.className = 'rv2-btn primary'
  csv.textContent = 'CSVダウンロード'
  csv.addEventListener('click', deps.onDownloadCsv)
  right.append(exclude, csv)
  head.append(title, hint, ratioLabel, ratioHelp, search, right)

  const scroll = document.createElement('div')
  scroll.className = 'rv2-scroll'

  const render = (): void => {
    const q = input.value.trim()
    const rows = q === '' ? deps.rows : deps.rows.filter((r) => r.name.includes(q))
    const table = document.createElement('table')
    table.className = 'rv2-table'
    const thead = document.createElement('thead')
    const tr = document.createElement('tr')
    // 2026-09-15: 採取した実DOMの13指標に寄せて CTVR / MCPA を足した（モックに値がある）。
    // 残る FVER / SVER / FSVER / OAR は一次値（離脱・到達）がモックに無いのでまだ出せない。
    for (const [label, num] of [
      ['名前', false],
      ['配信金額', true],
      ['PV', true],
      ['CLICK', true],
      ['CTR', true],
      ['CV', true],
      ['CVR', true],
      ['CTVR', true],
      ['CPA', true],
      ['MCPA', true],
      // 2026-09-15: 実物にある4指標。計測タグのスクロール記録から出す
      ['FVER', true],
      ['SVER', true],
      ['FSVER', true],
      ['OAR', true],
      ['配信割合', true],
    ] as const) {
      const th = document.createElement('th')
      if (num) th.className = 'num'
      th.textContent = label
      tr.append(th)
    }
    thead.append(tr)
    const tbody = document.createElement('tbody')

    // 合計行（実物と同じく先頭）。絞り込んでいるときは、絞り込んだぶんの合計を出す
    const shownTotals = q === '' ? deps.totals : sumRows(rows)
    const totalTr = document.createElement('tr')
    totalTr.className = 'rv2-total'
    const totalLabel = document.createElement('td')
    totalLabel.textContent = '合計'
    totalTr.append(totalLabel)
    for (const text of [
      yen(shownTotals.ad_cost),
      int(shownTotals.pv),
      int(shownTotals.click),
      pct(shownTotals.ctr),
      int(shownTotals.cv),
      pct(shownTotals.cvr),
      pct(shownTotals.ctvr),
      yen(shownTotals.cpa),
      yen(shownTotals.mcpa),
      pct(shownTotals.fver),
      pct(shownTotals.sver),
      pct(shownTotals.fsver),
      pct(shownTotals.oar),
      '',
    ]) {
      const td = document.createElement('td')
      td.className = 'num'
      td.textContent = text
      totalTr.append(td)
    }
    tbody.append(totalTr)

    if (rows.length === 0) {
      const empty = document.createElement('tr')
      const td = document.createElement('td')
      td.colSpan = 15
      td.textContent = '表示できるレポートがありません'
      td.style.cssText = 'color:var(--sb-c-6b7280, #6B7280);text-align:center;padding:20px'
      empty.append(td)
      tbody.append(empty)
    }
    for (const row of rows) {
      tbody.append(branchLine(row, false))
      // 実物は Version の行の下に、来た広告パラメータの行がPVの多い順でぶら下がる
      for (const child of row.children ?? []) tbody.append(branchLine(child, true))
    }
    table.append(thead, tbody)
    scroll.replaceChildren(table)
  }
  input.addEventListener('input', render)
  render()

  card.append(head, scroll)
  return card
}

/* ================================================================
 *  デイリーレポート（日付ごとの表）
 *  2026-09-15: 実物にあってクローンに無かったので足した。
 *  列は `report-columns.ts` の13列定義をそのまま使う（定義を二重に持たない）。
 *  見た目は既存の `.rv2-card` / `.rv2-table` のまま＝配色・枠は変えない。
 * ================================================================ */

interface DailyTableDeps {
  daily: readonly ReportDailyRow[]
  totals: ReportKpi
}

export function buildDailyTable(deps: DailyTableDeps): HTMLElement {
  const card = document.createElement('section')
  card.className = 'rv2-card'

  const head = document.createElement('div')
  head.className = 'rv2-head'
  const title = document.createElement('span')
  title.className = 'rv2-title'
  title.textContent = 'デイリーレポート'
  const hint = document.createElement('span')
  hint.className = 'rv2-hint'
  hint.textContent = 'i'
  hint.title = '選んだ期間の日ごとの実績。先頭は期間の合計。'
  head.append(title, hint)

  const scroll = document.createElement('div')
  scroll.className = 'rv2-scroll'
  const table = document.createElement('table')
  table.className = 'rv2-table'

  const thead = document.createElement('thead')
  const headRow = document.createElement('tr')
  const first = document.createElement('th')
  first.textContent = '日付'
  headRow.append(first)
  for (const column of REPORT_COLUMNS) {
    const th = document.createElement('th')
    th.className = 'num'
    th.textContent = column.unit === '' ? column.label : `${column.label} ${column.unit}`
    // 実物は列見出しに説明が付く（aria-label）。文字は増やさず、読み上げと title だけに載せる
    if (column.title !== undefined) {
      th.setAttribute('aria-label', column.title)
      th.title = column.title
    }
    headRow.append(th)
  }
  thead.append(headRow)

  const tbody = document.createElement('tbody')
  /** 1行ぶん（先頭ラベル＋13指標） */
  const line = (label: string, kpi: ReportKpi, className?: string): HTMLTableRowElement => {
    const tr = document.createElement('tr')
    if (className !== undefined) tr.className = className
    const head = document.createElement('td')
    head.textContent = label
    tr.append(head)
    for (const column of REPORT_COLUMNS) {
      const td = document.createElement('td')
      td.className = 'num'
      td.textContent = formatCell(kpi, column)
      tr.append(td)
    }
    return tr
  }
  // 実物は合計が先頭行
  tbody.append(line(DAILY_LABEL_COLUMN, deps.totals, 'rv2-total'))
  if (deps.daily.length === 0) {
    const empty = document.createElement('tr')
    const td = document.createElement('td')
    td.colSpan = REPORT_COLUMNS.length + 1
    td.textContent = '表示できるレポートがありません'
    td.style.cssText = 'color:var(--sb-c-6b7280, #6B7280);text-align:center;padding:20px'
    empty.append(td)
    tbody.append(empty)
  }
  for (const row of deps.daily) tbody.append(line(row.date, row))

  table.append(thead, tbody)
  scroll.append(table)
  card.append(head, scroll)
  return card
}
