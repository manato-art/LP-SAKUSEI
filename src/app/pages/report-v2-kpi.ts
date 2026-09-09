/**
 * 指示178: レポート上部の KPI カード7枚（配信金額 / PV / CLICK / CTR / CV / CVR / CPA）。
 *
 * 各カードは「数字」「前期間との増減」「スパークライン」を出す。
 * 増減は**同じ日数の直前の期間**と比べたもの（例: 6/16〜6/30 なら 6/1〜6/15）。
 * データが無い期間は増減を出さない（0%と書くと「変化なし」に見えて誤解を招く）。
 */
import type { ReportDailyRow, ReportKpi } from '../api.ts'

export type KpiKey = 'ad_cost' | 'pv' | 'click' | 'ctr' | 'cv' | 'cvr' | 'cpa'

interface KpiDef {
  key: KpiKey
  label: string
  /** 値の出し方 */
  format: (v: number | null) => string
  /** 大きいほど良い指標か（CPAだけ小さいほど良い＝増加が赤） */
  higherIsBetter: boolean
  icon: string
}

const yen = (v: number | null): string =>
  v === null ? '-' : `¥ ${Math.round(v).toLocaleString('ja-JP')}`
const int = (v: number | null): string => (v === null ? '-' : Math.round(v).toLocaleString('ja-JP'))
const pct = (v: number | null): string => (v === null ? '-' : `${(v * 100).toFixed(2)}%`)

/** 単色のSVGアイコン（共通指示「UIは絵文字をやめSVGアイコンに」） */
function icon(paths: string): string {
  return (
    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`
  )
}

const KPIS: readonly KpiDef[] = [
  {
    key: 'ad_cost',
    label: '配信金額',
    format: yen,
    higherIsBetter: false,
    icon: icon('<path d="M12 3v18"/><path d="M7 6l5 5 5-5"/><path d="M7 12h10"/><path d="M7 16h10"/>'),
  },
  {
    key: 'pv',
    label: 'PV',
    format: int,
    higherIsBetter: true,
    icon: icon('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>'),
  },
  {
    key: 'click',
    label: 'CLICK',
    format: int,
    higherIsBetter: true,
    icon: icon('<path d="m4 4 6.5 16 2.3-6.7L19.5 11 4 4Z"/>'),
  },
  {
    key: 'ctr',
    label: 'CTR',
    format: pct,
    higherIsBetter: true,
    icon: icon('<path d="m19 5-14 14"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>'),
  },
  {
    key: 'cv',
    label: 'CV',
    format: int,
    higherIsBetter: true,
    icon: icon('<path d="M16 20v-2a4 4 0 0 0-8 0v2"/><circle cx="12" cy="8" r="3.5"/><path d="M20 20v-1.5a3.5 3.5 0 0 0-3-3.4"/>'),
  },
  {
    key: 'cvr',
    label: 'CVR',
    format: pct,
    higherIsBetter: true,
    icon: icon('<path d="M3 20h18"/><path d="M6 20v-6"/><path d="M11 20V8"/><path d="M16 20v-9"/><path d="M21 20V5"/>'),
  },
  {
    key: 'cpa',
    label: 'CPA',
    format: yen,
    // CPAは「1CVあたりいくらかかったか」。増えると悪化なので、増加を赤で出す。
    higherIsBetter: false,
    icon: icon('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>'),
  },
]

function valueOf(kpi: ReportKpi, key: KpiKey): number | null {
  switch (key) {
    case 'ad_cost':
      return kpi.ad_cost
    case 'pv':
      return kpi.pv
    case 'click':
      return kpi.click
    case 'cv':
      return kpi.cv
    case 'ctr':
      return kpi.ctr
    case 'cvr':
      return kpi.cvr
    case 'cpa':
      return kpi.cpa
  }
}

/** 日別の値（スパークライン用） */
function seriesOf(daily: readonly ReportDailyRow[], key: KpiKey): number[] {
  return daily.map((d) => valueOf(d, key) ?? 0)
}

/** 折れ線を1本だけ描く小さなSVG。値が1点以下なら描かない。 */
function sparkline(values: readonly number[]): SVGSVGElement | null {
  if (values.length < 2) return null
  const w = 76
  const h = 26
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min
  const x = (i: number): number => (i / (values.length - 1)) * (w - 2) + 1
  const y = (v: number): number => (span < 1e-9 ? h / 2 : h - 3 - ((v - min) / span) * (h - 6))
  const line = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('class', 'rv2-spark')
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`)
  svg.setAttribute('preserveAspectRatio', 'none')
  const area = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
  area.setAttribute('points', `${x(0).toFixed(1)},${h} ${line} ${x(values.length - 1).toFixed(1)},${h}`)
  area.setAttribute('fill', 'rgba(37,99,235,.10)')
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
  path.setAttribute('points', line)
  path.setAttribute('fill', 'none')
  path.setAttribute('stroke', 'var(--sb-accent, #2563EB)')
  path.setAttribute('stroke-width', '1.6')
  path.setAttribute('stroke-linejoin', 'round')
  svg.append(area, path)
  return svg
}

/**
 * 増減の表示。前期間が無い・0のときは出さない
 * （0からの増加を「+∞%」や「+100%」と書くと数字として意味を持たないため）。
 */
function deltaEl(current: number | null, previous: number | null, higherIsBetter: boolean): HTMLElement {
  const el = document.createElement('span')
  el.className = 'rv2-delta flat'
  if (current === null || previous === null || previous === 0) {
    el.textContent = '前期間なし'
    return el
  }
  const ratio = (current - previous) / Math.abs(previous)
  const isUp = ratio > 0
  const good = isUp === higherIsBetter
  el.className = `rv2-delta ${Math.abs(ratio) < 1e-9 ? 'flat' : good ? 'up' : 'down'}`
  const arrow = Math.abs(ratio) < 1e-9 ? '→' : isUp ? '↑' : '↓'
  el.textContent = `${arrow} ${(Math.abs(ratio) * 100).toFixed(1)}%`
  el.title = `前期間 ${previous.toLocaleString('ja-JP')} との比較`
  return el
}

export interface KpiInput {
  totals: ReportKpi
  daily: readonly ReportDailyRow[]
  /** 同じ日数の直前の期間。取得できなければ null（増減を出さない） */
  previous: ReportKpi | null
}

/** KPIカード7枚を組み立てる */
export function buildKpiCards(input: KpiInput): HTMLElement {
  const grid = document.createElement('div')
  grid.className = 'rv2-kpis'

  for (const def of KPIS) {
    const card = document.createElement('div')
    card.className = 'rv2-card rv2-kpi'

    const top = document.createElement('div')
    top.className = 'rv2-kpi-top'
    const ic = document.createElement('span')
    ic.className = 'rv2-kpi-icon'
    ic.innerHTML = def.icon
    const label = document.createElement('span')
    label.className = 'rv2-kpi-label'
    label.textContent = def.label
    top.append(ic, label)

    const value = document.createElement('div')
    value.className = 'rv2-kpi-value'
    value.textContent = def.format(valueOf(input.totals, def.key))

    const foot = document.createElement('div')
    foot.className = 'rv2-kpi-foot'
    foot.append(
      deltaEl(
        valueOf(input.totals, def.key),
        input.previous === null ? null : valueOf(input.previous, def.key),
        def.higherIsBetter,
      ),
    )
    const spark = sparkline(seriesOf(input.daily, def.key))
    if (spark !== null) foot.append(spark)

    card.append(top, value, foot)
    grid.append(card)
  }
  return grid
}
