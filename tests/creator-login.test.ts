/**
 * LP作成者のログイン（2026-10-15）。
 *
 * 入口はこれまでと同じ（メール → パスワード）。入口で入れたメールが LP作成者なら、
 * その人のパスワードでだけ入れる（共通のパスワードでは入れない＝管理者になれない）。
 * 管理者（アクセス管理のメール）は、これまでどおり共通のパスワードで入る。
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ADMIN_PASSWORD } from '../mock-server/config.ts'
import { createCreatorAccount, resetCreatorAccountsForTest } from '../mock-server/store/creator-accounts.ts'
import { startTestServer, type TestServer } from './helpers/server.ts'

let server: TestServer
beforeAll(async () => {
  server = await startTestServer()
})
afterAll(async () => {
  await server.close()
})
beforeEach(() => {
  resetCreatorAccountsForTest()
  const out = createCreatorAccount({ email: 'writer@example.com', name: '佐藤', password: 'creator-pass-01' })
  if (!out.ok) throw new Error(out.message)
})

const cookiesOf = (res: Response): string[] =>
  (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0] ?? '')

async function passGate(email: string): Promise<{ status: number; cookie: string }> {
  const res = await fetch(`${server.baseUrl}/__auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  return { status: res.status, cookie: cookiesOf(res).join('; ') }
}

async function login(password: string, cookie = ''): Promise<{ status: number; cookies: string[] }> {
  const res = await fetch(`${server.baseUrl}/__auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ password }),
  })
  return { status: res.status, cookies: cookiesOf(res) }
}

async function me(cookie: string): Promise<{ role: string | null; email?: string; name?: string }> {
  const res = await fetch(`${server.baseUrl}/__auth/me`, { headers: { cookie } })
  return (await res.json()) as { role: string | null; email?: string; name?: string }
}

const sessionCookie = (cookies: string[]): string =>
  cookies.filter((c) => !c.endsWith('=')).join('; ')

describe('LP作成者のログイン', () => {
  it('入口でメールを入れて、自分のパスワードで入れる', async () => {
    const gate = await passGate('Writer@Example.com')
    expect(gate.status).toBe(200)

    const res = await login('creator-pass-01', gate.cookie)
    expect(res.status).toBe(200)
    expect(await me(sessionCookie(res.cookies))).toEqual({ role: 'creator', email: 'writer@example.com', name: '佐藤' })
  })

  it('LP作成者のメールでは、共通のパスワードでは入れない（管理者になれない）', async () => {
    const gate = await passGate('writer@example.com')
    const res = await login(ADMIN_PASSWORD, gate.cookie)
    expect(res.status).toBe(401)
  })

  it('パスワードが違えば入れない', async () => {
    const gate = await passGate('writer@example.com')
    expect((await login('wrong-password', gate.cookie)).status).toBe(401)
  })

  it('入口の印は書き換えられない（ほかの人のメールに付け替えると、入口を通っていない扱い）', async () => {
    const gate = await passGate('writer@example.com')
    const forged = gate.cookie.replace(/=([^.]*)\./, `=${Buffer.from('someone@example.com').toString('base64url')}.`)
    const res = await login('creator-pass-01', forged)
    expect(res.status).toBe(401)
  })

  it('ログアウトすると、LP作成者の印も消える', async () => {
    const gate = await passGate('writer@example.com')
    const cookie = sessionCookie((await login('creator-pass-01', gate.cookie)).cookies)
    const res = await fetch(`${server.baseUrl}/__auth/logout`, { method: 'POST', headers: { cookie } })
    const cleared = cookiesOf(res)
    expect(cleared.some((c) => c.startsWith('creator_session=') && c.endsWith('='))).toBe(true)
  })
})

describe('管理者のログインは今までどおり', () => {
  it('共通のパスワードで入れて、管理者として扱う', async () => {
    const res = await login(ADMIN_PASSWORD)
    expect(res.status).toBe(200)
    expect((await me(sessionCookie(res.cookies))).role).toBe('admin')
  })
})
