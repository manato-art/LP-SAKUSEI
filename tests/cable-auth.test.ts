/**
 * CV速報のプッシュ（/cable）にもログインを要る（2026-09-24）。
 *
 * API（/api/*）は管理画面のログインが要るのに、/cable は誰でもつなげて、
 * 届いた CV（ページ名・Version名・金額）を受け取れた。CV速報が自動で更新されるように
 * 画面から /cable へつなぐので、同じログインの Cookie が無ければつながせない。
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type Server } from 'node:http'
import { WebSocket } from 'ws'
import { attachCable } from '../mock-server/ws/cable.ts'
import { ADMIN_SESSION_COOKIE, adminSessionTokenForTest } from '../mock-server/lib/admin-auth.ts'

let server: Server
let cable: { close: () => void }
let wsUrl: string

beforeAll(async () => {
  server = createServer((_req, res) => res.end())
  cable = attachCable(server, { requireAuth: true })
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('ポート取得に失敗しました')
  wsUrl = `ws://127.0.0.1:${address.port}/cable`
})

afterAll(async () => {
  cable.close()
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

function tryConnect(cookie?: string): Promise<'open' | 'rejected'> {
  return new Promise((resolve) => {
    const socket = new WebSocket(wsUrl, cookie === undefined ? {} : { headers: { cookie } })
    socket.once('open', () => {
      socket.close()
      resolve('open')
    })
    socket.once('error', () => resolve('rejected'))
  })
}

describe('/cable のログイン', () => {
  it('ログインの Cookie が無ければつながせない', async () => {
    expect(await tryConnect()).toBe('rejected')
    expect(await tryConnect(`${ADMIN_SESSION_COOKIE}=wrong`)).toBe('rejected')
  })

  it('ログイン済みならつながる', async () => {
    expect(await tryConnect(`${ADMIN_SESSION_COOKIE}=${adminSessionTokenForTest()}`)).toBe('open')
  })
})
