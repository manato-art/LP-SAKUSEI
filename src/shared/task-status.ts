/**
 * タスクの状態の言葉（画面とサーバーで共有する正本）。
 *
 * 以前は画面が 'open' / 'in_progress'、サーバーが 'todo' / 'doing' を使っていて、
 * 画面から変えた状態はサーバーで黙って捨てられていた。ここ1か所にまとめる。
 *
 *   todo   … 未着手（作ったばかり）
 *   doing  … 進行中
 *   done   … 完了（定期タスクでも、もう送らない）
 *   paused … 停止中（定期タスクを一時的に止める。「再開」で進行中に戻す）
 *
 * 保存済みのタスクは 'todo' / 'doing' / 'done' のどれか
 * （サーバーはそれ以外を受け取らなかったので、古い言葉が保存されていることは無い）。
 */
export const TASK_STATUSES = ['todo', 'doing', 'done', 'paused'] as const

export type TaskStatus = (typeof TASK_STATUSES)[number]

export const TASK_STATUS_LABELS: Readonly<Record<TaskStatus, string>> = {
  todo: '未着手',
  doing: '進行中',
  done: '完了',
  paused: '停止中',
}

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && (TASK_STATUSES as readonly string[]).includes(value)
}

/** 見張り（定期の通知）が動かしてよい状態か。完了と停止中は動かさない */
export function isTaskRunnable(status: TaskStatus): boolean {
  return status === 'todo' || status === 'doing'
}
