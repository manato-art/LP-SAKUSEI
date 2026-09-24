/**
 * アクセス管理（許可メールアドレス）の削除。
 *
 * 許可メールが0件になると、ログインの入口（ADMIN_PATH）が404になり誰もログインできなくなる。
 * サーバーは最後の1件の削除を断る（理由を日本語で返す）。
 *
 * 「今ログインしている人のメール」は分からない:
 * メールゲートの Cookie はどのメールで通ったかを持たない（パスワード由来の固定値）ので、
 * 特定のメールの削除で今の人だけが締め出されることは無い。締め出しが起きるのは0件のときだけ。
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { postJson, startTestServer, type TestServer } from './helpers/server.ts'

let server: TestServer
beforeAll(async () => {
  server = await startTestServer()
})
afterAll(async () => {
  await server.close()
})

interface Entry {
  id: number
  email: string
}

async function list(): Promise<Entry[]> {
  const res = await fetch(`${server.api}/allowed_emails`)
  return ((await res.json()) as { allowed_emails: Entry[] }).allowed_emails
}

describe('許可メールアドレスの削除', () => {
  it('2件あれば1件は消せるが、最後の1件は400で断り理由を返す', async () => {
    const a = await postJson<{ allowed_email: Entry }>(`${server.api}/allowed_emails`, { email: 'a@example.test' })
    const b = await postJson<{ allowed_email: Entry }>(`${server.api}/allowed_emails`, { email: 'b@example.test' })
    expect(a.status).toBe(201)
    expect(b.status).toBe(201)

    const first = await fetch(`${server.api}/allowed_emails/${a.json.allowed_email.id}`, { method: 'DELETE' })
    expect(first.status).toBe(200)

    const last = await fetch(`${server.api}/allowed_emails/${b.json.allowed_email.id}`, { method: 'DELETE' })
    expect(last.status).toBe(400)
    const body = (await last.json()) as { error: { message: string } }
    expect(body.error.message).toContain('最後の1件')
    expect((await list()).map((e) => e.email)).toEqual(['b@example.test'])
  })
})
