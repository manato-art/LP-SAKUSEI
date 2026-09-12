/**
 * 設定＞アカウントの本人情報（2026-09-13・本人指示「メールアドレスがモックのままなので直す」）。
 *
 * メールアドレスは読み取り専用で、空シードの `test.taro@example.test` がそのまま出ていた。
 * 名前と同じように本人が書き換えられるようにする（実在のアドレスをコードに埋め込まないため）。
 * 名前・メールはチームメンバー一覧の本人の行にも反映する（片方だけ古いと、どちらが本当か分からない）。
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { getJson, resetStore, sendJson, startTestServer, type TestServer } from './helpers/server.ts'

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

interface UserResponse {
  user: { name: string; email: string } | null
}

async function currentUser(): Promise<{ name: string; email: string }> {
  const data = await getJson<UserResponse>(`${server.api}/users/me`)
  if (data.user === null) throw new Error('ユーザーが取得できませんでした')
  return data.user
}

describe('アカウントのメールアドレス', () => {
  it('書き換えられる（前後の空白は落とす）', async () => {
    const res = await sendJson('PUT', `${server.api}/users/me`, { email: '  owner@example.test  ' })
    expect(res.status).toBe(200)
    expect((await currentUser()).email).toBe('owner@example.test')
  })

  it('形がおかしければ受け付けず、元のままにする', async () => {
    const before = (await currentUser()).email
    for (const bad of ['おかしい', 'a@b', 'a b@example.test', '@example.test', 'a@']) {
      const res = await sendJson('PUT', `${server.api}/users/me`, { email: bad })
      expect(res.status, bad).toBe(422)
    }
    expect((await currentUser()).email).toBe(before)
  })

  it('送らなければ変わらない（名前だけ変えたときに消さない）', async () => {
    await sendJson('PUT', `${server.api}/users/me`, { email: 'owner@example.test' })
    await sendJson('PUT', `${server.api}/users/me`, { name: '新しい名前' })
    const user = await currentUser()
    expect(user.name).toBe('新しい名前')
    expect(user.email).toBe('owner@example.test')
  })
})

describe('チームメンバー一覧との食い違い', () => {
  it('名前とメールを変えると、本人のメンバー行にも反映される', async () => {
    await sendJson('PUT', `${server.api}/users/me`, { name: 'Cypher One', email: 'owner@example.test' })
    const data = await getJson<{ members: { name: string; email: string; role: string }[] }>(
      `${server.api}/teams/members`,
    )
    const owner = data.members.find((m) => m.role === 'team-owner')
    expect(owner?.name).toBe('Cypher One')
    expect(owner?.email).toBe('owner@example.test')
  })
})
