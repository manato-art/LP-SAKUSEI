/**
 * 定期タスクの見張り。
 *
 * 1分ごとに「今この分に動かすべきタスク」を探して、通知を1通送る。
 * 判定はすべて**日本時間**で行う（`lib/jst.ts`）。サーバーのTZに左右させない。
 *
 * 二重送信を防ぐため、送った分（`YYYY-MM-DD HH:MM`）をタスクに記録し、
 * 同じ分では二度と送らない。見張りが多少ずれて2回回っても1通に収まる。
 */
import { jstNow, type JstNow } from './lib/jst.ts'
import { findAlerts, notifyList } from './alerts.ts'
import { sendNotification } from './notify.ts'
import { buildTaskReport } from './task-report.ts'
import { getState, setState } from './store/store.ts'
import type { Task } from './store/types.ts'

/** そのタスクを、今この分に動かすべきか */
export function isDue(task: Task, now: JstNow): boolean {
  // 単発は作成時に1回送るだけ。見張りでは動かさない。
  if (task.schedule.kind === 'once') return false
  if (task.notify === null) return false

  const slot = `${now.date} ${now.hhmm}`
  // 同じ分で既に送っていれば動かさない
  if (task.last_run_slot === slot) return false

  const { hour, minute, weekdays, kind } = task.schedule
  if (minute !== now.minute) return false
  if (kind === 'hourly') return true
  if (hour !== now.hour) return false

  switch (kind) {
    case 'daily':
      return true
    case 'weekly':
      return weekdays.includes(now.weekday)
    case 'monthly_first':
      return now.day === 1
    case 'monthly_last':
      return now.isLastDayOfMonth
    default:
      return false
  }
}

/** 実行の結果をタスクに書き戻す（画面で「届いていない」ことに気づけるように） */
function recordRun(uid: string, slot: string, error: string | null): void {
  setState((s) => ({
    ...s,
    tasks: s.tasks.map((t) =>
      t.uid === uid
        ? {
            ...t,
            last_run_slot: slot,
            last_run_status: error === null ? 'ok' : 'failed',
            last_run_error: error,
          }
        : t,
    ),
  }))
}

/** すでに送った合図は増え続けるので、上限を超えたら古いものから捨てる */
const MAX_SENT_SLOTS = 500

/**
 * 異常のお知らせ。見張りのたびに条件を確かめ、当たったものを送る。
 * 送りすぎないよう、同じページの同じ理由は1時間に1回まで（合図で数える）。
 */
export async function runAlerts(now: JstNow = jstNow()): Promise<number> {
  const state = getState()
  const alerts = findAlerts({
    now: Math.floor(Date.now() / 1000),
    today: now.date,
    setting: state.alertSetting,
    pages: state.abTests.map((t) => ({ uid: t.uid, title: t.title, ad_status: t.ad_status })),
    conversions: state.conversions.map((c) => ({
      ab_test_uid: c.ab_test_uid,
      occurred_at: c.occurred_at,
    })),
    metrics: state.metrics
      .filter((m) => m.scope === 'ab_test')
      .map((m) => ({ entity_uid: m.entity_uid, date: m.date, ad_cost: m.ad_cost, cv: m.cv })),
    sentSlots: state.alertSentSlots,
  })
  if (alerts.length === 0) return 0

  const destinations = notifyList(state.alertSetting.notify)
  if (destinations.length === 0) return 0

  // 先に「送った」と記録してから送る（送信に時間がかかっても二重に送らない）
  setState((s) => ({
    ...s,
    alertSentSlots: [...s.alertSentSlots, ...alerts.map((a) => a.slot)].slice(-MAX_SENT_SLOTS),
  }))
  for (const alert of alerts) {
    // 決めた送り先すべてへ同じ知らせを配る。
    // 1つへ送れなくても残りは送る（届かなかったことは画面では追えない＝次の時間帯に再送される）。
    for (const to of destinations) {
      try {
        await sendNotification(to.service, to.destination_id, alert.message)
      } catch {
        /* 続ける */
      }
    }
  }
  return alerts.length
}

/** 1回ぶんの見張り。動かすべきタスクを順に実行する。 */
export async function tick(now: JstNow = jstNow()): Promise<number> {
  const due = getState().tasks.filter((t) => isDue(t, now))
  const slot = `${now.date} ${now.hhmm}`

  for (const task of due) {
    // 先に「送った」と記録してから送る。送信に時間がかかっても、
    // 次の見張りが同じ分をもう一度拾わないようにするため。
    recordRun(task.uid, slot, null)
    if (task.notify === null) continue
    try {
      await sendNotification(
        task.notify.service,
        task.notify.destination_id,
        buildTaskReport(task.title, task.span),
      )
    } catch (error) {
      recordRun(task.uid, slot, (error as Error).message)
    }
  }
  return due.length
}

let timer: ReturnType<typeof setInterval> | null = null

/** 見張りを始める（サーバー起動時に1回だけ呼ぶ） */
export function startTaskRunner(): void {
  if (timer !== null) return
  // 分の判定なので30秒間隔で見る（1分ちょうどだと、ずれた分を丸ごと逃す）
  timer = setInterval(() => {
    void tick().catch(() => {
      /* 1回失敗しても見張り自体は止めない */
    })
    void runAlerts().catch(() => {
      /* 同上 */
    })
  }, 30_000)
  timer.unref?.()
}

/** テスト用に止める */
export function stopTaskRunner(): void {
  if (timer !== null) clearInterval(timer)
  timer = null
}
