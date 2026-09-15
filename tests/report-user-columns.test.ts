/**
 * クリエイティブレポートの「列を選ぶ」→「保存」（2026-09-15）。
 * 実物には `GET /api/v1/creative_report_user_columns` があり（採取した api-urls.json）、
 * 採取したモーダルの列選択フォームには submit の「保存」ボタンがある。
 * 保存したら次に開いたときも同じ列が出る。
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { getJson, resetStore, sendJson, startTestServer, type TestServer } from './helpers/server.ts'

let server: TestServer

beforeEach(async () => {
  if (server === undefined) server = await startTestServer()
  resetStore()
})

afterAll(() => server?.close())

interface Columns {
  creative_report_user_columns: { name: string }[]
}

describe('クリエイティブレポートの列', () => {
  it('はじめは採取した既定（配信金額・CTR・CV・CVR・CPA）', async () => {
    const res = await getJson<Columns>(`${server.api}/creative_report_user_columns`)
    expect(res.creative_report_user_columns.map((c) => c.name)).toEqual([
      'adSpending',
      'ctr',
      'cv',
      'cvr',
      'cpa',
    ])
  })

  it('保存すると次に読んだときも同じ', async () => {
    await sendJson('PUT', `${server.api}/creative_report_user_columns`, {
      creative_report_user_columns: ['pv', 'click'],
    })
    const res = await getJson<Columns>(`${server.api}/creative_report_user_columns`)
    expect(res.creative_report_user_columns.map((c) => c.name)).toEqual(['pv', 'click'])
  })

  it('知らない列名は受け取らない', async () => {
    await sendJson('PUT', `${server.api}/creative_report_user_columns`, {
      creative_report_user_columns: ['pv', 'evil'],
    })
    const res = await getJson<Columns>(`${server.api}/creative_report_user_columns`)
    expect(res.creative_report_user_columns.map((c) => c.name)).toEqual(['pv'])
  })

  it('全部外した保存は受け付けない（列が1つも無い表にしない）', async () => {
    const before = await getJson<Columns>(`${server.api}/creative_report_user_columns`)
    const res = await sendJson('PUT', `${server.api}/creative_report_user_columns`, {
      creative_report_user_columns: [],
    })
    expect(res.status).toBe(422)
    const after = await getJson<Columns>(`${server.api}/creative_report_user_columns`)
    expect(after).toEqual(before)
  })
})
