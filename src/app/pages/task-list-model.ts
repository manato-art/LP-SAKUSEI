/**
 * タスク一覧の絞り込みと表示用の文字（純粋関数）。
 *
 * タブ「すべて / 定期タスク / スポットタスク」は、スケジュールが単発かどうかで分ける
 * （テンプレートのバッジと同じ分け方: 単発＝スポット、それ以外＝定期）。
 */
import { SCHEDULES, WEEKDAYS, type ScheduleKind } from './task-templates.ts'

export type TaskTab = 'all' | 'recurring' | 'spot'

/** 採取したタスク画面で、タブの下にある空の場所（一覧をここへ入れる） */
export const TASK_LIST_HOST_SELECTOR = '.e1vjms4m1'

interface HasSchedule {
  schedule: { kind: string; hour: string; minute: string; weekdays: readonly number[] }
}

export function isSpotTask(task: HasSchedule): boolean {
  return task.schedule.kind === 'once'
}

export function filterTasksByTab<T extends HasSchedule>(tasks: readonly T[], tab: TaskTab): T[] {
  if (tab === 'all') return [...tasks]
  return tasks.filter((t) => (tab === 'spot' ? isSpotTask(t) : !isSpotTask(t)))
}

export function countTasksByTab(tasks: readonly HasSchedule[]): Record<TaskTab, number> {
  const spot = tasks.filter(isSpotTask).length
  return { all: tasks.length, recurring: tasks.length - spot, spot }
}

/** 「毎日 09:00」「毎週 月・水 09:15」のような短い説明 */
export function scheduleSummary(schedule: HasSchedule['schedule']): string {
  const time = `${schedule.hour}:${schedule.minute}`
  switch (schedule.kind as ScheduleKind) {
    case 'once':
      return '単発'
    case 'hourly':
      return `毎時 ${schedule.minute}分`
    case 'daily':
      return `毎日 ${time}`
    case 'weekly':
      return `毎週 ${schedule.weekdays.map((d) => WEEKDAYS[d] ?? '').join('・')} ${time}`
    case 'monthly_first':
      return `毎月1日 ${time}`
    case 'monthly_last':
      return `毎月月末 ${time}`
    default:
      return SCHEDULES.find((s) => s.value === schedule.kind)?.label ?? schedule.kind
  }
}
