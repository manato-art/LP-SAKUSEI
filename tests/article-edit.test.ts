/**
 * ステップ（記事）の名前・色の変更と削除（2026-09-24 全体点検の「あった方がいい」: 作るだけで、直す・消すができなかった）。
 * ステップを作るときに選んだ色も、以前は送られず捨てられていた（点検17）。
 */
import { createServer, type Server } from 'node:http'
import express from 'express'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { abTestsRouter } from '../mock-server/routes/ab-tests.ts'
import { articlesEditRouter } from '../mock-server/routes/articles-edit.ts'
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

async function pageWithTwoSteps(): Promise<{ abTestUid: string; first: string; second: string }> {
  const created = await call<{ ab_test: { uid: string }; article: { uid: string } }>('POST', '/ab_tests', { title: 'ステップ確認', folder_id: null, media_id: null, editor_version: 2 })
  const step = await call<{ article: { uid: string } }>('POST', `/ab_tests/${created.json.ab_test.uid}/articles`, { name: '確認' })
  return { abTestUid: created.json.ab_test.uid, first: created.json.article.uid, second: step.json.article.uid }
}

beforeAll(async () => {
  const app = express()
  app.use(express.json())
  app.use('/api/v1', abTestsRouter, articlesEditRouter)
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

describe('ステップの名前・色', () => {
  it('名前と色を変えられる', async () => {
    const { second } = await pageWithTwoSteps()
    const res = await call<{ article: { memo: string; color: string } }>('PATCH', `/articles/${second}`, { memo: '申し込み', color: '#6236FF' })
    expect(res.status).toBe(200)
    expect(res.json.article.memo).toBe('申し込み')
    expect(res.json.article.color).toBe('#6236ff')
  })

  it('色は #RRGGBB だけ（ほかは 422）・名前は50文字まで', async () => {
    const { second } = await pageWithTwoSteps()
    expect((await call('PATCH', `/articles/${second}`, { color: 'red;background:url(x)' })).status).toBe(422)
    expect((await call('PATCH', `/articles/${second}`, { memo: 'あ'.repeat(51) })).status).toBe(422)
  })
})

describe('ステップの削除', () => {
  it('2つ目以降のステップは消せて、そのステップのVersionも消える', async () => {
    const { second } = await pageWithTwoSteps()
    const article = getState().articles.find((a) => a.uid === second)
    const res = await call('DELETE', `/articles/${second}`)
    expect(res.status).toBe(204)
    expect(getState().articles.some((a) => a.uid === second)).toBe(false)
    expect(getState().versions.some((v) => v.article_id === article?.id)).toBe(false)
  })

  it('最初のステップ（配信URLで最初に開くページ）は消せない（422）', async () => {
    const { first } = await pageWithTwoSteps()
    const res = await call<{ error: { message: string } }>('DELETE', `/articles/${first}`)
    expect(res.status).toBe(422)
    expect(getState().articles.some((a) => a.uid === first)).toBe(true)
  })
})
