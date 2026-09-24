/**
 * 媒体実績（配信金額 / 表示回数 / 媒体クリック / 媒体CV）を出どころごとに持つ（2026-09-24・点検7）。
 *
 * 以前は Meta の取り込みも CSV の取り込みも、その日の媒体実績を**丸ごと置き換えて**いた。
 * そのため CSV を入れると Meta の配信金額・表示回数が消え、CSV に無い列は0で上書きされていた。
 *
 * いまは出どころ（meta / csv）ごとに置き場所を分け、その合計を ad_cost などに入れる。
 * 画面や集計はこれまでどおり ad_cost などを読めばよい（合計は書くたびに出し直す）。
 *
 *  - 同じ出どころを入れ直すと、その出どころのぶんだけ置き換わる（媒体が返すのは日別の絶対値なので二重にしない）
 *  - 渡されなかった値（CSV に列が無い等）は、その出どころの前の値のまま
 *  - 出どころを記録する前の値（legacy）は、どこから来たか分からないので**消さずに残して足す**。
 *    同じ CSV を入れ直す場合など、置き換えたいときは呼び出し側が 'replace' を選ぶ（画面で本人に選んでもらう）
 *  - LP側の実測（pv / click / cv / sales）には触らない
 */
import type { DailyMetric, MediaFigures, MediaSource, ReportScope, State } from './types.ts'

const ZERO: MediaFigures = { ad_cost: 0, imp: 0, media_click: 0, media_cv: 0 }
const FIELDS = ['ad_cost', 'imp', 'media_click', 'media_cv'] as const

/** 古い保存データの行が、媒体実績を1つでも持っているか */
function hasMediaValues(row: DailyMetric): boolean {
  return row.ad_cost > 0 || (row.imp ?? 0) > 0 || (row.media_click ?? 0) > 0 || (row.media_cv ?? 0) > 0
}

/**
 * 行の出どころごとの内訳。内訳を持たない古い行は、今の値を legacy（出どころ不明）として返す。
 */
export function mediaSourcesOf(row: DailyMetric): Partial<Record<MediaSource, MediaFigures>> {
  if (row.media_sources !== undefined) return row.media_sources
  if (!hasMediaValues(row)) return {}
  return {
    legacy: {
      ad_cost: row.ad_cost,
      imp: row.imp ?? 0,
      media_click: row.media_click ?? 0,
      media_cv: row.media_cv ?? 0,
    },
  }
}

function sumSources(sources: Partial<Record<MediaSource, MediaFigures>>): MediaFigures {
  return Object.values(sources).reduce<MediaFigures>(
    (acc, part) => ({
      ad_cost: acc.ad_cost + part.ad_cost,
      imp: acc.imp + part.imp,
      media_click: acc.media_click + part.media_click,
      media_cv: acc.media_cv + part.media_cv,
    }),
    ZERO,
  )
}

/** 古い値（legacy）の扱い。keep ＝ 残して足す / replace ＝ 今回の値で置き換える */
export type LegacyMediaPolicy = 'keep' | 'replace'

/**
 * 1日ぶんの媒体実績を、出どころ `source` の値として書く。
 * 渡さなかった値はその出どころの前の値のまま（無ければ0）。
 */
export function setMediaMetrics(
  state: State,
  entityUid: string,
  scope: Extract<ReportScope, 'ab_test' | 'version' | 'parameter'>,
  date: string,
  source: Exclude<MediaSource, 'legacy'>,
  media: Partial<MediaFigures>,
  legacy: LegacyMediaPolicy = 'keep',
): State['metrics'] {
  const index = state.metrics.findIndex(
    (m) => m.entity_uid === entityUid && m.scope === scope && m.date === date,
  )
  const base: DailyMetric =
    index === -1
      ? { entity_uid: entityUid, scope, date, pv: 0, click: 0, cv: 0, sales: 0, ad_cost: 0 }
      : state.metrics[index]!
  const current = mediaSourcesOf(base)
  const previous = current[source] ?? ZERO
  const nextFigures = FIELDS.reduce<MediaFigures>(
    (acc, field) => ({ ...acc, [field]: media[field] ?? previous[field] }),
    ZERO,
  )
  const { legacy: legacyPart, ...others } = current
  const kept = legacy === 'replace' || legacyPart === undefined ? others : { ...others, legacy: legacyPart }
  const sources: Partial<Record<MediaSource, MediaFigures>> = { ...kept, [source]: nextFigures }
  const total = sumSources(sources)
  const next: DailyMetric = { ...base, ...total, media_sources: sources }
  return index === -1
    ? [...state.metrics, next]
    : state.metrics.map((m, i) => (i === index ? next : m))
}

/**
 * 期間内の日ごとの出どころの内訳（読むだけ）。
 * 取り込みの前に「この日には出どころ不明の値が残っている」と本人に見せるために使う。
 */
export function mediaSourcesByDate(
  state: State,
  entityUid: string,
  dates: readonly string[],
): { date: string; sources: Partial<Record<MediaSource, MediaFigures>> }[] {
  const wanted = new Set(dates)
  return state.metrics
    .filter((m) => m.entity_uid === entityUid && m.scope === 'ab_test' && wanted.has(m.date))
    .map((m) => ({ date: m.date, sources: mediaSourcesOf(m) }))
    .filter((entry) => Object.keys(entry.sources).length > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
}
