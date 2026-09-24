/**
 * タスクの状態・編集・削除・タブの機械証明。
 *
 * 以前の食い違い:
 *   - 画面は 'open' / 'in_progress' を送り、サーバーは 'todo' / 'doing' / 'done' しか受けず黙って捨てていた
 *   - 新しいタスクは 'todo' なのに、画面の表に無いので「todo」がそのまま出ていた
 *   - 完了にしても見張りは状態を見ずに送り続けた
 *   - タブ（すべて / 定期タスク / スポットタスク）は色が変わるだけで絞り込まなかった
 *   - 作ったタスクが一覧に出なかった（一覧を入れる場所のクラスが採取物に無かった）
 * 状態の言葉は src/shared/task-status.ts の1か所にまとめ、画面とサーバーの両方がそれを使う。
 */
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  isTaskRunnable,
  isTaskStatus,
} from '../src/shared/task-status.ts'
import {
  TASK_LIST_HOST_SELECTOR,
  countTasksByTab,
  filterTasksByTab,
  scheduleSummary,
} from '../src/app/pages/task-list-model.ts'
import { isDue } from '../mock-server/task-runner.ts'
import { jstNow } from '../mock-server/lib/jst.ts'
import type { Task } from '../mock-server/store/types.ts'
import { postJson, resetStore, sendJson, startTestServer, type TestServer } from './helpers/server.ts'

const task = (over: Partial<Task> = {}): Task =>
  ({
    id: 1,
    uid: 't1',
    team_id: 1,
    title: 'テスト',
    assignee_member_id: null,
    status: 'todo',
    due_at: null,
    created_at: 0,
    description: '',
    schedule: { kind: 'daily', hour: '09', minute: '00', weekdays: [] },
    span: 'today',
    notify: { service: 'chatwork', destination_id: '1' },
    last_run_slot: null,
    last_run_status: null,
    last_run_error: null,
    ...over,
  }) as Task

/** 2026-09-09（水）09:00 JST */
const wed0900 = jstNow(new Date('2026-09-09T00:00:00Z'))

describe('状態の言葉は1つ', () => {
  it('未着手・進行中・完了・停止中の4つで、どれにも日本語の表示名がある', () => {
    expect([...TASK_STATUSES]).toEqual(['todo', 'doing', 'done', 'paused'])
    for (const s of TASK_STATUSES) expect(TASK_STATUS_LABELS[s]).not.toBe('')
    expect(TASK_STATUS_LABELS.todo).toBe('未着手')
    expect(TASK_STATUS_LABELS.paused).toBe('停止中')
  })

  it('知らない言葉（古い画面の open / in_progress）は状態として認めない', () => {
    expect(isTaskStatus('open')).toBe(false)
    expect(isTaskStatus('in_progress')).toBe(false)
    expect(isTaskStatus('done')).toBe(true)
  })

  it('完了と停止中は動かさない', () => {
    expect(isTaskRunnable('todo')).toBe(true)
    expect(isTaskRunnable('doing')).toBe(true)
    expect(isTaskRunnable('done')).toBe(false)
    expect(isTaskRunnable('paused')).toBe(false)
  })
})

describe('見張りは状態を見る', () => {
  it('完了にしたタスクは時刻が来ても送らない', () => {
    expect(isDue(task({ status: 'done' }), wed0900)).toBe(false)
  })
  it('停止中のタスクは送らない', () => {
    expect(isDue(task({ status: 'paused' }), wed0900)).toBe(false)
  })
  it('未着手・進行中は今までどおり送る', () => {
    expect(isDue(task({ status: 'todo' }), wed0900)).toBe(true)
    expect(isDue(task({ status: 'doing' }), wed0900)).toBe(true)
  })
})

describe('タブの絞り込み', () => {
  const tasks = [
    task({ uid: 'a', schedule: { kind: 'once', hour: '09', minute: '00', weekdays: [] } }),
    task({ uid: 'b', schedule: { kind: 'daily', hour: '09', minute: '00', weekdays: [] } }),
    task({ uid: 'c', schedule: { kind: 'weekly', hour: '09', minute: '00', weekdays: [1] } }),
  ]
  it('すべて / 定期 / スポットで出すものが変わる', () => {
    expect(filterTasksByTab(tasks, 'all').map((t) => t.uid)).toEqual(['a', 'b', 'c'])
    expect(filterTasksByTab(tasks, 'recurring').map((t) => t.uid)).toEqual(['b', 'c'])
    expect(filterTasksByTab(tasks, 'spot').map((t) => t.uid)).toEqual(['a'])
  })
  it('タブの数字も数える', () => {
    expect(countTasksByTab(tasks)).toEqual({ all: 3, recurring: 2, spot: 1 })
  })
  it('いつ動くかを短く出す', () => {
    expect(scheduleSummary(tasks[0]?.schedule ?? { kind: 'once', hour: '', minute: '', weekdays: [] })).toBe('単発')
    expect(scheduleSummary({ kind: 'weekly', hour: '09', minute: '15', weekdays: [1, 3] })).toBe('毎週 月・水 09:15')
    expect(scheduleSummary({ kind: 'hourly', hour: '00', minute: '30', weekdays: [] })).toBe('毎時 30分')
  })
})

describe('一覧を入れる場所', () => {
  it('採取したタスク画面に、一覧を入れる場所が実在する', () => {
    const html = readFileSync('src/app/fragments/tasks__default.html', 'utf8')
    const cls = TASK_LIST_HOST_SELECTOR.replace(/^\./, '')
    expect(html).toContain(cls)
  })
})

describe('タスクのAPI', () => {
  let server: TestServer
  beforeAll(async () => {
    server = await startTestServer()
  })
  afterAll(async () => {
    await server.close()
  })
  beforeEach(() => {
    resetStore()
  })

  async function create(): Promise<string> {
    const res = await postJson<{ task: { uid: string; status: string } }>(`${server.api}/tasks`, {
      title: '週次',
      schedule: { kind: 'daily', hour: '09', minute: '00', weekdays: [] },
      notify: { service: 'chatwork', destination_id: '1' },
    })
    expect(res.json.task.status).toBe('todo')
    return res.json.task.uid
  }

  it('知らない状態は400で断る（黙って捨てない）', async () => {
    const uid = await create()
    const res = await sendJson<{ error: { message: string } }>('PUT', `${server.api}/tasks/${uid}`, { status: 'open' })
    expect(res.status).toBe(400)
  })

  it('停止中にでき、保存される', async () => {
    const uid = await create()
    const res = await sendJson<{ task: { status: string } }>('PUT', `${server.api}/tasks/${uid}`, { status: 'paused' })
    expect(res.status).toBe(200)
    expect(res.json.task.status).toBe('paused')
  })

  it('名前・スケジュール・通知先・説明を編集できる', async () => {
    const uid = await create()
    const res = await sendJson<{ task: { title: string; description: string; schedule: { kind: string; weekdays: number[] }; span: string } }>(
      'PUT',
      `${server.api}/tasks/${uid}`,
      {
        title: '月曜の朝',
        description: 'メモ',
        schedule: { kind: 'weekly', hour: '08', minute: '30', weekdays: [1] },
        span: 'last7days',
        notify: { service: 'chatwork', destination_id: '2' },
      },
    )
    expect(res.status).toBe(200)
    expect(res.json.task.title).toBe('月曜の朝')
    expect(res.json.task.description).toBe('メモ')
    expect(res.json.task.schedule.kind).toBe('weekly')
    expect(res.json.task.schedule.weekdays).toEqual([1])
    expect(res.json.task.span).toBe('last7days')
  })

  it('編集でも、曜日指定なのに曜日が無ければ断る', async () => {
    const uid = await create()
    const res = await sendJson('PUT', `${server.api}/tasks/${uid}`, {
      schedule: { kind: 'weekly', hour: '08', minute: '30', weekdays: [] },
    })
    expect(res.status).toBe(422)
  })

  it('空の名前には変えられない', async () => {
    const uid = await create()
    const res = await sendJson('PUT', `${server.api}/tasks/${uid}`, { title: '   ' })
    expect(res.status).toBe(422)
  })

  it('削除すると一覧から消える', async () => {
    const uid = await create()
    const del = await fetch(`${server.api}/tasks/${uid}`, { method: 'DELETE' })
    expect(del.status).toBe(204)
    const list = (await (await fetch(`${server.api}/tasks`)).json()) as { tasks: { uid: string }[] }
    expect(list.tasks.some((t) => t.uid === uid)).toBe(false)
  })

  it('無いタスクの削除は404', async () => {
    const del = await fetch(`${server.api}/tasks/nope`, { method: 'DELETE' })
    expect(del.status).toBe(404)
  })
})
