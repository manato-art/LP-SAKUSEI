/**
 * タスクの「あとから足した項目」と、その既定値。
 *
 * スケジュール・通知先・実行の記録は、タスクの機能を作ったあとで足した。
 * それより前に保存したタスクには、その項目自体が無い。読み込み時の移行（persistence.ts）は
 * 最上位のキーしか見ないので、1件ずつの中身は古い形のまま残り、
 * 見張り（task-runner）とタスクの画面が `schedule.kind` を読んだ所で止まっていた（本番・2026-10-13）。
 *
 * 読む側ごとに「無いかもしれない」を足すと、次に読む所でまた同じことが起きる。
 * 読み戻す所で1回だけ、新しく作るタスクと同じ既定値で埋める。
 */
import type { Task } from './types.ts'

type TaskAddedFields = Pick<
  Task,
  'description' | 'schedule' | 'span' | 'notify' | 'last_run_slot' | 'last_run_status' | 'last_run_error'
>

/** 新しく作るタスクと、古い保存データの穴埋めで同じ値を使う（呼ぶたびに新しく作る） */
export function taskDefaults(): TaskAddedFields {
  return {
    description: '',
    // 既定は単発。指定が無いタスクを勝手に定期実行しない。
    schedule: { kind: 'once', hour: '09', minute: '00', weekdays: [] },
    span: 'today',
    notify: null,
    last_run_slot: null,
    last_run_status: null,
    last_run_error: null,
  }
}

const ADDED_KEYS = Object.keys(taskDefaults())

const isComplete = (task: Task): boolean => ADDED_KEYS.every((key) => key in task)

/**
 * 足りない項目だけを既定値で埋める。もとから入っている値は変えない。
 * 全部そろっていれば、渡された配列をそのまま返す。
 */
export function completeTasks(tasks: readonly Task[]): readonly Task[] {
  if (tasks.every(isComplete)) return tasks
  return tasks.map((task) => (isComplete(task) ? task : { ...taskDefaults(), ...task }))
}
