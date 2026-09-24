/**
 * 配信割合をいつも合計100%にする（2026-09-24・本人「合計で100%にして」）。
 *
 * 以前は、Versionが2つのときだけ「もう片方＝100−その値」にし、3つ以上では合計がずれても保存していた。
 * 配信は「割合÷合計」で配るので、50・50・50 は実際には3等分で、画面の数字と実際が合っていなかった。
 *
 * - 1つを変えたら、残りは**今の比のまま**分け直す（本人の選択）。残りがみんな0%なら均等に
 * - アーカイブ・削除で抜けたぶんは、残りへ今の比のまま広げる
 * - 整数にするときは端数の大きい順に1ずつ足す（合計がちょうど100になる）
 */
import type { State, Version } from './types.ts'

export interface RatioEntry {
  readonly uid: string
  readonly ratio: number
}

/** total を weights の比で整数に分ける（合計はちょうど total・同じ端数なら前の方に足す） */
function allocate(total: number, entries: readonly RatioEntry[]): Map<string, number> {
  const weightSum = entries.reduce((sum, e) => sum + Math.max(0, e.ratio), 0)
  const weights = entries.map((e) => (weightSum === 0 ? 1 : Math.max(0, e.ratio)))
  const sum = weightSum === 0 ? entries.length : weightSum
  const exact = weights.map((w) => (sum === 0 ? 0 : (total * w) / sum))
  const floors = exact.map((x) => Math.floor(x))
  let left = total - floors.reduce((a, b) => a + b, 0)
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  const out = [...floors]
  for (const { i } of order) {
    if (left <= 0) break
    out[i] = (out[i] ?? 0) + 1
    left -= 1
  }
  return new Map(entries.map((e, i) => [e.uid, out[i] ?? 0]))
}

/** 1つ（changedUid）を value にしたときの、全部の割合（Versionが1つなら100） */
export function balanceAfterChange(entries: readonly RatioEntry[], changedUid: string, value: number): Map<string, number> {
  if (entries.length <= 1) return new Map(entries.map((e) => [e.uid, 100]))
  const fixed = Math.max(0, Math.min(100, Math.round(value)))
  const others = entries.filter((e) => e.uid !== changedUid)
  const rest = allocate(100 - fixed, others)
  return new Map(entries.map((e) => [e.uid, e.uid === changedUid ? fixed : (rest.get(e.uid) ?? 0)]))
}

/** 合計を100%にそろえる（全部0%なら、どれを出すか決められないのでそのまま） */
export function normalizeTo100(entries: readonly RatioEntry[]): Map<string, number> {
  const total = entries.reduce((sum, e) => sum + e.ratio, 0)
  if (total === 0 || total === 100) return new Map(entries.map((e) => [e.uid, e.ratio]))
  return allocate(100, entries)
}

/* ── State に当てる ── */

/** そのステップ（記事）の、アーカイブしていないVersion */
export function activeVersionsOf(state: State, articleId: number): Version[] {
  return state.versions.filter((v) => v.article_id === articleId && v.archived !== true)
}

/** 割合をまとめて書く。変わったVersionを返す */
export function applyRatios(state: State, ratios: ReadonlyMap<string, number>): { state: State; changed: Version[] } {
  const changed: Version[] = []
  const versions = state.versions.map((v) => {
    const next = ratios.get(v.uid)
    if (next === undefined || next === v.distribution_ratio) return v
    const updated: Version = { ...v, distribution_ratio: next }
    changed.push(updated)
    return updated
  })
  return changed.length === 0 ? { state, changed } : { state: { ...state, versions }, changed }
}

/** そのステップの割合を合計100%にそろえる（アーカイブ・削除のあと） */
export function normalizeStep(state: State, articleId: number): { state: State; changed: Version[] } {
  const active = activeVersionsOf(state, articleId)
  return applyRatios(state, normalizeTo100(active.map((v) => ({ uid: v.uid, ratio: v.distribution_ratio }))))
}

/** 全部のステップを合計100%にそろえる（今までのデータを起動時に1回・何度やっても同じ） */
export function normalizeAllSteps(state: State): { state: State; changed: Version[] } {
  let next = state
  const changed: Version[] = []
  for (const article of state.articles) {
    const out = normalizeStep(next, article.id)
    next = out.state
    changed.push(...out.changed)
  }
  return { state: next, changed }
}
