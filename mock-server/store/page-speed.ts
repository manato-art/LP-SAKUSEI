/**
 * 表示が遅い人の割合（2026-09-16・本人の依頼）。
 *
 * Versionごとに「読み込みに3秒以上かかった人が何％か」を出す。
 * FV通過率が低いときに、原因が中身なのか重さなのかを切り分けるための数字。
 *
 * 材料は計測タグが離脱時に送る「読み込み完了までの時間」（Navigation Timing の loadEventEnd）。
 * iPhoneのSafariでも取れる指標にした（LCPはSafariで取れない端末があり、広告の流入はiPhoneが多い）。
 *
 * 数え方で気をつけたこと:
 *  - **読み込みが終わる前に帰った人を捨てない**。遅くて帰った人ほど「終わった記録」を残さないので、
 *    終わった人だけで数えると遅さを小さく見積もる。3秒以上待って帰った人は「遅かった」に入れる
 *  - 3秒たたずに、読み込みが終わる前に帰った人は**遅かったか分からない**ので、割合の分母に入れない
 */
import { isWithin } from './metrics.ts'

/** これ以上かかったら「遅い」 */
export const SLOW_MS = 3000

/**
 * 読み込み完了までの時間の区切り（ミリ秒）。
 * 分布は [〜1秒, 〜2秒, 〜3秒, 〜5秒, 〜10秒, 10秒〜] の6つ。
 */
const BUCKET_EDGES_MS: readonly number[] = [1000, 2000, SLOW_MS, 5000, 10_000]

/** 「遅い」に入る最初の区切り（3秒以上） */
const FIRST_SLOW_BUCKET = BUCKET_EDGES_MS.indexOf(SLOW_MS) + 1

/** これより長い値は表示の遅さではない（裏のタブで開きっぱなしだった、など）ので捨てる */
const MAX_MS = 10 * 60 * 1000

export interface PageSpeedStat {
  ab_test_uid: string
  version_uid: string
  /** JSTの日付（YYYY-MM-DD） */
  date: string
  /** 読み込みが終わった人の、終わるまでの時間の分布（BUCKET_EDGES_MS の区切り） */
  loaded: number[]
  /** 読み込みが終わる前に帰った人のうち、3秒以上待っていた人（＝遅かった） */
  left_slow: number
  /** 読み込みが終わる前に、3秒たたずに帰った人（遅かったかは分からない） */
  left_unknown: number
}

export interface LoadTiming {
  ms: number
  /** 読み込みが終わっていたか */
  done: boolean
}

/** 計測タグから届いた `{ ms, done }` を読む。おかしな値は null（送り口は誰でも叩けるので） */
export function parseLoad(raw: unknown): LoadTiming | null {
  if (raw === null || typeof raw !== 'object') return null
  const { ms, done } = raw as Record<string, unknown>
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0 || ms > MAX_MS) return null
  if (done !== 0 && done !== 1) return null
  return { ms: Math.round(ms), done: done === 1 }
}

function bucketOf(ms: number): number {
  const index = BUCKET_EDGES_MS.findIndex((edge) => ms < edge)
  return index === -1 ? BUCKET_EDGES_MS.length : index
}

/** 1人ぶん足す（同じページ・Version・日は1行に足し込む） */
export function recordPageSpeed(
  stats: readonly PageSpeedStat[],
  key: { ab_test_uid: string; version_uid: string; date: string },
  load: LoadTiming,
): PageSpeedStat[] {
  const same = (s: PageSpeedStat): boolean =>
    s.ab_test_uid === key.ab_test_uid && s.version_uid === key.version_uid && s.date === key.date
  const base: PageSpeedStat = stats.find(same) ?? {
    ...key,
    loaded: new Array<number>(BUCKET_EDGES_MS.length + 1).fill(0),
    left_slow: 0,
    left_unknown: 0,
  }
  const next: PageSpeedStat = load.done
    ? { ...base, loaded: base.loaded.map((n, i) => (i === bucketOf(load.ms) ? n + 1 : n)) }
    : load.ms >= SLOW_MS
      ? { ...base, left_slow: base.left_slow + 1 }
      : { ...base, left_unknown: base.left_unknown + 1 }
  return stats.some(same) ? stats.map((s) => (same(s) ? next : s)) : [...stats, next]
}

/**
 * 期間内の「3秒以上かかった人の割合」。
 * `versionUids` を渡せばそのVersionだけ、`abTestUid` ならページの全Version。
 * 記録が無ければ割合は null（0%と言わない）。
 */
export function speedSummary(
  stats: readonly PageSpeedStat[],
  filter: { abTestUid?: string; versionUids?: readonly string[]; start: string; end: string },
): { slow_share: number | null; samples: number } {
  const versions = filter.versionUids === undefined ? null : new Set(filter.versionUids)
  let slow = 0
  let fast = 0
  for (const s of stats) {
    if (!isWithin(s.date, filter.start, filter.end)) continue
    if (filter.abTestUid !== undefined && s.ab_test_uid !== filter.abTestUid) continue
    if (versions !== null && !versions.has(s.version_uid)) continue
    s.loaded.forEach((n, i) => {
      if (i >= FIRST_SLOW_BUCKET) slow += n
      else fast += n
    })
    slow += s.left_slow
  }
  const samples = slow + fast
  return { slow_share: samples === 0 ? null : slow / samples, samples }
}
