/**
 * 本番（SERVE_DIST あり）では、開発・テスト用の口を誰も使えないことの機械証明（2026-09-11 全体監査で発見）。
 *
 * 以前は本番でも次が有効だった:
 *   - どのURLにも `?reset=1` を付けるだけで、ログインなしで全データが空になる（公開LPのURLでも）
 *   - `POST /__mock/reset` も、ログインなしで全データを空にする
 *   - `?mock_state=error|loading` を付けるだけで、どのページもわざと500エラー・2秒遅延にできる
 *   - `/__mock/errors` で、直近のエラー（URL・スタックトレース）を誰でも読める
 * 開発（Vite）とテストでは今までどおり使える（tests/creation-flow.test.ts が固定）。
 */
import { createServer, type Server } from 'node:http'
import type { Request } from 'express'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

let server: Server
let baseUrl = ''
let store: typeof import('../mock-server/store/store.ts')
let mockState: typeof import('../mock-server/lib/mock-state.ts')

/** リセットされると消える目印（シードの nextId は 100） */
const MARKER_NEXT_ID = 987654

beforeAll(async () => {
  // config.ts は読み込んだ時点の環境変数で本番かどうかを決めるので、本番にしてから読み込む
  vi.stubEnv('SERVE_DIST', 'dist')
  vi.resetModules()
  const { createApp } = await import('../mock-server/app.ts')
  store = await import('../mock-server/store/store.ts')
  mockState = await import('../mock-server/lib/mock-state.ts')
  server = createServer(createApp())
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('ポート取得に失敗しました')
  baseUrl = `http://127.0.0.1:${address.port}`
  store.setState((state) => ({ ...state, nextId: MARKER_NEXT_ID }))
})

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))
  vi.unstubAllEnvs()
})

describe('本番では、ログインしていない人が全データを消せない', () => {
  it('公開LPのURLに ?reset=1 を付けても消えない', async () => {
    await fetch(`${baseUrl}/lp/NOPE?reset=1`)
    expect(store.getState().nextId).toBe(MARKER_NEXT_ID)
  })

  it('管理APIのURLに ?reset=1 を付けても消えない（ログインしていないので 401）', async () => {
    const res = await fetch(`${baseUrl}/api/v1/folders?reset=1`)
    expect(res.status).toBe(401)
    expect(store.getState().nextId).toBe(MARKER_NEXT_ID)
  })

  it('POST /__mock/reset は無い（404）', async () => {
    const res = await fetch(`${baseUrl}/__mock/reset`, { method: 'POST' })
    expect(res.status).toBe(404)
    expect(store.getState().nextId).toBe(MARKER_NEXT_ID)
  })
})

describe('本番では、URLに付けるだけでエラーや遅延にできない', () => {
  it('?mock_state=error を付けても、管理APIは本来の応答（ログインしていないので 401）', async () => {
    const res = await fetch(`${baseUrl}/api/v1/folders?mock_state=error`)
    expect(res.status).toBe(401)
  })

  it('?mock_state=error を付けても、公開LPは500にならない', async () => {
    const res = await fetch(`${baseUrl}/lp/NOPE?mock_state=error`)
    expect(res.status).not.toBe(500)
  })

  it('?mock_state=loading を付けても待たされない', async () => {
    const started = Date.now()
    await fetch(`${baseUrl}/lp/NOPE?mock_state=loading`)
    expect(Date.now() - started).toBeLessThan(1500)
  })

  it('?mock_state=empty を付けても、一覧は空に差し替わらない', () => {
    const req = { query: { mock_state: 'empty' } } as unknown as Request
    expect(mockState.readMockState(req)).toBe('success')
    expect(mockState.applyEmptyState(req, [1, 2])).toEqual([1, 2])
  })
})

describe('本番では、エラーの詳細をログインしていない人に見せない', () => {
  it('ログインしていなければ /__mock/errors は 404', async () => {
    const res = await fetch(`${baseUrl}/__mock/errors`)
    expect(res.status).toBe(404)
  })
})
