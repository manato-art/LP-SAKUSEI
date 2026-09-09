/**
 * 指示178: フィルター行と「クリエイティブレポート」の折れ線。
 *
 * 折れ線は依存を足さず素のSVGで描く（package.json は触らない規約）。
 * 実物は Recharts だが、採取した静止SVGを置くだけだと期間を変えても動かないので、
 * ここは**実データから毎回描き直す**ようにしている。
 */
import type { ReportDailyRow } from '../api.ts'
import type { DateRange } from './report-period.ts'
import type { KpiKey } from './report-v2-kpi.ts'

/** グラフのタブ（実物のクリエイティブレポートと同じ並び） */
const CHART_TABS: readonly { key: KpiKey; label: string }[] = [
  { key: 'ad_cost', label: '配信金額' },
  { key: 'cv', label: 'CV' },
  { key: 'cpa', label: 'CPA' },
  { key: 'ctr', label: 'CTR' },
  { key: 'cvr', label: 'CVR' },
]

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
  if (points.length < 2) return null

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
  const x = (i: number): number => padL + (i / (points.length - 1)) * innerW
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
  area.setAttribute(
    'points',
    `${padL},${padT + innerH} ${line} ${(padL + innerW).toFixed(1)},${padT + innerH}`,
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

  const tabs = document.createElement('div')
  tabs.className = 'rv2-tabs'
  const right = document.createElement('div')
  right.className = 'rv2-head-right'
  const csv = document.createElement('button')
  csv.type = 'button'
  csv.className = 'rv2-btn primary'
  csv.textContent = 'CSVダウンロード'
  csv.addEventListener('click', deps.onDownloadCsv)
  right.append(csv)
  head.append(title, hint, tabs, right)

  const row = document.createElement('div')
  row.className = 'rv2-chart-row'
  const left = document.createElement('div')
  const legend = document.createElement('div')
  legend.className = 'rv2-legend'
  const holder = document.createElement('div')
  left.append(legend, holder)
  row.append(left)

  let current: KpiKey = 'ad_cost'
  const render = (): void => {
    const def = CHART_TABS.find((t) => t.key === current)
    legend.innerHTML = ''
    const dot = document.createElement('i')
    const name = document.createElement('span')
    name.textContent = def?.label ?? ''
    legend.append(dot, name)

    holder.innerHTML = ''
    const chart = drawChart(deps.daily, current)
    holder.append(
      chart ??
        emptyBox(
          'データがありません',
          '選択した期間のデータがまだありません。\n期間を広げるか、フィルターを変更して再度お試しください。',
        ),
    )
    for (const b of tabs.querySelectorAll('button')) {
      b.classList.toggle('on', b.dataset['key'] === current)
    }
  }

  for (const t of CHART_TABS) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'rv2-tab'
    b.dataset['key'] = t.key
    b.textContent = t.label
    b.addEventListener('click', () => {
      current = t.key
      render()
    })
    tabs.append(b)
  }

  // 右側は実物と同じく「別軸の比較枠」。比較対象は未設定なので空表示にする。
  const side = emptyBox(
    'データがありません',
    '比較する対象が選ばれていません。\n表の行から比較したいものを選ぶと、ここに並びます。',
  )
  row.append(side)

  card.append(head, row)
  render()
  return card
}
