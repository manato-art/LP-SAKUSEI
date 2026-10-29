/**
 * クイックドメインの頭の名前を選べる（2026-10-29 本人「LPごとに分けることってできる？ Aしょうざい.〇〇.com みたいに」）。
 *
 * 以前は `<ランダム8文字>.<土台>` だけだった。商材ごとに `meguri.<土台>` のように、分かる名前を付けられるようにする。
 *   - 使えるのは英字（小文字）・数字・ハイフン（日本語は住所に使えない）。大文字は小文字にそろえる
 *   - ほかのフォルダが使っている名前・よく使われる決まった名前（www など）は使えない
 *   - 名前を入れなければ、今までどおりランダム
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { quickDomainLabelError } from '../src/shared/domain-input.ts'
import { postJson, resetStore, sendJson, startTestServer, type TestServer } from './helpers/server.ts'

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

async function folderUid(name: string): Promise<string> {
  return (await postJson<{ folder: { uid: string } }>(`${server.api}/folders`, { name })).json.folder.uid
}

const issue = (uid: string, label?: string) =>
  postJson<{ folder: { domain: string }; error?: { message: string } }>(
    `${server.api}/folders/${uid}/quick_domain`,
    label === undefined ? undefined : { label },
  )

describe('頭の名前の決まり（画面とサーバーで同じ）', () => {
  it('英字（小文字）・数字・ハイフンならよい', () => {
    expect(quickDomainLabelError('meguri')).toBeNull()
    expect(quickDomainLabelError('a-shouzai2')).toBeNull()
  })

  it('使えない形は、理由を日本語で返す', () => {
    expect(quickDomainLabelError('')).toContain('入れて')
    expect(quickDomainLabelError('めぐり')).toContain('英字')
    expect(quickDomainLabelError('-meguri')).toContain('ハイフン')
    expect(quickDomainLabelError('meguri-')).toContain('ハイフン')
    expect(quickDomainLabelError('a'.repeat(64))).toContain('63')
    expect(quickDomainLabelError('www')).toContain('使えません')
  })
})

describe('頭の名前を選んで発行する', () => {
  beforeEach(async () => {
    await sendJson('PUT', `${server.api}/teams/quick_domain`, { base: 'c1-news.test' })
  })

  it('選んだ名前.土台 がそのフォルダのドメインになる（大文字は小文字にそろえる）', async () => {
    const res = await issue(await folderUid('めぐり'), 'Meguri')
    expect(res.status).toBe(201)
    expect(res.json.folder.domain).toBe('meguri.c1-news.test')
  })

  it('ほかのフォルダが使っている名前は使えない（ほかの商材のLPを奪わない）', async () => {
    await issue(await folderUid('めぐり'), 'meguri')
    const res = await issue(await folderUid('ほかの商材'), 'meguri')
    expect(res.status).toBe(409)
    expect(res.json.error?.message).toContain('使われています')
  })

  it('形がおかしい名前は受け付けない', async () => {
    const res = await issue(await folderUid('めぐり'), 'めぐり')
    expect(res.status).toBe(422)
    expect(res.json.error?.message).toContain('英字')
  })

  it('名前を入れなければ、今までどおりランダム', async () => {
    const res = await issue(await folderUid('めぐり'))
    expect(res.status).toBe(201)
    expect(res.json.folder.domain).toMatch(/^[a-z0-9]{8}\.c1-news\.test$/)
  })
})
