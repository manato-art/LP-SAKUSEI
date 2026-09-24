/**
 * 計測値の記録と、通知タスク（actions.ts から分離）。
 *
 * 配信ページからの計測（PV/クリック/CV）と、
 * レポートを定期通知するタスクの作成・更新をまとめている。
 */
import { currentTeamId } from './current-team.ts'
import { makeUid } from './ids.ts'
import { toDateKey } from './metrics.ts'
import type { Conversion, DeviceKind, State, Task, TaskNotify, TaskReportSpan, TaskSchedule } from './types.ts'
import { bumpDeviceMetric } from './device-metrics.ts'
import { nowTs, freshUid } from './actions-shared.ts'
import { DEFAULT_REPORT_ITEMS, type ReportItems } from '../report-items.ts'

// ── タスク ───────────────────────────────────────────────
export function createTask(
  state: State,
  input: {
    title: string
    assignee_member_id: number | null
    due_at: string | null
    description?: string
    schedule?: TaskSchedule
    span?: TaskReportSpan
    report_items?: ReportItems
    notify?: TaskNotify | null
  },
): { state: State; task: Task } {
  const id = state.nextId
  const task: Task = {
    id,
    uid: freshUid(state.tasks, id, (n) => makeUid('task', n)),
    team_id: currentTeamId(state),
    title: input.title,
    assignee_member_id: input.assignee_member_id,
    status: 'todo',
    due_at: input.due_at,
    created_at: nowTs(),
    description: input.description ?? '',
    // 既定は単発。指定が無いタスクを勝手に定期実行しない。
    schedule: input.schedule ?? { kind: 'once', hour: '09', minute: '00', weekdays: [] },
    span: input.span ?? 'today',
    report_items: input.report_items ?? { ...DEFAULT_REPORT_ITEMS },
    notify: input.notify ?? null,
    last_run_slot: null,
    last_run_status: null,
    last_run_error: null,
  }
  return { state: { ...state, tasks: [...state.tasks, task], nextId: id + 1 }, task }
}
export function updateTask(
  state: State,
  uid: string,
  patch: Partial<
    Pick<
      Task,
      | 'title'
      | 'status'
      | 'assignee_member_id'
      | 'due_at'
      | 'description'
      | 'schedule'
      | 'span'
      | 'notify'
      | 'report_items'
    >
  >,
): { state: State; task: Task | null } {
  const target = state.tasks.find((t) => t.uid === uid)
  if (target === undefined) return { state, task: null }
  const updated: Task = { ...target, ...patch }
  return {
    state: { ...state, tasks: state.tasks.map((t) => (t.uid === uid ? updated : t)) },
    task: updated,
  }
}
/** タスクを消す。無ければ state はそのまま・removed:false */
export function deleteTask(state: State, uid: string): { state: State; removed: boolean } {
  if (!state.tasks.some((t) => t.uid === uid)) return { state, removed: false }
  return { state: { ...state, tasks: state.tasks.filter((t) => t.uid !== uid) }, removed: true }
}
// ── コンバージョン（CV速報が積む・§10-9「ダミーの流入が乗ると数値が付く」）──
export function recordConversion(
  state: State,
  input: {
    ab_test_uid: string
    version_uid: string
    media_id: number | null
    amount: number
    /** 成果を送ってきた端末（2026-09-24・点検29）。分からなければ端末ごとには数えない */
    device?: DeviceKind
  },
): { state: State; conversion: Conversion } {
  const id = state.nextId
  const conversion: Conversion = {
    id,
    uid: freshUid(state.conversions, id, (n) => makeUid('conversion', n)),
    ab_test_uid: input.ab_test_uid,
    version_uid: input.version_uid,
    media_id: input.media_id,
    amount: input.amount,
    occurred_at: nowTs(),
    status: '承認',
  }
  const date = toDateKey(new Date())
  const delta = { cv: 1, sales: input.amount }
  const pageMetrics = bumpMetric(state, input.ab_test_uid, 'ab_test', date, delta)
  // 見ていたVersionが分かる成果は、そのVersionのCVにも数える（外部LPの計測タグの成果は Version を持たない）
  const metrics =
    input.version_uid === ''
      ? pageMetrics
      : bumpMetric({ ...state, metrics: pageMetrics }, input.version_uid, 'version', date, delta)
  const device = input.device
  const deviceMetrics =
    device === undefined
      ? state.deviceMetrics
      : [
          { entity_uid: input.ab_test_uid, scope: 'ab_test' as const },
          ...(input.version_uid === '' ? [] : [{ entity_uid: input.version_uid, scope: 'version' as const }]),
        ].reduce(
          (list, key) => bumpDeviceMetric(list, { ...key, date, device }, delta),
          state.deviceMetrics,
        )
  return {
    state: {
      ...state,
      conversions: [conversion, ...state.conversions],
      metrics,
      deviceMetrics,
      deviceRecordedSince: device === undefined ? state.deviceRecordedSince : (state.deviceRecordedSince ?? date),
      nextId: id + 1,
    },
    conversion,
  }
}
// 媒体実績（配信金額など）の書き込みは出どころごとに分けた（store/media-sources.ts・2026-09-24）
export { setMediaMetrics } from './media-sources.ts'
/** 日次メトリクスに加算（無ければ作る）。一次値だけを持ち、派生は metrics.ts の恒等式で算出する。 */
export function bumpMetric(
  state: State,
  entityUid: string,
  scope: 'ab_test' | 'version' | 'parameter',
  date: string,
  delta: Partial<{
    pv: number
    click: number
    cv: number
    ad_cost: number
    sales: number
    imp: number
    media_click: number
    media_cv: number
  }>,
): State['metrics'] {
  const index = state.metrics.findIndex(
    (m) => m.entity_uid === entityUid && m.scope === scope && m.date === date,
  )
  if (index === -1) {
    return [
      ...state.metrics,
      {
        entity_uid: entityUid,
        scope,
        date,
        pv: delta.pv ?? 0,
        click: delta.click ?? 0,
        cv: delta.cv ?? 0,
        ad_cost: delta.ad_cost ?? 0,
        sales: delta.sales ?? 0,
        imp: delta.imp ?? 0,
        media_click: delta.media_click ?? 0,
        media_cv: delta.media_cv ?? 0,
      },
    ]
  }
  return state.metrics.map((m, i) =>
    i === index
      ? {
          ...m,
          pv: m.pv + (delta.pv ?? 0),
          click: m.click + (delta.click ?? 0),
          cv: m.cv + (delta.cv ?? 0),
          ad_cost: m.ad_cost + (delta.ad_cost ?? 0),
          sales: m.sales + (delta.sales ?? 0),
          imp: (m.imp ?? 0) + (delta.imp ?? 0),
          media_click: (m.media_click ?? 0) + (delta.media_click ?? 0),
          media_cv: (m.media_cv ?? 0) + (delta.media_cv ?? 0),
        }
      : m,
  )
}
