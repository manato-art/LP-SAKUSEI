/**
 * 押すたびに数えていた頃のクリックを直す（2026-10-28 本人「過去も直して」）。
 *
 * 計測タグは、1回の表示につき1回までの数え方（cf1d187・2026-10-28）にする前は、計測リンクを押すたびにクリックを足していた。
 * そのためクリックが PV を超えた日がある（本番では PV 3・クリック 8＝見た人3人・押した人1人）。
 *
 * 1回ずつの記録は残っていないので、押した人の記録（visitorTouches＝1人1件・押した時刻）から、
 * その日にそのページ（Version・広告の行）で計測リンクを押した人の数を数えてクリックにする。
 *   - 直すのはクリックが PV を超えている日だけ（PV 以下の日は押し直しが混ざっていても見分けられない）
 *   - 押されたことはあるので最低1、PV が上限
 *   - 新しい数え方にした日（2026-10-28）より後は触らない。1回直せば PV 以下になるので、2回目は何もしない
 * 端末ごとの入れ物（deviceMetrics）も同じに直す（押した人の記録は端末を持たないので、数は同じで端末の PV を上限にする）。
 */
import { toDateKey } from './metrics.ts'
import type { DailyMetric, DeviceMetric, State, VisitorTouch } from './types.ts'

/** この日までが「押すたびに数えていた」頃（新しい数え方を本番に出した日） */
const OLD_RULE_UNTIL = '2026-10-28'

/** 直した1件 */
export interface ClickRepair {
  scope: DailyMetric['scope']
  entity_uid: string
  date: string
  device: DeviceMetric['device'] | null
  from: number
  to: number
}

type Row = Pick<DailyMetric, 'entity_uid' | 'scope' | 'date' | 'pv' | 'click'>

/** その行に当たる人か（ページ・Version・Version×広告パラメータ） */
function touchMatches(touch: VisitorTouch, row: Row): boolean {
  if (row.scope === 'ab_test') return touch.ab_test_uid === row.entity_uid
  if (row.scope === 'version') return touch.version_uid === row.entity_uid
  if (row.scope === 'parameter') {
    const at = row.entity_uid.indexOf('|')
    if (at === -1) return false
    return touch.version_uid === row.entity_uid.slice(0, at) && (touch.params ?? []).includes(row.entity_uid.slice(at + 1))
  }
  return false
}

/** 直したあとのクリック。直さない行は null */
function repairedClick(row: Row, touches: readonly VisitorTouch[]): number | null {
  if (row.date > OLD_RULE_UNTIL || row.click <= row.pv) return null
  const clickers = touches.filter(
    (t) => t.clicked_at !== null && toDateKey(new Date(t.clicked_at)) === row.date && touchMatches(t, row),
  ).length
  return Math.max(1, Math.min(row.pv, clickers))
}

export function repairOverCountedClicks(state: State): { state: State; changed: ClickRepair[] } {
  const changed: ClickRepair[] = []
  const metrics = state.metrics.map((m) => {
    const to = repairedClick(m, state.visitorTouches)
    if (to === null) return m
    changed.push({ scope: m.scope, entity_uid: m.entity_uid, date: m.date, device: null, from: m.click, to })
    return { ...m, click: to }
  })
  const deviceMetrics = state.deviceMetrics.map((m) => {
    const to = repairedClick(m, state.visitorTouches)
    if (to === null) return m
    changed.push({ scope: m.scope, entity_uid: m.entity_uid, date: m.date, device: m.device, from: m.click, to })
    return { ...m, click: to }
  })
  if (changed.length === 0) return { state, changed }
  return { state: { ...state, metrics, deviceMetrics }, changed }
}
