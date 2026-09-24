/**
 * 外部連携 > 広告媒体連携 > Meta の「認証」（広告アカウントの連携）の機械証明。
 *
 * 以前の食い違い:
 *   - トークンがあると重複チェックが先に走り、成功の道に一度も届かなかった
 *   - トークンが無いと画面の配列に足すだけで「連携しました」と出し、再読み込みで消えた
 *   - 削除は画面の行を消すだけ（確認なし・保存なし）
 *   - 「beyondページ数」はいつも0
 * 連携はサーバーに保存し、削除も保存する。ページ数は実際に紐付いているページを数える。
 * Meta への問い合わせ（トークンで見える広告アカウント）はここで差し替える（外へは出ない）。
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const metaState = vi.hoisted(() => ({
  configured: true,
  accounts: [
    { account_id: '1234567890', name: '本店アカウント', account_status: 1, currency: 'JPY', created_date: '2025-01-01' },
    { account_id: '9876543210', name: '支店アカウント', account_status: 2, currency: 'JPY', created_date: '2025-02-01' },
  ],
}))

vi.mock('../mock-server/lib/meta-client.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('../mock-server/lib/meta-client.ts')>()
  return {
    ...original,
    fetchAdAccounts: () =>
      Promise.resolve(
        metaState.configured
          ? { configured: true, accounts: metaState.accounts }
          : { configured: false, accounts: [] },
      ),
  }
})

import { resetStore, sendJson, postJson, startTestServer, type TestServer } from './helpers/server.ts'

interface LinkedAccount {
  account_id: string
  name: string
  page_count: number
  linked_date: string
  visible: boolean
}

let server: TestServer
beforeAll(async () => {
  server = await startTestServer()
})
afterAll(async () => {
  await server.close()
})
beforeEach(() => {
  resetStore()
  metaState.configured = true
})

async function list(): Promise<{ configured: boolean; accounts: LinkedAccount[]; candidates: { account_id: string }[] }> {
  return (await (await fetch(`${server.api}/teams/ad_accounts/meta`)).json()) as {
    configured: boolean
    accounts: LinkedAccount[]
    candidates: { account_id: string }[]
  }
}

describe('Meta広告アカウントの連携', () => {
  it('トークンで見えるアカウントIDを入れると連携でき、読み直しても残る', async () => {
    const res = await postJson<{ account: LinkedAccount }>(`${server.api}/teams/ad_accounts/meta`, {
      account_id: 'act_1234567890',
    })
    expect(res.status).toBe(201)
    expect(res.json.account.account_id).toBe('1234567890')
    expect(res.json.account.name).toBe('本店アカウント')
    expect(res.json.account.linked_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    const after = await list()
    expect(after.accounts.map((a) => a.account_id)).toEqual(['1234567890'])
    // まだ連携していないものは候補として出る
    expect(after.candidates.map((a) => a.account_id)).toEqual(['9876543210'])
  })

  it('同じアカウントを2回連携しようとしたら断る', async () => {
    await postJson(`${server.api}/teams/ad_accounts/meta`, { account_id: '1234567890' })
    const again = await postJson(`${server.api}/teams/ad_accounts/meta`, { account_id: '1234567890' })
    expect(again.status).toBe(409)
  })

  it('トークンで見えないIDは断る', async () => {
    const res = await postJson(`${server.api}/teams/ad_accounts/meta`, { account_id: '5555555555' })
    expect(res.status).toBe(422)
  })

  it('数字でないIDは断る', async () => {
    const res = await postJson(`${server.api}/teams/ad_accounts/meta`, { account_id: 'abc' })
    expect(res.status).toBe(422)
  })

  it('トークンが無いと確かめられないので、連携したことにしない', async () => {
    metaState.configured = false
    const res = await postJson<{ error: { message: string } }>(`${server.api}/teams/ad_accounts/meta`, {
      account_id: '1234567890',
    })
    expect(res.status).toBe(422)
    expect(res.json.error.message).toContain('トークン')
    expect((await list()).accounts).toEqual([])
  })

  it('連携を外すと保存され、一覧から消える', async () => {
    await postJson(`${server.api}/teams/ad_accounts/meta`, { account_id: '1234567890' })
    const del = await fetch(`${server.api}/teams/ad_accounts/meta/1234567890`, { method: 'DELETE' })
    expect(del.status).toBe(204)
    expect((await list()).accounts).toEqual([])
  })

  it('連携していないものを外そうとしたら404', async () => {
    const del = await fetch(`${server.api}/teams/ad_accounts/meta/1234567890`, { method: 'DELETE' })
    expect(del.status).toBe(404)
  })

  it('beyondページ数は、そのアカウントを紐付けたページの数', async () => {
    await postJson(`${server.api}/teams/ad_accounts/meta`, { account_id: '1234567890' })
    const created = await postJson<{ ab_test: { uid: string } }>(`${server.api}/ab_tests`, { title: 'サンプル施策001' })
    await sendJson('PUT', `${server.api}/ab_tests/${created.json.ab_test.uid}/meta_link`, {
      meta_level: 'account',
      meta_object_id: 'act_1234567890',
    })
    const after = await list()
    expect(after.accounts[0]?.page_count).toBe(1)
  })
})
