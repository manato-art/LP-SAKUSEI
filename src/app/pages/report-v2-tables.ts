/**
 * 指示178: 「レポート一覧」と「Branch Operation」の表。
 *
 * 実物と同じく、レポート一覧は見出しが2段（配信実績 / 成果）に分かれる。
 * 並び替えとページ送りはこの画面の中だけで完結させる（再取得しない）。
 */
import type { ReportVersionRow } from '../api.ts'
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
  perLabel.style.cssText = 'font-size:11px;color:#6b7280'
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
        ? '表示できる行がありません'
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

export interface BranchDeps {
  rows: readonly ReportVersionRow[]
  onDownloadCsv: () => void
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
  right.append(csv)
  head.append(title, hint, search, right)

  const scroll = document.createElement('div')
  scroll.className = 'rv2-scroll'

  const render = (): void => {
    const q = input.value.trim()
    const rows = q === '' ? deps.rows : deps.rows.filter((r) => r.name.includes(q))
    const table = document.createElement('table')
    table.className = 'rv2-table'
    const thead = document.createElement('thead')
    const tr = document.createElement('tr')
    for (const [label, num] of [
      ['名前', false],
      ['配信金額', true],
      ['PV', true],
      ['CLICK', true],
      ['CTR', true],
      ['CV', true],
      ['CVR', true],
      ['CPA', true],
      ['配信割合', true],
    ] as const) {
      const th = document.createElement('th')
      if (num) th.className = 'num'
      th.textContent = label
      tr.append(th)
    }
    thead.append(tr)
    const tbody = document.createElement('tbody')
    if (rows.length === 0) {
      const empty = document.createElement('tr')
      const td = document.createElement('td')
      td.colSpan = 9
      td.textContent = '該当する行がありません'
      td.style.cssText = 'color:#6b7280;text-align:center;padding:20px'
      empty.append(td)
      tbody.append(empty)
    }
    for (const row of rows) {
      const line = document.createElement('tr')
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
        yen(row.cpa),
        `${row.distribution_ratio}%`,
      ]) {
        const td = document.createElement('td')
        td.className = 'num'
        td.textContent = text
        line.append(td)
      }
      tbody.append(line)
    }
    table.append(thead, tbody)
    scroll.replaceChildren(table)
  }
  input.addEventListener('input', render)
  render()

  card.append(head, scroll)
  return card
}
