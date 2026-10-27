/**
 * Widget一覧の検索は、全部の見本から探す（2026-10-27 指示㉕ 本人「見本ってところ消してOK」→ 選択「全部の見本から探す」）。
 * 「見本」（全部の見本）を消すと、全部から探す場所がなくなるため。取り込んだ見本（SquadBeyond・約1,600件・13MB）は
 * 画面で全部読むと重いので、サーバーが名前で探して合う物だけ返す。
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { emailGateToken } from '../mock-server/lib/creator-session.ts'
import { startTestServer, type TestServer } from './helpers/server.ts'

let server: TestServer
beforeAll(async () => {
  server = await startTestServer()
})
afterAll(async () => {
  await server.close()
})

const ADMIN = `email_gate=${emailGateToken('ebina@example.com')}`

async function search(q: string): Promise<{ status: number; parts: { id: number; name: string; html: string }[]; total: number }> {
  const res = await fetch(`${server.api}/sb_widgets/search?q=${encodeURIComponent(q)}`, { headers: { cookie: ADMIN } })
  const json = (await res.json()) as { parts?: { id: number; name: string; html: string }[]; total?: number }
  return { status: res.status, parts: json.parts ?? [], total: json.total ?? 0 }
}

describe('取り込んだ見本を名前で探す（全部の分類から）', () => {
  it('名前に言葉を含む物だけ返す（大文字小文字を区別しない）。中身（HTML）も付ける', async () => {
    const out = await search('faq')
    expect(out.status).toBe(200)
    expect(out.parts.length).toBeGreaterThan(0)
    for (const part of out.parts) expect(part.name.toLowerCase()).toContain('faq')
    expect(out.parts[0]?.html.length).toBeGreaterThan(0)
    expect(out.total).toBeGreaterThanOrEqual(out.parts.length)
  })

  it('多すぎるときは60件まで返し、合う数（total）も返す', async () => {
    const out = await search('ボタン')
    expect(out.status).toBe(200)
    expect(out.parts.length).toBeLessThanOrEqual(60)
    expect(out.total).toBeGreaterThanOrEqual(out.parts.length)
  })

  it('言葉が空なら何も返さない', async () => {
    const out = await search('  ')
    expect(out.status).toBe(200)
    expect(out.parts).toEqual([])
    expect(out.total).toBe(0)
  })
})
