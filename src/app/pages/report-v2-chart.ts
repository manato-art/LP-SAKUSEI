/**
 * 指示178: フィルター行と「クリエイティブレポート」の折れ線。
 *
 * 折れ線は依存を足さず素のSVGで描く（package.json は触らない規約）。
 * 実物は Recharts だが、採取した静止SVGを置くだけだと期間を変えても動かないので、
 * ここは**実データから毎回描き直す**ようにしている。
 */
import { toast } from '../ui.ts'
import {
  CREATIVE_PAGE_SIZE,
  creativeParameterRows,
  sortCreativeRows,
  type CreativeSortKey,
  type SortDirection,
} from './report-creative-rows.ts'
import { api } from '../api.ts'
import type { ReportDailyRow, ReportVersionRow } from '../api.ts'
import type { DateRange } from './report-period.ts'
import type { KpiKey } from './report-v2-kpi.ts'

/** グラフのタブ（実物のクリエイティブレポートと同じ並び） */
/**
 * 列選択（実物のクリエイティブ欄にある9指標のチェックボックス＋保存）。
 * 名前は採取物の `name` 属性そのまま。既定で入っている5つも採取物どおり。
 */
export const COLUMN_CHOICES: readonly { name: string; label: string; key: KpiKey; on: boolean }[] = [
  { name: 'adSpending', label: '配信金額', key: 'ad_cost', on: true },
  { name: 'pv', label: 'PV', key: 'pv', on: false },
  { name: 'click', label: 'CLICK', key: 'click', on: false },
  { name: 'ctr', label: 'CTR', key: 'ctr', on: true },
  { name: 'cv', label: 'CV', key: 'cv', on: true },
  { name: 'cvr', label: 'CVR', key: 'cvr', on: true },
  { name: 'ctvr', label: 'CTVR', key: 'ctvr', on: false },
  { name: 'cpa', label: 'CPA', key: 'cpa', on: true },
  { name: 'mcpa', label: 'MCPA', key: 'mcpa', on: false },
]

const CHART_TABS: readonly { key: KpiKey; label: string }[] = [
  { key: 'ad_cost', label: '配信金額' },
  { key: 'cv', label: 'CV' },
  { key: 'cpa', label: 'CPA' },
  { key: 'ctr', label: 'CTR' },
  { key: 'cvr', label: 'CVR' },
]

/**
 * 折れ線の点のx座標。
 *
 * 点が1つだけのときは `i / (count - 1)` が 0/0 ＝ NaN になり、
 * polygon / polyline / text が「Expected number」でブラウザに弾かれていた
 * （既定の期間は「今日1日」なので、開くたびにコンソールへエラーが出ていた）。
 * 1点のときは枠の真ん中に置く。
 */
export function chartX(index: number, count: number, padLeft: number, innerWidth: number): number {
  if (count <= 1) return padLeft + innerWidth / 2
  return padLeft + (index / (count - 1)) * innerWidth
}

function svgEl<K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] {
  return document.createElementNS('http://www.w3.org/2000/svg', name)
}

function valueOf(row: ReportDailyRow, key: KpiKey): number | null {
  switch (key) {
    case 'ad_cost':
      return row.ad_cost
    case 'pv':
      return row.pv
    case 'click':
      return row.click
    case 'cv':
      return row.cv
    case 'ctr':
      return row.ctr
    case 'cvr':
      return row.cvr
    case 'cpa':
      return row.cpa
    case 'ctvr':
      return row.ctvr
    case 'mcpa':
      return row.mcpa
  }
}

/** 軸の刻みを「切りのいい数」にする（1 / 2 / 5 × 10^n） */
function niceStep(rough: number): number {
  if (rough <= 0) return 1
  const pow = 10 ** Math.floor(Math.log10(rough))
  const n = rough / pow
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return step * pow
}

function formatAxis(v: number, key: KpiKey): string {
  if (key === 'ctr' || key === 'cvr') return `${(v * 100).toFixed(1)}%`
  if (key === 'ad_cost' || key === 'cpa') return `¥ ${Math.round(v).toLocaleString('ja-JP')}`
  return Math.round(v).toLocaleString('ja-JP')
}

/** `2026-09-08` → `9/8` */
function shortDate(key: string): string {
  const [, m, d] = key.split('-')
  return m === undefined || d === undefined ? key : `${Number(m)}/${Number(d)}`
}

/**
 * 面付きの折れ線を描く。データが1点以下なら null（呼び出し側が空表示にする）。
 * ラベルが枠から出ないよう、左右と下に余白を確保した viewBox にしている。
 */
function drawChart(daily: readonly ReportDailyRow[], key: KpiKey): SVGSVGElement | null {
  const points = daily
    .map((row) => ({ date: row.date, value: valueOf(row, key) }))
    .filter((p): p is { date: string; value: number } => p.value !== null)
  // 2026-09-15: 既定の期間は「今日1日」なので、2点未満で諦めると初期表示が必ず空になる。
  // 実物は1日でも点を打つ（採取物の recharts-area-dot が1日分で2系列ぶん出ている）。
  if (points.length === 0) return null

  const W = 720
  const H = 200
  const padL = 66
  const padR = 12
  const padT = 10
  const padB = 26
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const max = Math.max(...points.map((p) => p.value))
  const step = niceStep(max / 3)
  const top = Math.max(step, Math.ceil(max / step) * step)
  const x = (i: number): number => chartX(i, points.length, padL, innerW)
  const y = (v: number): number => padT + innerH - (v / top) * innerH

  const svg = svgEl('svg')
  svg.setAttribute('class', 'rv2-chart')
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
  svg.setAttribute('preserveAspectRatio', 'none')

  // 横罫線と縦軸ラベル
  for (let v = 0; v <= top + 1e-9; v += step) {
    const gy = y(v)
    const line = svgEl('line')
    line.setAttribute('x1', String(padL))
    line.setAttribute('x2', String(W - padR))
    line.setAttribute('y1', gy.toFixed(1))
    line.setAttribute('y2', gy.toFixed(1))
    line.setAttribute('stroke', '#eef1f6')
    svg.append(line)
    const label = svgEl('text')
    label.setAttribute('x', String(padL - 8))
    label.setAttribute('y', (gy + 3).toFixed(1))
    label.setAttribute('text-anchor', 'end')
    label.setAttribute('font-size', '10')
    label.setAttribute('fill', '#98a2b3')
    label.textContent = formatAxis(v, key)
    svg.append(label)
  }

  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const area = svgEl('polygon')
  // 面の左右の足。1点のときは線の位置に合わせる（両端まで広げると三角形になる）
  const footLeft = points.length <= 1 ? x(0) : padL
  const footRight = points.length <= 1 ? x(0) : padL + innerW
  area.setAttribute(
    'points',
    `${footLeft.toFixed(1)},${padT + innerH} ${line} ${footRight.toFixed(1)},${padT + innerH}`,
  )
  area.setAttribute('fill', 'rgba(37,99,235,.10)')
  const poly = svgEl('polyline')
  poly.setAttribute('points', line)
  poly.setAttribute('fill', 'none')
  poly.setAttribute('stroke', 'var(--sb-accent, #2563EB)')
  poly.setAttribute('stroke-width', '2')
  poly.setAttribute('stroke-linejoin', 'round')
  svg.append(area, poly)

  // 横軸ラベル（多いと重なるので最大10個に間引く）
  const every = Math.max(1, Math.ceil(points.length / 10))
  points.forEach((p, i) => {
    if (i % every !== 0 && i !== points.length - 1) return
    const label = svgEl('text')
    label.setAttribute('x', x(i).toFixed(1))
    label.setAttribute('y', String(H - 8))
    label.setAttribute('text-anchor', 'middle')
    label.setAttribute('font-size', '10')
    label.setAttribute('fill', '#98a2b3')
    label.textContent = shortDate(p.date)
    svg.append(label)
  })
  return svg
}

function emptyBox(title: string, body: string): HTMLElement {
  const box = document.createElement('div')
  box.className = 'rv2-empty'
  const ic = document.createElement('div')
  ic.innerHTML =
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#98a2b3" ' +
    'stroke-width="1.8" stroke-linecap="round"><path d="M3 20h18"/><path d="M7 20v-7"/>' +
    '<path d="M12 20V6"/><path d="M17 20v-10"/></svg>'
  const t = document.createElement('div')
  t.className = 'rv2-empty-title'
  t.textContent = title
  const b = document.createElement('div')
  b.className = 'rv2-empty-body'
  b.style.whiteSpace = 'pre-line'
  b.textContent = body
  box.append(ic, t, b)
  return box
}

export interface ChartDeps {
  daily: readonly ReportDailyRow[]
  range: DateRange
  onDownloadCsv: () => void
  /** Version の行（広告パラメータの行がぶら下がっている）。クリエイティブの一覧に使う */
  rows?: readonly ReportVersionRow[]
}

/** 「クリエイティブレポート」カード（タブ切替で指標を変える） */
export function buildCreativeReport(deps: ChartDeps): HTMLElement {
  const card = document.createElement('section')
  card.className = 'rv2-card'

  const head = document.createElement('div')
  head.className = 'rv2-head'
  const title = document.createElement('span')
  title.className = 'rv2-title'
  title.textContent = 'クリエイティブレポート'
  const hint = document.createElement('span')
  hint.className = 'rv2-hint'
  hint.textContent = 'i'
  hint.title = '選んだ指標の日別推移。期間はページ上部のフィルターで変える。'

  const choiceHost = document.createElement('div')
  choiceHost.className = 'rv2-columnchoice'

  const tabs = document.createElement('div')
  tabs.className = 'rv2-tabs'
  const right = document.createElement('div')
  right.className = 'rv2-head-right'
  const csv = document.createElement('button')
  csv.type = 'button'
  csv.className = 'rv2-btn primary'
  csv.textContent = 'CSVダウンロード'
  csv.addEventListener('click', deps.onDownloadCsv)
  right.append(choiceHost, csv)
  head.append(title, hint, tabs, right)

  /* ── 実物の絞り込み（2026-09-15に採取物を見て追加。見た目は既存の部品に合わせる） ── */
  const filters = document.createElement('div')
  filters.className = 'rv2-creative-filters'

  // Parameter検索（実物と同じ placeholder）
  const paramSearch = document.createElement('input')
  paramSearch.type = 'search'
  paramSearch.className = 'rv2-input'
  paramSearch.placeholder = 'Parameter検索'
  paramSearch.title = 'パラメーター別の実績はまだ集計していないため、いまは絞り込めません'
  paramSearch.disabled = true

  // 広告ステータス（配信中 / 停止中 / ALL・既定はALL）
  let adStatus: '配信中' | '停止中' | 'ALL' = 'ALL'
  const statuses = document.createElement('div')
  statuses.className = 'rv2-chipgroup'
  for (const label of ['配信中', '停止中', 'ALL'] as const) {
    const chip = document.createElement('button')
    chip.type = 'button'
    chip.className = `rv2-chip${label === adStatus ? ' on' : ''}`
    chip.textContent = label
    chip.addEventListener('click', () => {
      adStatus = label
      for (const other of statuses.querySelectorAll('button')) {
        other.classList.toggle('on', other.textContent === label)
      }
      render()
    })
    statuses.append(chip)
  }

  // 平均 / 合計（実物は「平均」が選択側に見える配色）
  let aggregation: '平均' | '合計' = '平均'
  const aggs = document.createElement('div')
  aggs.className = 'rv2-chipgroup'
  for (const label of ['平均', '合計'] as const) {
    const chip = document.createElement('button')
    chip.type = 'button'
    chip.className = `rv2-chip${label === aggregation ? ' on' : ''}`
    chip.textContent = label
    chip.addEventListener('click', () => {
      aggregation = label
      for (const other of aggs.querySelectorAll('button')) {
        other.classList.toggle('on', other.textContent === label)
      }
      render()
    })
    aggs.append(chip)
  }

  // 日付チップ（期間内の日を1日ずつ選ぶ）。もう一度押すと解除
  let pickedDate: string | null = null
  const dates = document.createElement('div')
  dates.className = 'rv2-chipgroup rv2-datechips'

  filters.append(paramSearch, statuses, aggs, dates)

  const row = document.createElement('div')
  row.className = 'rv2-chart-row'
  const left = document.createElement('div')
  const legend = document.createElement('div')
  legend.className = 'rv2-legend'
  const holder = document.createElement('div')
  left.append(legend, holder)
  row.append(left)

  let current: KpiKey = 'ad_cost'

  /** 絞り込みを通した日別の行（広告ステータスは行側に無いので、選ばれた日だけ絞る） */
  const visibleDaily = (): readonly ReportDailyRow[] => {
    const rows = pickedDate === null ? deps.daily : deps.daily.filter((d) => d.date === pickedDate)
    return rows
  }

  const renderDateChips = (): void => {
    dates.innerHTML = ''
    for (const day of deps.daily) {
      const chip = document.createElement('button')
      chip.type = 'button'
      chip.className = `rv2-chip rv2-datechip${pickedDate === day.date ? ' on' : ''}`
      // 実物は「31日」のように日だけを出す
      chip.textContent = `${Number(day.date.slice(8, 10))}日`
      chip.title = day.date
      chip.addEventListener('click', () => {
        pickedDate = pickedDate === day.date ? null : day.date
        renderDateChips()
        render()
      })
      dates.append(chip)
    }
  }

  const render = (): void => {
    const def = CHART_TABS.find((t) => t.key === current)
    legend.innerHTML = ''
    const dot = document.createElement('i')
    const name = document.createElement('span')
    name.textContent = def?.label ?? ''
    legend.append(dot, name)

    holder.innerHTML = ''
    const chart = drawChart(visibleDaily(), current)
    holder.append(
      chart ??
        // 文言は採取物どおり（実物のクリエイティブ欄の空表示）
        emptyBox(
          '表示できるレポートがありません',
          '選択した期間にデータがありません。期間を変えると表示されることがあります。',
        ),
    )
    for (const b of tabs.querySelectorAll('button')) {
      b.classList.toggle('on', b.dataset['key'] === current)
    }
    renderParamRows()
  }

  /** 表示する指標タブ（列選択で選ばれたぶんだけ出す） */
  const chosen = new Set(COLUMN_CHOICES.filter((c) => c.on).map((c) => c.key))
  const renderTabs = (): void => {
    tabs.innerHTML = ''
    for (const choice of COLUMN_CHOICES) {
      if (!chosen.has(choice.key)) continue
      // 実物は列のチップ自体が「並び替え」のドロップダウンを抱えている
      // （採取物 `_column_1fhbq_39` の中に `_filterContent_1fhbq_55`）。
      const chip = document.createElement('div')
      chip.className = 'rv2-colchip'
      chip.dataset['key'] = choice.key
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'rv2-tab'
      b.dataset['key'] = choice.key
      b.textContent = choice.label
      b.addEventListener('click', () => {
        // 選んでいない列を押したらその列に切り替え、選んでいる列を押したら並び替えを開く
        if (current !== choice.key) {
          current = choice.key
          closeSortMenus()
          render()
          return
        }
        const open = chip.classList.contains('open')
        closeSortMenus()
        chip.classList.toggle('open', !open)
      })
      chip.append(b, sortMenu(choice.key, choice.label))
      tabs.append(chip)
    }
    if (!chosen.has(current)) {
      const first = [...chosen][0]
      if (first !== undefined) current = first
    }
  }

  const closeSortMenus = (): void => {
    for (const open of tabs.querySelectorAll('.rv2-colchip.open')) open.classList.remove('open')
  }

  /** 列のチップに付く「並び替え」（文言は採取物のまま） */
  function sortMenu(key: KpiKey, label: string): HTMLElement {
    const menu = document.createElement('div')
    menu.className = 'rv2-sortmenu'
    const title = document.createElement('div')
    title.className = 'rv2-sortmenu-title'
    title.textContent = '並び替え'
    menu.append(title)
    for (const [text, direction] of [
      ['A-Zで並べ替え', 'asc'],
      ['Z-Aで並べ替え', 'desc'],
    ] as const) {
      const item = document.createElement('button')
      item.type = 'button'
      item.className = 'rv2-sortmenu-item'
      item.textContent = text
      item.title = `${label}の${direction === 'asc' ? '小さい' : '大きい'}順に並べ替えます`
      item.addEventListener('click', () => {
        sort = { key: key as CreativeSortKey, direction }
        closeSortMenus()
        renderParamRows()
      })
      menu.append(item)
    }
    return menu
  }

  // 列選択（採取物と同じ9指標のチェック＋「保存」）
  // 先に作っておく（右上のボタン列へ入れるため）
  const choiceBox = choiceHost
  const choiceForm = document.createElement('form')
  for (const choice of COLUMN_CHOICES) {
    const label = document.createElement('label')
    const box = document.createElement('input')
    box.type = 'checkbox'
    box.name = choice.name
    box.checked = chosen.has(choice.key)
    const text = document.createElement('span')
    text.textContent = choice.label
    label.append(box, text)
    choiceForm.append(label)
  }
  const save = document.createElement('button')
  save.type = 'submit'
  save.className = 'rv2-btn primary'
  save.textContent = '保存'
  choiceForm.append(save)
  choiceForm.addEventListener('submit', (event) => {
    event.preventDefault()
    chosen.clear()
    for (const choice of COLUMN_CHOICES) {
      const box = choiceForm.querySelector<HTMLInputElement>(`input[name="${choice.name}"]`)
      if (box?.checked === true) chosen.add(choice.key)
    }
    if (chosen.size === 0) {
      toast('少なくとも1つは選んでください', 'error')
      chosen.add('ad_cost')
    }
    // 実物と同じく保存する（次に開いたときも同じ列が出る）
    const names = COLUMN_CHOICES.filter((c) => chosen.has(c.key)).map((c) => c.name)
    void api.saveCreativeColumns(names).catch(() => {
      toast('列の保存に失敗しました', 'error')
    })
    renderTabs()
    render()
    renderParamRows()
    choiceBox.classList.remove('open')
  })
  const choiceToggle = document.createElement('button')
  choiceToggle.type = 'button'
  choiceToggle.className = 'rv2-btn'
  choiceToggle.textContent = '列を選ぶ'
  choiceToggle.addEventListener('click', () => choiceBox.classList.toggle('open'))
  choiceBox.append(choiceToggle, choiceForm)

  // 右側は実物と同じく「別軸の比較枠」。比較対象は未設定なので空表示にする。
  const side = emptyBox(
    'データがありません',
    '比較する対象が選ばれていません。\n表の行から比較したいものを選ぶと、ここに並びます。',
  )
  row.append(side)

  /* ── 広告パラメータの一覧（実物はチャートの下に並び、最後に「もっと表示」）── */
  let sort: { key: CreativeSortKey; direction: SortDirection } = { key: 'pv', direction: 'desc' }
  let shownCount = CREATIVE_PAGE_SIZE
  const paramList = document.createElement('div')
  paramList.className = 'rv2-creative-params'

  const renderParamRows = (): void => {
    paramList.innerHTML = ''
    const all = creativeParameterRows(deps.rows ?? [])
    if (all.length === 0) return
    const ordered = sortCreativeRows(all, sort.key, sort.direction)
    for (const entry of ordered.slice(0, shownCount)) {
      const line = document.createElement('div')
      line.className = 'rv2-creative-param'
      const name = document.createElement('span')
      name.className = 'rv2-creative-param-name'
      name.textContent = entry.name
      name.title = entry.name
      const value = document.createElement('span')
      value.className = 'rv2-creative-param-value'
      value.textContent = formatKpi(entry, current)
      line.append(name, value)
      paramList.append(line)
    }
    if (ordered.length > shownCount) {
      const more = document.createElement('button')
      more.type = 'button'
      more.className = 'rv2-readmore'
      more.textContent = 'もっと表示'
      more.addEventListener('click', () => {
        shownCount += CREATIVE_PAGE_SIZE
        renderParamRows()
      })
      paramList.append(more)
    }
  }

  card.append(head, filters, row, paramList)
  loadSavedColumns(chosen, choiceForm, () => {
    renderTabs()
    render()
  })
  renderTabs()
  renderDateChips()
  render()
  renderParamRows()
  return card
}

/** 1行ぶんの値を、今見ている指標の書き方で出す */
function formatKpi(row: ReportVersionRow, key: KpiKey): string {
  const value = row[key]
  if (value === null) return '-'
  if (key === 'ad_cost' || key === 'cpa' || key === 'mcpa') {
    return `¥ ${Math.round(value).toLocaleString('ja-JP')}`
  }
  if (key === 'ctr' || key === 'cvr' || key === 'ctvr') return `${(value * 100).toFixed(2)}%`
  return Math.round(value).toLocaleString('ja-JP')
}

/**
 * 保存済みの列を読み込んで反映する。
 * 実物の `GET /creative_report_user_columns` に対応。読めなければ採取した既定のまま。
 */
function loadSavedColumns(
  chosen: Set<KpiKey>,
  form: HTMLFormElement,
  onLoaded: () => void,
): void {
  void api
    .creativeColumns()
    .then(({ creative_report_user_columns }) => {
      const names = new Set(creative_report_user_columns.map((c) => c.name))
      if (names.size === 0) return
      chosen.clear()
      for (const choice of COLUMN_CHOICES) {
        const on = names.has(choice.name)
        if (on) chosen.add(choice.key)
        const box = form.querySelector<HTMLInputElement>(`input[name="${choice.name}"]`)
        if (box !== null) box.checked = on
      }
      onLoaded()
    })
    .catch(() => {
      /* 読めなければ採取した既定のまま出す */
    })
}
