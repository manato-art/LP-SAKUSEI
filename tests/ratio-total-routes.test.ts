/**
 * 配信割合はいつも合計100%（2026-09-24・本人「合計で100%にして」）: 変更・アーカイブ・削除のあと
 */
import { createServer, type Server } from 'node:http'
import express from 'express'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { abTestsRouter } from '../mock-server/routes/ab-tests.ts'
import { versionsRouter } from '../mock-server/routes/versions.ts'
import { getState, resetState } from '../mock-server/store/store.ts'

let server: Server
let api = ''

async function call<T>(method: string, path: string, body?: unknown): Promise<{ status: number; json: T }> {
  const res = await fetch(`${api}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  return { status: res.status, json: (res.status === 204 ? null : await res.json()) as T }
}

/** 1つのステップに Version を n 個（1つ目は100%・残りは0%） */
async function stepWith(n: number): Promise<string[]> {
  const created = await call<{ article: { uid: string }; version: { uid: string } }>('POST', '/ab_tests', { title: '割合', folder_id: null, media_id: null, editor_version: 2 })
  const uids = [created.json.version.uid]
  for (let i = 1; i < n; i += 1) {
    const added = await call<{ version: { uid: string } }>('POST', `/articles/${created.json.article.uid}/versions`, {})
    uids.push(added.json.version.uid)
  }
  return uids
}

const ratios = (uids: readonly string[]): number[] =>
  uids.map((uid) => getState().versions.find((v) => v.uid === uid)?.distribution_ratio ?? -1)

beforeAll(async () => {
  const app = express()
  app.use(express.json())
  app.use('/api/v1', abTestsRouter, versionsRouter)
  server = createServer(app)
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('ポート取得に失敗しました')
  api = `http://127.0.0.1:${address.port}/api/v1`
})
afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))
})
beforeEach(() => resetState())

describe('配信割合を変えたとき', () => {
  it('3つのとき、残りを今の比のまま分け直し、変えた相手を返す', async () => {
    const [a, b, c] = await stepWith(3)
    await call('PATCH', `/versions/${b}/distribution`, { distribution_ratio: 30 }) // a70 b30 c0
    await call('PATCH', `/versions/${c}/distribution`, { distribution_ratio: 20 }) // a? b? c20
    expect(ratios([a!, b!, c!]).reduce((x, y) => x + y, 0)).toBe(100)
    const res = await call<{ adjusted_siblings: { uid: string; distribution_ratio: number }[] }>('PATCH', `/versions/${a}/distribution`, { distribution_ratio: 70 })
    const [, rb, rc] = ratios([a!, b!, c!])
    expect(ratios([a!, b!, c!])[0]).toBe(70)
    expect((rb ?? 0) + (rc ?? 0)).toBe(30)
    expect(res.json.adjusted_siblings.map((s) => s.uid).sort()).toEqual([b, c].sort())
  })

  it('Versionが1つなら100%のまま', async () => {
    const [a] = await stepWith(1)
    const res = await call<{ version: { distribution_ratio: number } }>('PATCH', `/versions/${a}/distribution`, { distribution_ratio: 40 })
    expect(res.json.version.distribution_ratio).toBe(100)
  })
})

describe('アーカイブ・削除のあと', () => {
  it('アーカイブで抜けたぶんを、残りへ今の比のまま広げる', async () => {
    const [a, b, c] = await stepWith(3)
    await call('PATCH', `/versions/${a}/distribution`, { distribution_ratio: 50 }) // b・c は 0→均等 25/25
    await call('POST', `/versions/${b}/archive`)
    expect(ratios([a!, c!]).reduce((x, y) => x + y, 0)).toBe(100)
  })

  it('削除で抜けたぶんも、残りへ広げる', async () => {
    const [a, b] = await stepWith(2)
    await call('PATCH', `/versions/${a}/distribution`, { distribution_ratio: 60 }) // b40
    const res = await call('DELETE', `/versions/${b}`)
    expect(res.status).toBe(204)
    expect(ratios([a!])).toEqual([100])
  })
})
