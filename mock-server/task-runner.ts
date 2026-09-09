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
  }, 30_000)
  timer.unref?.()
}

/** テスト用に止める */
export function stopTaskRunner(): void {
  if (timer !== null) clearInterval(timer)
  timer = null
}
