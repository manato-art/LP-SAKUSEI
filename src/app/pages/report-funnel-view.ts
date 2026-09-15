/**
 * レポートの「ファネル」節の画面（2026-09-15）。
 *
 * 形は採取物どおり（capture/clean/ab_tests__UID__reports/report-settings-modal の
 * `_reportWrapper_1rrna_96`）: 見出し＋日付select＋期間 / タブ「詳細」「比較」 /
 * 3列（経路・PV数/割合・ファネル分析）＋まとめ（PV / CV / CVR）。
 * 見た目はこの画面の既存の部品（rv2-*）に合わせる。
 */
import type { ReportKpi, ReportVersionRow } from '../api.ts'
import type { DateRange } from './report-period.ts'
import { FUNNEL_DATE_PRESETS, funnelStages, type FunnelStage } from './report-funnel.ts'

export interface FunnelDeps {
  totals: ReportKpi
  rows: readonly ReportVersionRow[]
  range: DateRange
  /** 日付プリセットを選んだとき（上部フィルターと同じ道を通す） */
  onPreset: (value: string) => void
}

const pct = (v: number | null): string => (v === null ? '-' : `${(v * 100).toFixed(2)}%`)
const int = (v: number): string => v.toLocaleString('ja-JP')

/**
 * 1本ぶんの「経路 / PV数・割合 / 棒」を組む。
 *
 * 3列のグリッドに**段ごとの行**を流し込む（列ごとに縦に積むのではなく）。
 * こうしておくと、スマホで `display:contents` を外すだけで
 * 「段名・数値・棒」が段ごとにまとまる。列ごとに積むと、スマホでは
 * 経路が3つ続いたあとに数値が3つ続く、という読めない並びになる（実機で踏んだ）。
 */
function buildStageColumns(stages: readonly FunnelStage[]): HTMLElement {
  const body = document.createElement('div')
  body.className = 'rv2-funnel-body'

  const headGroup = document.createElement('div')
  headGroup.className = 'rv2-funnel-headgroup'
  for (const label of ['経路', 'PV数/割合']) {
    const head = document.createElement('div')
    head.className = 'rv2-funnel-head'
    head.textContent = label
    headGroup.append(head)
  }
  // 見出しと凡例は同じ行に置く。縦に積むと、この列だけ1行ぶん下がって
  // 左の「経路」「PV数/割合」と棒の高さが揃わない。
  const graphHeadRow = document.createElement('div')
  graphHeadRow.className = 'rv2-funnel-head rv2-funnel-headrow'
  const graphHead = document.createElement('span')
  graphHead.textContent = 'ファネル分析'
  const legends = document.createElement('span')
  legends.className = 'rv2-funnel-legends'
  for (const [label, kind] of [
    ['PV', 'pv'],
    ['離脱', 'exit'],
  ] as const) {
    const legend = document.createElement('span')
    legend.className = `rv2-funnel-legend ${kind}`
    legend.textContent = label
    legends.append(legend)
  }
  graphHeadRow.append(graphHead, legends)
  headGroup.append(graphHeadRow)
  body.append(headGroup)

  for (const stage of stages) {
    const row = document.createElement('div')
    row.className = 'rv2-funnel-row'

    const name = document.createElement('div')
    name.className = 'rv2-funnel-cell rv2-funnel-name'
    name.textContent = stage.name

    const count = document.createElement('div')
    count.className = 'rv2-funnel-cell rv2-funnel-count'
    count.textContent = `${int(stage.count)} / ${pct(stage.share)}`

    const bars = document.createElement('div')
    bars.className = 'rv2-funnel-cell rv2-funnel-bars'
    for (const [kind, value] of [
      ['pv', stage.share],
      ['exit', stage.exitShare],
    ] as const) {
      const track = document.createElement('div')
      track.className = 'rv2-funnel-track'
      const bar = document.createElement('div')
      bar.className = `rv2-funnel-bar ${kind}`
      bar.style.width = `${Math.min(100, (value ?? 0) * 100)}%`
      bar.title = `${kind === 'pv' ? 'PV' : '離脱'} ${pct(value)}`
      track.append(bar)
      bars.append(track)
    }

    row.append(name, count, bars)
    body.append(row)
  }

  // 目盛（採取物どおり 0 / 20 / 40 / 60 / 80 / 100(%)）
  const scales = document.createElement('div')
  scales.className = 'rv2-funnel-scales'
  for (const label of ['0', '20', '40', '60', '80', '100(%)']) {
    const tick = document.createElement('span')
    tick.textContent = label
    scales.append(tick)
  }
  body.append(scales)
  return body
}

/** まとめ（PV / CV / CVR） */
function buildSummary(kpi: ReportKpi): HTMLElement {
  const summary = document.createElement('div')
  summary.className = 'rv2-funnel-summary'
  for (const [label, text] of [
    ['PV', int(kpi.pv)],
    ['CV', int(kpi.cv)],
    ['CVR', pct(kpi.cvr)],
  ] as const) {
    const item = document.createElement('div')
    item.className = 'rv2-funnel-summary-item'
    const name = document.createElement('span')
    name.textContent = label
    const value = document.createElement('b')
    value.textContent = text
    item.append(name, value)
    summary.append(item)
  }
  return summary
}

/** 「ファネル」カード */
export function buildFunnelReport(deps: FunnelDeps): HTMLElement {
  const card = document.createElement('section')
  card.className = 'rv2-card'

  const head = document.createElement('div')
  head.className = 'rv2-head'
  const title = document.createElement('span')
  title.className = 'rv2-title'
  title.textContent = 'ファネル'

  const preset = document.createElement('select')
  preset.className = 'rv2-select'
  for (const option of FUNNEL_DATE_PRESETS) {
    const el = document.createElement('option')
    el.value = option.value
    el.textContent = option.label
    preset.append(el)
  }
  preset.addEventListener('change', () => deps.onPreset(preset.value))

  const rangeText = document.createElement('span')
  rangeText.className = 'rv2-funnel-range'
  rangeText.textContent = `${deps.range.startDate} ~ ${deps.range.endDate}`

  const tabs = document.createElement('div')
  tabs.className = 'rv2-tabs'

  head.append(title, preset, rangeText, tabs)

  const holder = document.createElement('div')
  holder.className = 'rv2-funnel'

  /** 詳細＝選んだVersion（既定は全体）の1本 / 比較＝Versionを横に並べる */
  let mode: '詳細' | '比較' = '詳細'
  let versionUid = ''

  const picker = document.createElement('select')
  picker.className = 'rv2-select rv2-funnel-picker'
  const all = document.createElement('option')
  all.value = ''
  all.textContent = 'すべてのVersion'
  picker.append(all)
  for (const row of deps.rows) {
    const option = document.createElement('option')
    option.value = row.entity_uid
    option.textContent = row.name
    picker.append(option)
  }
  picker.addEventListener('change', () => {
    versionUid = picker.value
    render()
  })

  const kpiOf = (uid: string): ReportKpi =>
    uid === '' ? deps.totals : (deps.rows.find((r) => r.entity_uid === uid) ?? deps.totals)

  const render = (): void => {
    holder.innerHTML = ''
    picker.hidden = mode === '比較'
    if (mode === '詳細') {
      const kpi = kpiOf(versionUid)
      holder.append(picker, buildStageColumns(funnelStages(kpi)), buildSummary(kpi))
    } else {
      holder.append(picker)
      if (deps.rows.length === 0) {
        const empty = document.createElement('div')
        empty.className = 'rv2-funnel-empty'
        empty.textContent = '比較できるVersionがありません'
        holder.append(empty)
      }
      for (const row of deps.rows) {
        const block = document.createElement('div')
        block.className = 'rv2-funnel-compare'
        const name = document.createElement('div')
        name.className = 'rv2-funnel-compare-name'
        name.textContent = row.name
        block.append(name, buildStageColumns(funnelStages(row)), buildSummary(row))
        holder.append(block)
      }
    }
    for (const button of tabs.querySelectorAll('button')) {
      button.classList.toggle('on', button.textContent === mode)
    }
  }

  for (const label of ['詳細', '比較'] as const) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'rv2-tab'
    button.textContent = label
    button.addEventListener('click', () => {
      mode = label
      render()
    })
    tabs.append(button)
  }

  card.append(head, holder)
  render()
  return card
}
