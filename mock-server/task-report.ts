/**
 * タスクが送る本文を組み立てる。
 *
 * beyondAI は当システムに無いので、プロンプトを預かるのではなく
 * **実データから決まった形のレポートを作って送る**。
 * 数字が無いときは「0件」と書かず、無いことをそのまま書く（数字を発明しない）。
 *
 * 2026-09-15、本人の依頼で中身を増やした:
 *  ページごとの詳細＋Versionの内訳＋ヒートマップの要点を1通で。
 * 何を載せるかはタスクごとの設定（report-items.ts）で決める。
 *
 * 総合スコア（0〜100の点数）も一度入れたが、本人の判断で外した。
 * 相対評価なのでページが2つだと必ず0点と100点になり、数字のわりに読み取れることが少なかった。
 *
 * 指標の定義はここで作らない。CVR/CTR/CPA/FV離脱率などは `store/metrics.ts` の
 * `deriveKpi`、スクロールの数え方は `store/scroll-counts.ts` に一本化してある。
 */
import { getState } from './store/store.ts'
import { deriveKpi, isWithin, sumPrimary, toDateKey } from './store/metrics.ts'
import { exitPeak, scrollCountsForAbTest } from './store/scroll-counts.ts'
import { DEFAULT_REPORT_ITEMS, type ReportItems } from './report-items.ts'
import type { DerivedKpi } from './store/metrics.ts'
import type { State } from './store/types.ts'

export type ReportSpan = 'yesterday' | 'last7days' | 'today'

const SPAN_LABEL: Readonly<Record<ReportSpan, string>> = {
  today: '本日',
  yesterday: '昨日',
  last7days: '直近7日間',
}

interface Range {
  start: string
  end: string
}

function rangeOf(span: ReportSpan, now = new Date()): Range {
  const shift = (days: number): string => {
    const d = new Date(now)
    d.setDate(d.getDate() + days)
    return toDateKey(d)
  }
  if (span === 'today') return { start: shift(0), end: shift(0) }
  if (span === 'yesterday') return { start: shift(-1), end: shift(-1) }
  return { start: shift(-6), end: shift(0) }
}

/** 同じ長さだけ前にずらした期間（前日比・前週比の相手） */
function previousRange(range: Range): Range {
  const toDate = (key: string): Date => new Date(`${key}T00:00:00Z`)
  const days = Math.round((toDate(range.end).getTime() - toDate(range.start).getTime()) / 86_400_000) + 1
  const shift = (key: string): string => {
    const d = toDate(key)
    d.setUTCDate(d.getUTCDate() - days)
    return toDateKey(d)
  }
  return { start: shift(range.start), end: shift(range.end) }
}

const num = (v: number): string => v.toLocaleString('ja-JP')
const pct = (v: number | null): string => (v === null ? '—' : `${(v * 100).toFixed(2)}%`)
const yen = (v: number): string => `${Math.round(v).toLocaleString('ja-JP')}円`

/** 増減を「+240（+24%）」の形で。前が0なら率は出さない（無限大になる）。 */
function delta(now: number, before: number): string {
  const diff = now - before
  const sign = diff > 0 ? '+' : ''
  if (before === 0) return `${sign}${num(diff)}`
  return `${sign}${num(diff)}（${sign}${((diff / before) * 100).toFixed(0)}%）`
}

/** ページ1つぶんの実測。ヒートマップの一次値も混ぜてから1回だけ派生を出す。 */
function kpiForAbTest(state: State, abTestUid: string, range: Range): DerivedKpi {
  const metrics = state.metrics.filter(
    (m) => m.entity_uid === abTestUid && m.scope === 'ab_test' && isWithin(m.date, range.start, range.end),
  )
  return deriveKpi({
    ...sumPrimary(metrics),
    ...scrollCountsForAbTest(state, abTestUid, range.start, range.end),
  })
}

/** そのページにぶら下がるVersion（記事ごしに辿る） */
function versionsOf(state: State, abTestId: number): { uid: string; name: string }[] {
  const articleIds = new Set(
    state.articles.filter((a) => a.ab_test_id === abTestId).map((a) => a.id),
  )
  return state.versions
    .filter((v) => articleIds.has(v.article_id))
    .map((v) => ({ uid: v.uid, name: v.name }))
}

function kpiForVersion(state: State, versionUid: string, range: Range): DerivedKpi {
  const metrics = state.metrics.filter(
    (m) => m.entity_uid === versionUid && m.scope === 'version' && isWithin(m.date, range.start, range.end),
  )
  return deriveKpi(sumPrimary(metrics))
}

/** 主要数値の1行 */
function basicsLine(kpi: DerivedKpi): string {
  return (
    `PV ${num(kpi.pv)} / CLICK ${num(kpi.click)} / CTR ${pct(kpi.ctr)} / ` +
    `CV ${num(kpi.cv)} / CVR ${pct(kpi.cvr)}`
  )
}

/** ヒートマップの要点。計っていなければ null（0%と書かない） */
function heatmapLine(state: State, abTestUid: string, kpi: DerivedKpi, range: Range): string | null {
  if (kpi.hm_pv === 0) return null
  const parts: string[] = []
  if (kpi.fver !== null) parts.push(`FV通過 ${pct(1 - kpi.fver)}`)
  const peak = exitPeak(state, abTestUid, range.start, range.end)
  if (peak !== null) {
    parts.push(`いちばん離脱が多いのは ${peak.depth_percent}% あたり（${pct(peak.rate)}）`)
  }
  if (kpi.oar !== null) parts.push(`オファー到達 ${pct(kpi.oar)}`)
  return parts.length === 0 ? null : `ヒートマップ ${parts.join(' / ')}`
}

/**
 * 通知の本文。装飾は付けない（チャットワークもLINEもMarkdownを解釈しないため、
 * どのサービスでも同じに読めるプレーンテキストにする）。
 */
export function buildTaskReport(
  taskName: string,
  span: ReportSpan,
  now = new Date(),
  items: ReportItems = DEFAULT_REPORT_ITEMS,
): string {
  const range = rangeOf(span, now)
  const previous = previousRange(range)
  const state = getState()

  const lines: string[] = [
    `[${taskName}]`,
    `${SPAN_LABEL[span]}（${range.start}${range.start === range.end ? '' : ` 〜 ${range.end}`}）のレポート`,
    '',
  ]

  const rows = state.abTests
    .map((abTest) => ({
      id: abTest.id,
      uid: abTest.uid,
      name: abTest.title,
      kpi: kpiForAbTest(state, abTest.uid, range),
      before: kpiForAbTest(state, abTest.uid, previous),
    }))
    .filter((r) => r.kpi.pv > 0)

  if (rows.length === 0) {
    lines.push('この期間に計測されたアクセスはありませんでした。')
    return lines.join('\n')
  }

  // CVの多い順。同じならPVの多い順
  const ordered = [...rows].sort((a, b) => b.kpi.cv - a.kpi.cv || b.kpi.pv - a.kpi.pv)

  /* ── 合計 ── */
  const sum = (pick: (k: DerivedKpi) => number): number => rows.reduce((t, r) => t + pick(r.kpi), 0)
  const sumBefore = (pick: (k: DerivedKpi) => number): number =>
    rows.reduce((t, r) => t + pick(r.before), 0)
  lines.push(`合計 PV ${num(sum((k) => k.pv))} / CLICK ${num(sum((k) => k.click))} / CV ${num(sum((k) => k.cv))}`)
  if (items.compare) {
    lines.push(
      `　前の期間（${previous.start}${previous.start === previous.end ? '' : ` 〜 ${previous.end}`}）と比べて ` +
        `PV ${delta(sum((k) => k.pv), sumBefore((k) => k.pv))} / CV ${delta(sum((k) => k.cv), sumBefore((k) => k.cv))}`,
    )
  }
  if (items.cost) {
    // 広告費を取り込んでいないページのCVを分母に入れるとCPAが安く見える。
    // 取り込めているページだけで出して、除いたことを書く。
    const withCost = rows.filter((r) => r.kpi.ad_cost > 0)
    const cost = withCost.reduce((t, r) => t + r.kpi.ad_cost, 0)
    const cv = withCost.reduce((t, r) => t + r.kpi.cv, 0)
    const missing = rows.length - withCost.length
    lines.push(
      cost === 0
        ? '　広告費 未取込'
        : `　広告費 ${yen(cost)} / CPA ${cv === 0 ? '—' : yen(cost / cv)}` +
            (missing === 0 ? '' : `（${missing}ページは広告費が未取込のため除く）`),
    )
  }
  lines.push('', 'ページ別:')

  /* ── ページごと ── */
  ordered.forEach((row, i) => {
    lines.push(`${i + 1}. ${row.name}`)
    if (items.basics) lines.push(`　 ${basicsLine(row.kpi)}`)
    if (items.compare) {
      lines.push(
        `　 前の期間と比べて PV ${delta(row.kpi.pv, row.before.pv)} / CV ${delta(row.kpi.cv, row.before.cv)}`,
      )
    }
    if (items.cost) {
      lines.push(
        row.kpi.ad_cost === 0
          ? '　 広告費 未取込'
          : `　 広告費 ${yen(row.kpi.ad_cost)} / CPA ${row.kpi.cpa === null ? '—' : yen(row.kpi.cpa)}`,
      )
    }
    if (items.heatmap) {
      const line = heatmapLine(state, row.uid, row.kpi, range)
      if (line !== null) lines.push(`　 ${line}`)
    }
    if (items.versions) {
      const versions = versionsOf(state, row.id)
        .map((v) => ({ ...v, kpi: kpiForVersion(state, v.uid, range) }))
        .filter((v) => v.kpi.pv > 0)
        .sort((a, b) => (b.kpi.cvr ?? -1) - (a.kpi.cvr ?? -1))
      versions.forEach((v, vi) => {
        // いちばんCVRが高い案に印。どれを伸ばすかを見るための行なので、順位が要る
        const mark = vi === 0 && versions.length > 1 ? ' ★' : ''
        lines.push(
          `　 ・${v.name}  PV ${num(v.kpi.pv)} / CV ${num(v.kpi.cv)} / CVR ${pct(v.kpi.cvr)}${mark}`,
        )
      })
    }
  })

  return lines.join('\n')
}
