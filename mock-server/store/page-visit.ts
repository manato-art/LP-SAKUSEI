/**
 * 本番URLの発行と、本物の人が見に来た記録（2026-10-30 本人）。決まりの正本は src/shared/page-issue.ts。
 *
 *   - 発行（管理者だけ・編集ページの「本番URLを発行」）: issued を立てる。札は変えない
 *   - 本物の人のPV（ボット・レポート除外を除く・routes/delivery.ts）: 最後に来た日を残し、札が準備中なら配信中にする。
 *     自分で決めた停止中・終了は変えない。ページの記録は1日に1回しか書き換えない（PVのたびに保存し直さない）
 *   - 前からあるページの最後に来た日は、残っている日ごとの数字（PVがある日）から1回だけ埋める
 */
import { nowTs } from './actions-shared.ts'
import type { AbTest, State } from './types.ts'

export function issueAbTest(state: State, uid: string): { state: State; abTest: AbTest | null } {
  const target = state.abTests.find((t) => t.uid === uid)
  if (target === undefined) return { state, abTest: null }
  if (target.issued !== false) return { state, abTest: target }
  const updated: AbTest = { ...target, issued: true, issued_at: nowTs() }
  return { state: { ...state, abTests: state.abTests.map((t) => (t.uid === uid ? updated : t)) }, abTest: updated }
}

export function noteRealVisit(state: State, uid: string, date: string): State {
  const target = state.abTests.find((t) => t.uid === uid)
  if (target === undefined) return state
  const status = target.ad_status === 'prepared' ? 'delivered' : target.ad_status
  if (target.last_visit_date === date && status === target.ad_status) return state
  // 更新日（updated_at）は変えない（中身を直した日ではないので、一覧の「更新順」を動かさない）
  const updated: AbTest = { ...target, ad_status: status, last_visit_date: date }
  return { ...state, abTests: state.abTests.map((t) => (t.uid === uid ? updated : t)) }
}

export function backfillLastVisitDates(state: State): { state: State; changed: number } {
  const latest = new Map<string, string>()
  for (const m of state.metrics) {
    if (m.scope !== 'ab_test' || m.pv <= 0) continue
    const seen = latest.get(m.entity_uid)
    if (seen === undefined || m.date > seen) latest.set(m.entity_uid, m.date)
  }
  let changed = 0
  const abTests = state.abTests.map((t) => {
    const date = latest.get(t.uid)
    if (t.last_visit_date !== undefined || date === undefined) return t
    changed += 1
    return { ...t, last_visit_date: date }
  })
  return changed === 0 ? { state, changed } : { state: { ...state, abTests }, changed }
}
