/**
 * チームメンバーの追加・権限の変更・削除。
 *
 * このシステムのログインは「共通のパスワード＋アクセス管理のメールアドレス」で、
 * 人ごとのアカウントは無い。なので権限（管理者 / メンバー / ゲスト）は目印で、操作は制限しない
 * （画面の説明にもそう書く）。
 * 追加するときに「ログインできるようにする」を選んだときだけ、アクセス管理にもメールを足す。
 */
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { postJson, resetStore, sendJson, startTestServer, type TestServer } from './helpers/server.ts'

interface Member {
  uid: string
  name: string
  email: string
  role: string
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
})

async function members(): Promise<Member[]> {
  return ((await (await fetch(`${server.api}/teams/members`)).json()) as { members: Member[] }).members
}
async function allowed(): Promise<string[]> {
  const body = (await (await fetch(`${server.api}/allowed_emails`)).json()) as { allowed_emails: { email: string }[] }
  return body.allowed_emails.map((e) => e.email)
}

describe('メンバーの追加', () => {
  it('名前・メール・権限で追加でき、一覧に出る（ログインの許可は付けない）', async () => {
    const res = await postJson<{ member: Member; allowed_email_added: boolean }>(`${server.api}/teams/members`, {
      name: '山田',
      email: 'yamada@example.test',
      role: 'member',
      allow_login: false,
    })
    expect(res.status).toBe(201)
    expect(res.json.member.role).toBe('member')
    expect(res.json.allowed_email_added).toBe(false)
    expect((await members()).some((m) => m.email === 'yamada@example.test')).toBe(true)
    expect(await allowed()).not.toContain('yamada@example.test')
  })

  it('「ログインできるようにする」を選んだときだけアクセス管理にも足す', async () => {
    const res = await postJson<{ allowed_email_added: boolean }>(`${server.api}/teams/members`, {
      name: '佐藤',
      email: 'Sato@Example.test',
      role: 'viewer',
      allow_login: true,
    })
    expect(res.status).toBe(201)
    expect(res.json.allowed_email_added).toBe(true)
    expect(await allowed()).toContain('sato@example.test')
  })

  it('同じメールのメンバーは2人作らない', async () => {
    await postJson(`${server.api}/teams/members`, { name: 'A', email: 'dup@example.test', role: 'member' })
    const again = await postJson(`${server.api}/teams/members`, { name: 'B', email: 'DUP@example.test', role: 'member' })
    expect(again.status).toBe(409)
  })

  it('メールの形・権限・名前がおかしければ断る', async () => {
    expect((await postJson(`${server.api}/teams/members`, { name: 'A', email: 'x', role: 'member' })).status).toBe(422)
    expect((await postJson(`${server.api}/teams/members`, { name: 'A', email: 'a@example.test', role: 'boss' })).status).toBe(422)
    expect((await postJson(`${server.api}/teams/members`, { name: '', email: 'a@example.test', role: 'member' })).status).toBe(422)
    // オーナーは1人（最初の人）だけ。招待でオーナーは作れない
    expect((await postJson(`${server.api}/teams/members`, { name: 'A', email: 'a@example.test', role: 'team-owner' })).status).toBe(422)
  })
})

describe('権限の変更と削除', () => {
  async function addOne(): Promise<Member> {
    const res = await postJson<{ member: Member }>(`${server.api}/teams/members`, {
      name: '鈴木',
      email: 'suzuki@example.test',
      role: 'member',
    })
    return res.json.member
  }

  it('権限を変えられて、保存される', async () => {
    const m = await addOne()
    const res = await sendJson<{ member: Member }>('PUT', `${server.api}/teams/members/${m.uid}`, { role: 'admin' })
    expect(res.status).toBe(200)
    expect((await members()).find((x) => x.uid === m.uid)?.role).toBe('admin')
  })

  it('知らない権限は断る', async () => {
    const m = await addOne()
    const res = await sendJson('PUT', `${server.api}/teams/members/${m.uid}`, { role: 'boss' })
    expect(res.status).toBe(422)
  })

  it('オーナーの権限は変えられず、削除もできない', async () => {
    const owner = (await members()).find((x) => x.role === 'team-owner')
    if (owner === undefined) throw new Error('オーナーがいません')
    expect((await sendJson('PUT', `${server.api}/teams/members/${owner.uid}`, { role: 'member' })).status).toBe(400)
    expect((await fetch(`${server.api}/teams/members/${owner.uid}`, { method: 'DELETE' })).status).toBe(400)
  })

  it('削除すると一覧から消える（アクセス管理のメールはそのまま）', async () => {
    const res = await postJson<{ member: Member }>(`${server.api}/teams/members`, {
      name: '田中',
      email: 'tanaka@example.test',
      role: 'member',
      allow_login: true,
    })
    const del = await fetch(`${server.api}/teams/members/${res.json.member.uid}`, { method: 'DELETE' })
    expect(del.status).toBe(204)
    expect((await members()).some((x) => x.uid === res.json.member.uid)).toBe(false)
    expect(await allowed()).toContain('tanaka@example.test')
  })

  it('いないメンバーは404', async () => {
    expect((await fetch(`${server.api}/teams/members/nope`, { method: 'DELETE' })).status).toBe(404)
  })
})

describe('画面', () => {
  it('権限で操作は制限しないことを説明し、ログインの許可は明示のチェックでだけ足す', () => {
    const src = readFileSync('src/app/pages/team-members.ts', 'utf8')
    expect(src).toContain('この人がログインできるようにする（アクセス管理に追加）')
    expect(src).toContain('権限で操作は制限されません')
  })
})
