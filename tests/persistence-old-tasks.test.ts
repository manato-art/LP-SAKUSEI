/**
 * スケジュールなどを足す前に保存したタスクが、読み戻したときに今の形へそろうこと（2026-10-13）。
 *
 * 【起きたこと】本番で、タスクの見張りが30秒ごとに
 * `Cannot read properties of undefined (reading 'kind')` で失敗し続けていた。
 * タスクの画面も同じ所で止まり、一覧が出なかった。
 *
 * 【原因】本番には、スケジュール・通知先・実行の記録を足す前に作ったタスクが3件残っていた
 * （`schedule` などの項目自体が無い）。読み込み時の移行処理は**最上位のキーしか見ない**ので、
 * タスク1件ずつの中身は古い形のまま残る。見張りは `task.schedule.kind` を読むので、
 * 1件でも古い形があると、その回の見張りが丸ごと失敗する（＝ほかの定期タスクも送られない）。
 *
 * 読む側ごとに「無いかもしれない」を足すのではなく、読み戻す所で今の形にそろえる。
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { createEmptyState } from '../mock-server/store/seed-empty.ts'
import { createTask } from '../mock-server/store/actions.ts'
import { isDue } from '../mock-server/task-runner.ts'
import { jstNow } from '../mock-server/lib/jst.ts'
import { countTasksByTab } from '../src/app/pages/task-list-model.ts'
import type { State } from '../mock-server/store/types.ts'

const dataDir = mkdtempSync(join(tmpdir(), 'lp-sakusei-old-tasks-'))

afterAll(() => {
  vi.unstubAllEnvs()
  rmSync(dataDir, { recursive: true, force: true })
})

/** 本番に残っていた形（スケジュール・通知先・実行の記録が無い） */
const OLD_TASKS = [
  { id: 111, uid: 'TASK_0001', team_id: 1, title: 'テスト', assignee_member_id: null, status: 'todo', due_at: null, created_at: 1788704335 },
  { id: 129, uid: 'TASK_0003', team_id: 1, title: '週次成果まとめレポート', assignee_member_id: null, status: 'done', due_at: '2026-09-30', created_at: 1788927832 },
]

async function loadWith(tasks: readonly unknown[]): Promise<State> {
  const saved = { ...(createEmptyState() as unknown as Record<string, unknown>), tasks }
  writeFileSync(join(dataDir, 'state.json'), JSON.stringify(saved))
  vi.stubEnv('DATA_DIR', dataDir)
  vi.resetModules()
  const { loadPersistedState } = await import('../mock-server/store/persistence.ts')
  const loaded = loadPersistedState()
  if (loaded === null) throw new Error('保存データを読み戻せませんでした')
  return loaded
}

describe('古い形のタスクの読み戻し', () => {
  it('足りない項目が、新しく作るタスクと同じ既定値で埋まる', async () => {
    const loaded = await loadWith(OLD_TASKS)
    const fresh = createTask(createEmptyState(), { title: 'x', assignee_member_id: null, due_at: null }).task

    for (const task of loaded.tasks) {
      expect(task.schedule, `${task.uid} のスケジュール`).toEqual(fresh.schedule)
      expect(task.description).toBe(fresh.description)
      expect(task.span).toBe(fresh.span)
      expect(task.notify).toBe(fresh.notify)
      expect(task.last_run_slot).toBe(fresh.last_run_slot)
      expect(task.last_run_status).toBe(fresh.last_run_status)
      expect(task.last_run_error).toBe(fresh.last_run_error)
    }
  })

  it('もとから入っていた値（名前・状態・期日・作った日時）は変えない', async () => {
    const loaded = await loadWith(OLD_TASKS)
    expect(
      loaded.tasks.map((t) => ({
        id: t.id,
        uid: t.uid,
        team_id: t.team_id,
        title: t.title,
        assignee_member_id: t.assignee_member_id,
        status: t.status,
        due_at: t.due_at,
        created_at: t.created_at,
      })),
    ).toEqual(OLD_TASKS)
  })

  it('今の形のタスクは、決めたスケジュールと通知先のまま', async () => {
    const weekly = createTask(createEmptyState(), {
      title: '毎週の報告',
      assignee_member_id: null,
      due_at: null,
      description: '月曜に送る',
      schedule: { kind: 'weekly', hour: '10', minute: '30', weekdays: [1] },
      span: 'last7days',
      notify: { service: 'chatwork', destination_id: '123' },
    }).task
    const loaded = await loadWith([...OLD_TASKS, weekly])

    expect(loaded.tasks.find((t) => t.uid === weekly.uid)).toEqual(weekly)
  })

  it('読み戻したタスクで、見張りもタスクの画面も止まらない', async () => {
    const loaded = await loadWith(OLD_TASKS)
    const now = jstNow(new Date('2026-10-13T00:00:00Z'))

    // 古い形は「単発」になるので、見張りが勝手に送ることはない
    expect(loaded.tasks.map((t) => isDue(t, now))).toEqual([false, false])
    expect(countTasksByTab(loaded.tasks)).toEqual({ all: 2, recurring: 0, spot: 2 })
  })
})
