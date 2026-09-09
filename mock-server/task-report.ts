/**
 * タスクが送る本文を組み立てる。
 *
 * beyondAI は当システムに無いので、プロンプトを預かるのではなく
 * **実データから決まった形のレポートを作って送る**。
 * 数字が無いときは「0件」と書かず、無いことをそのまま書く（数字を発明しない）。
 */
import { getState } from './store/store.ts'
import { aggregate, deriveKpi, isWithin, toDateKey } from './store/metrics.ts'

export type ReportSpan = 'yesterday' | 'last7days' | 'today'

const SPAN_LABEL: Readonly<Record<ReportSpan, string>> = {
  today: '本日',
  yesterday: '昨日',
  last7days: '直近7日間',
}

function rangeOf(span: ReportSpan, now = new Date()): { start: string; end: string } {
  const shift = (days: number): string => {
    const d = new Date(now)
    d.setDate(d.getDate() + days)
    return toDateKey(d)
  }
  if (span === 'today') return { start: shift(0), end: shift(0) }
  if (span === 'yesterday') return { start: shift(-1), end: shift(-1) }
  return { start: shift(-6), end: shift(0) }
}

const num = (v: number): string => v.toLocaleString('ja-JP')
const pct = (v: number | null): string => (v === null ? '—' : `${(v * 100).toFixed(2)}%`)

/**
 * 通知の本文。装飾は付けない（チャットワークはMarkdownを解釈しないため、
 * どちらのサービスでも同じに読めるプレーンテキストにする）。
 */
export function buildTaskReport(taskName: string, span: ReportSpan, now = new Date()): string {
  const { start, end } = rangeOf(span, now)
  const state = getState()

  const lines: string[] = [
    `[${taskName}]`,
    `${SPAN_LABEL[span]}（${start}${start === end ? '' : ` 〜 ${end}`}）のレポート`,
    '',
  ]

  const rows = state.abTests
    .map((abTest) => {
      const metrics = state.metrics.filter(
        (m) => m.entity_uid === abTest.uid && m.scope === 'ab_test' && isWithin(m.date, start, end),
      )
      return { name: abTest.title, kpi: deriveKpi(aggregate(metrics)) }
    })
    .filter((r) => r.kpi.pv > 0)
    .sort((a, b) => b.kpi.cv - a.kpi.cv || b.kpi.pv - a.kpi.pv)

  if (rows.length === 0) {
    lines.push('この期間に計測されたアクセスはありませんでした。')
    return lines.join('\n')
  }

  const total = rows.reduce(
    (acc, r) => ({ pv: acc.pv + r.kpi.pv, click: acc.click + r.kpi.click, cv: acc.cv + r.kpi.cv }),
    { pv: 0, click: 0, cv: 0 },
  )
  lines.push(
    `合計 PV ${num(total.pv)} / CLICK ${num(total.click)} / CV ${num(total.cv)}`,
    '',
    'ページ別:',
  )
  rows.forEach((r, i) => {
    lines.push(
      `${i + 1}. ${r.name}: PV ${num(r.kpi.pv)} / CLICK ${num(r.kpi.click)} / ` +
        `CTR ${pct(r.kpi.ctr)} / CV ${num(r.kpi.cv)} / CVR ${pct(r.kpi.cvr)}`,
    )
  })
  return lines.join('\n')
}
