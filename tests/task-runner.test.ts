import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { isDue } from '../mock-server/task-runner.ts'
import { jstNow } from '../mock-server/lib/jst.ts'
import type { Task } from '../mock-server/store/types.ts'
import { postJson, resetStore, startTestServer, type TestServer } from './helpers/server.ts'

/**
 * 定期タスクの見張り。
 *
 * 画面はスケジュールを選ばせるので、実際にその時刻で動かないと嘘になる。
 * 判定は日本時間で行い、同じ分で二度送らないことを押さえる。
 */
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

describe('日本時間で判定する', () => {
  it('サーバーのTZに関係なくJSTで読む', () => {
    // 00:00 UTC は JST 09:00 の水曜
    expect(wed0900.hhmm).toBe('09:00')
    expect(wed0900.date).toBe('2026-09-09')
    expect(wed0900.weekday).toBe(3)
  })

  it('月末を正しく判定する', () => {
    expect(jstNow(new Date('2026-09-30T00:00:00Z')).isLastDayOfMonth).toBe(true)
    expect(jstNow(new Date('2026-09-29T00:00:00Z')).isLastDayOfMonth).toBe(false)
    // 2月の月末（うるう年でない年）
    expect(jstNow(new Date('2026-02-28T00:00:00Z')).isLastDayOfMonth).toBe(true)
  })
})

describe('動かすべきか', () => {
  it('毎日は時刻が合えば動く', () => {
    expect(isDue(task(), wed0900)).toBe(true)
  })

  it('時刻が違えば動かない', () => {
    expect(isDue(task({ schedule: { kind: 'daily', hour: '10', minute: '00', weekdays: [] } }), wed0900)).toBe(false)
    expect(isDue(task({ schedule: { kind: 'daily', hour: '09', minute: '30', weekdays: [] } }), wed0900)).toBe(false)
  })

  it('毎時は分だけ合えばよい（時は見ない）', () => {
    const hourly = task({ schedule: { kind: 'hourly', hour: '23', minute: '00', weekdays: [] } })
    expect(isDue(hourly, wed0900)).toBe(true)
  })

  it('曜日指定は選んだ曜日にだけ動く', () => {
    const wed = task({ schedule: { kind: 'weekly', hour: '09', minute: '00', weekdays: [3] } })
    const mon = task({ schedule: { kind: 'weekly', hour: '09', minute: '00', weekdays: [1] } })
    expect(isDue(wed, wed0900)).toBe(true)
    expect(isDue(mon, wed0900)).toBe(false)
  })

  it('毎月1日・月末はその日にだけ動く', () => {
    const first = task({ schedule: { kind: 'monthly_first', hour: '09', minute: '00', weekdays: [] } })
    const last = task({ schedule: { kind: 'monthly_last', hour: '09', minute: '00', weekdays: [] } })
    expect(isDue(first, wed0900)).toBe(false)
    expect(isDue(first, jstNow(new Date('2026-10-01T00:00:00Z')))).toBe(true)
    expect(isDue(last, jstNow(new Date('2026-09-30T00:00:00Z')))).toBe(true)
  })

  it('単発は見張りでは動かさない（作成時に1回送るだけ）', () => {
    expect(isDue(task({ schedule: { kind: 'once', hour: '09', minute: '00', weekdays: [] } }), wed0900)).toBe(false)
  })

  it('通知先が無いタスクは動かさない（動いても誰にも届かない）', () => {
    expect(isDue(task({ notify: null }), wed0900)).toBe(false)
  })

  it('同じ分では二度送らない', () => {
    expect(isDue(task({ last_run_slot: '2026-09-09 09:00' }), wed0900)).toBe(false)
    expect(isDue(task({ last_run_slot: '2026-09-09 08:00' }), wed0900)).toBe(true)
  })
})

describe('タスク作成APIはスケジュールを受け取る', () => {
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

  it('保存して返す（捨てると永久に動かない）', async () => {
    const res = await postJson<{ task: Task }>(`${server.api}/tasks`, {
      title: '毎朝レポート',
      schedule: { kind: 'daily', hour: '8', minute: '0', weekdays: [] },
      span: 'yesterday',
      notify: { service: 'chatwork', destination_id: '123' },
    })
    expect(res.status).toBe(201)
    expect(res.json.task.schedule).toEqual({
      kind: 'daily',
      // 1桁で来ても2桁に揃える
      hour: '08',
      minute: '00',
      weekdays: [],
    })
    expect(res.json.task.span).toBe('yesterday')
    expect(res.json.task.notify).toEqual({ service: 'chatwork', destination_id: '123' })
  })

  it('定期なのに通知先が無いものは断る', async () => {
    const res = await postJson(`${server.api}/tasks`, {
      title: '届かないタスク',
      schedule: { kind: 'daily', hour: '09', minute: '00', weekdays: [] },
    })
    expect(res.status).toBe(422)
  })

  it('曜日指定なのに曜日が無いものは断る（永久に条件を満たさない）', async () => {
    const res = await postJson(`${server.api}/tasks`, {
      title: '曜日なし',
      schedule: { kind: 'weekly', hour: '09', minute: '00', weekdays: [] },
      notify: { service: 'chatwork', destination_id: '1' },
    })
    expect(res.status).toBe(422)
  })

  it('指定なしのタスクは単発のまま（勝手に定期実行しない）', async () => {
    const res = await postJson<{ task: Task }>(`${server.api}/tasks`, { title: 'ふつうのタスク' })
    expect(res.status).toBe(201)
    expect(res.json.task.schedule.kind).toBe('once')
    expect(res.json.task.notify).toBeNull()
  })
})
