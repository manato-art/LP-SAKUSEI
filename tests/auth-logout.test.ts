/**
 * ログアウトの行き先。
 *
 * 以前はログアウト後に `/` へ飛ばしていたが、`/` は未ログインだと404
 * （管理画面の存在を悟らせない作り）なので「ページが見つかりません」が出ていた。
 * ログアウトの応答で行き先（ログインの入口＝ADMIN_PATH）を返す。
 * ただし入口のパスは、ログインしていた人にだけ返す（未ログインの人が叩いても教えない）。
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ADMIN_PASSWORD, ADMIN_PATH } from '../mock-server/config.ts'
import { startTestServer, type TestServer } from './helpers/server.ts'

let server: TestServer
beforeAll(async () => {
  server = await startTestServer()
})
afterAll(async () => {
  await server.close()
})

async function loginCookie(): Promise<string> {
  const res = await fetch(`${server.baseUrl}/__auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PASSWORD }),
  })
  expect(res.status).toBe(200)
  const setCookie = res.headers.get('set-cookie') ?? ''
  return setCookie.split(';')[0] ?? ''
}

describe('ログアウト', () => {
  it('ログインしていた人には、ログインの入口を行き先として返す', async () => {
    const cookie = await loginCookie()
    const res = await fetch(`${server.baseUrl}/__auth/logout`, { method: 'POST', headers: { cookie } })
    const body = (await res.json()) as { ok: boolean; redirect?: string }
    expect(body.ok).toBe(true)
    expect(body.redirect).toBe(ADMIN_PATH)
  })

  it('ログインしていない人には入口のパスを教えない', async () => {
    const res = await fetch(`${server.baseUrl}/__auth/logout`, { method: 'POST' })
    const body = (await res.json()) as { ok: boolean; redirect?: string }
    expect(body.ok).toBe(true)
    expect(body.redirect).toBeUndefined()
    expect(JSON.stringify(body)).not.toContain(ADMIN_PATH)
  })

  it('画面はサーバーが返した行き先へ移る（決め打ちの / へ飛ばない）', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync('src/app/pages/account-settings.ts', 'utf8')
    expect(src).not.toContain("location.href = '/'")
    expect(src).toContain('redirect')
  })
})
