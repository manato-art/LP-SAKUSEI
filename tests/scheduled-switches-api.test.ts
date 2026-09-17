/**
 * 配信の切り替え予約のAPI（2026-09-16・本人の依頼）。
 *
 *   GET    /articles/:uid/scheduled_switches   … そのステップの予約（これからのもの＋最近の結果）
 *   POST   /articles/:uid/scheduled_switches   … 予約する
 *   DELETE /scheduled_switches/:uid            … 取り消す（まだ実行していないものだけ）
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { getJson, postJson, resetStore, sendJson, startTestServer, type TestServer } from './helpers/server.ts'
import { getState, setState } from '../mock-server/store/store.ts'

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

interface SwitchJson {
  uid: string
  run_at: string
  status: string
  ratios: { version_uid: string; ratio: number; name?: string }[]
}

/** ページを作ってVersionを2つにし、ステップと2つのVersionを返す */
async function setup(): Promise<{ articleUid: string; a: string; b: string }> {
  await postJson(`${server.api}/ab_tests`, { title: '予約の確認', media_id: 1 })
  const first = getState().versions.at(-1)
  if (first === undefined) throw new Error('Versionを作れませんでした')
  const article = getState().articles.find((x) => x.id === first.article_id)
  if (article === undefined) throw new Error('ステップが見つかりません')
  await postJson(`${server.api}/articles/${article.uid}/versions`, {})
  const second = getState().versions.at(-1)
  if (second === undefined || second.uid === first.uid) throw new Error('2つ目のVersionを作れませんでした')
  return { articleUid: article.uid, a: first.uid, b: second.uid }
}

const future = '2099-12-31T23:59'

describe('予約する', () => {
  it('予約すると、そのステップの予約一覧に出る', async () => {
    const { articleUid, a, b } = await setup()
    const created = await postJson<{ switch: SwitchJson }>(`${server.api}/articles/${articleUid}/scheduled_switches`, {
      run_at: future,
      ratios: [
        { version_uid: a, ratio: 0 },
        { version_uid: b, ratio: 100 },
      ],
    })
    expect(created.status).toBe(201)
    expect(created.json.switch.status).toBe('pending')

    const list = await getJson<{ switches: SwitchJson[] }>(`${server.api}/articles/${articleUid}/scheduled_switches`)
    expect(list.switches).toHaveLength(1)
    expect(list.switches[0]?.run_at).toBe(future)
    // 画面で「どのVersionを何%に」を出せるよう、名前を添えて返す
    expect(list.switches[0]?.ratios.every((r) => typeof r.name === 'string' && r.name !== '')).toBe(true)
  })

  it('受け付けられない予約は理由を返す（合計が100%でない）', async () => {
    const { articleUid, a, b } = await setup()
    const res = await postJson(`${server.api}/articles/${articleUid}/scheduled_switches`, {
      run_at: future,
      ratios: [
        { version_uid: a, ratio: 30 },
        { version_uid: b, ratio: 30 },
      ],
    })
    expect(res.status).toBe(422)
  })

  it('知らないステップは404', async () => {
    const res = await postJson(`${server.api}/articles/NO_SUCH/scheduled_switches`, { run_at: future, ratios: [] })
    expect(res.status).toBe(404)
  })
})

describe('取り消す', () => {
  it('まだ実行していない予約は取り消せる', async () => {
    const { articleUid, a, b } = await setup()
    const created = await postJson<{ switch: SwitchJson }>(`${server.api}/articles/${articleUid}/scheduled_switches`, {
      run_at: future,
      ratios: [
        { version_uid: a, ratio: 0 },
        { version_uid: b, ratio: 100 },
      ],
    })
    const res = await sendJson('DELETE', `${server.api}/scheduled_switches/${created.json.switch.uid}`)
    expect(res.status).toBe(204)
    expect(getState().scheduledSwitches[0]?.status).toBe('canceled')
  })

  it('実行済みの予約は取り消せない（もう切り替わっている）', async () => {
    const { articleUid, a, b } = await setup()
    const created = await postJson<{ switch: SwitchJson }>(`${server.api}/articles/${articleUid}/scheduled_switches`, {
      run_at: future,
      ratios: [
        { version_uid: a, ratio: 0 },
        { version_uid: b, ratio: 100 },
      ],
    })
    setState((s) => ({ ...s, scheduledSwitches: s.scheduledSwitches.map((x) => ({ ...x, status: 'done' as const })) }))
    const res = await sendJson('DELETE', `${server.api}/scheduled_switches/${created.json.switch.uid}`)
    expect(res.status).toBe(409)
  })
})

describe('一覧の並び', () => {
  it('これからの予約を日時の早い順に、そのあとに最近の結果を5件まで', async () => {
    const { articleUid, a, b } = await setup()
    const base = { article_uid: articleUid, ratios: [{ version_uid: a, ratio: 0 }, { version_uid: b, ratio: 100 }], note: '', created_at: 0 }
    setState((s) => ({
      ...s,
      scheduledSwitches: [
        { ...base, uid: 'P2', run_at: '2099-02-01T09:00', status: 'pending', done_at: null },
        { ...base, uid: 'P1', run_at: '2099-01-01T09:00', status: 'pending', done_at: null },
        ...Array.from({ length: 7 }, (_, i) => ({
          ...base,
          uid: `D${i}`,
          run_at: `2026-09-0${i + 1}T09:00`,
          status: 'done' as const,
          done_at: `2026-09-0${i + 1}T09:00`,
        })),
      ],
    }))
    const list = await getJson<{ switches: SwitchJson[] }>(`${server.api}/articles/${articleUid}/scheduled_switches`)
    expect(list.switches.map((x) => x.uid)).toEqual(['P1', 'P2', 'D6', 'D5', 'D4', 'D3', 'D2'])
  })
})
