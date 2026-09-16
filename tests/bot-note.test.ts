/**
 * 「ボットは含めていません」の表示（2026-09-16・本人の依頼）。
 *
 * 数字にボットが入っていないことを、画面と定期レポートに書く。
 * 件数を添えるのは、本当に除けているのかを確かめられるようにするため。
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { BOT_NOTE_DETAIL, botNoteText } from '../src/shared/bot-note.ts'
import { getJson, postJson, resetStore, startTestServer, type TestServer } from './helpers/server.ts'
import { getState, setState } from '../mock-server/store/store.ts'
import { buildTaskReport } from '../mock-server/task-report.ts'

describe('表示の文言', () => {
  it('除いた件数を添える（3桁区切り）', () => {
    expect(botNoteText(1234)).toBe('ボットのアクセスは含めていません（この期間に除いた数：1,234件）')
  })

  it('0件でも「含めていません」とは書く（0件＝判定していない、に読めないように）', () => {
    expect(botNoteText(0)).toBe('ボットのアクセスは含めていません（この期間に除いたものはありません）')
  })

  it('何をボットとしているかの説明がある（アプリ内ブラウザは人として数えることも書く）', () => {
    expect(BOT_NOTE_DETAIL).toContain('検索エンジン')
    expect(BOT_NOTE_DETAIL).toContain('アプリ内ブラウザ')
  })
})

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

async function createPage(): Promise<string> {
  const created = await postJson<{ ab_test: { uid: string } }>(`${server.api}/ab_tests`, {
    title: 'ボット件数の確認',
    media_id: 1,
  })
  return created.json.ab_test.uid
}

describe('件数を画面に渡す', () => {
  it('レポートは、そのページの期間内の件数を返す', async () => {
    const uid = await createPage()
    const other = await createPage()
    setState((s) => ({
      ...s,
      botHits: [
        { ab_test_uid: uid, date: '2026-09-10', count: 3 },
        { ab_test_uid: uid, date: '2026-09-11', count: 4 },
        { ab_test_uid: uid, date: '2026-08-01', count: 100 },
        { ab_test_uid: other, date: '2026-09-10', count: 50 },
      ],
    }))
    const report = await getJson<{ bot_hits: number }>(
      `${server.api}/ab_tests/${uid}/reports?start_date=2026-09-10&end_date=2026-09-11`,
    )
    expect(report.bot_hits).toBe(7)
  })

  it('ダッシュボードは、全ページの期間内の件数を返す', async () => {
    const a = await createPage()
    const b = await createPage()
    setState((s) => ({
      ...s,
      botHits: [
        { ab_test_uid: a, date: '2026-09-10', count: 3 },
        { ab_test_uid: b, date: '2026-09-10', count: 5 },
      ],
    }))
    const dash = await getJson<{ bot_hits: number }>(
      `${server.api}/teams/dashboard?start_date=2026-09-10&end_date=2026-09-10`,
    )
    expect(dash.bot_hits).toBe(8)
  })
})

describe('定期レポートにも書く', () => {
  it('アクセスがある日は、合計の下に一行添える', () => {
    setState((s) => ({
      ...s,
      abTests: [{ ...(s.abTests[0] ?? ({} as never)), id: 1, uid: 'AB1', title: '本命LP' } as never],
      metrics: [
        { entity_uid: 'AB1', scope: 'ab_test', date: '2026-09-14', pv: 100, click: 10, cv: 1, ad_cost: 0, sales: 0 },
      ],
      botHits: [{ ab_test_uid: 'AB1', date: '2026-09-14', count: 9 }],
    }))
    const body = buildTaskReport('朝', 'yesterday', new Date(Date.UTC(2026, 8, 15, 3, 0)))
    expect(body).toContain(botNoteText(9))
    expect(getState().botHits).toHaveLength(1)
  })
})
