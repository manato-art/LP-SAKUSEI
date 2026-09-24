/**
 * 2026-09-24 全体点検
 * 3 変更・復元履歴がVersionを区別せず、「復元」すると先頭のVersionが書き換わっていた
 * E 2人（または2つのタブ）が同じVersionを開いていると、自動保存で互いの編集を黙って消し合っていた
 */
import { createServer, type Server } from 'node:http'
import express from 'express'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { abTestsRouter } from '../mock-server/routes/ab-tests.ts'
import { versionsRouter } from '../mock-server/routes/versions.ts'
import { historyRouter } from '../mock-server/routes/panel-history.ts'
import { getState, resetState } from '../mock-server/store/store.ts'
import { resetArticleHistories } from '../mock-server/store/article-history.ts'

let server: Server
let api = ''

async function call<T>(method: string, path: string, body?: unknown, session = 'tab-A'): Promise<{ status: number; json: T }> {
  const res = await fetch(`${api}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Editor-Session': session },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  return { status: res.status, json: (await res.json()) as T }
}

async function seedTwoVersions(): Promise<{ articleUid: string; v1: string; v2: string }> {
  const created = await call<{ article: { uid: string }; version: { uid: string } }>('POST', '/ab_tests', {
    title: '履歴の確認',
    folder_id: null,
    media_id: null,
    editor_version: 2,
  })
  const articleUid = created.json.article.uid
  const added = await call<{ version: { uid: string } }>('POST', `/articles/${articleUid}/versions`, {})
  await call('PUT', `/versions/${created.json.version.uid}`, { html: '<p>Version1の本文</p>' })
  await call('PUT', `/versions/${added.json.version.uid}`, { html: '<p>Version2の本文</p>' })
  return { articleUid, v1: created.json.version.uid, v2: added.json.version.uid }
}

const htmlOf = (uid: string): string => getState().versions.find((v) => v.uid === uid)?.html ?? ''

beforeAll(async () => {
  const app = express()
  app.use(express.json({ limit: '8mb' }))
  app.use('/api/v1', abTestsRouter, versionsRouter, historyRouter)
  server = createServer(app)
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('ポート取得に失敗しました')
  api = `http://127.0.0.1:${address.port}/api/v1`
})

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))
})

beforeEach(() => {
  resetState()
  resetArticleHistories()
})

describe('変更・復元履歴はVersionごと（点検3）', () => {
  it('Version2 で記録した履歴は、Version2 の一覧にだけ出る', async () => {
    const { articleUid, v1, v2 } = await seedTwoVersions()
    await call('POST', `/articles/${articleUid}/histories`, { html: '<p>Version2 を直した</p>', version_uid: v2 })
    const list2 = await call<{ histories: { version_uid: string }[] }>('GET', `/articles/${articleUid}/histories?version_uid=${v2}`)
    const list1 = await call<{ histories: { version_uid: string }[] }>('GET', `/articles/${articleUid}/histories?version_uid=${v1}`)
    expect(list2.json.histories.every((h) => h.version_uid === v2)).toBe(true)
    expect(list2.json.histories.length).toBeGreaterThanOrEqual(1)
    expect(list1.json.histories.every((h) => h.version_uid === v1)).toBe(true)
  })

  it('Version2 の履歴を復元しても、Version1 は書き換わらない', async () => {
    const { articleUid, v1, v2 } = await seedTwoVersions()
    await call('POST', `/articles/${articleUid}/histories`, { html: '<p>Version2 の古い本文</p>', version_uid: v2 })
    await call('POST', `/articles/${articleUid}/histories`, { html: '<p>Version2 の新しい本文</p>', version_uid: v2 })
    const list = await call<{ histories: { id: number; is_current: boolean }[] }>('GET', `/articles/${articleUid}/histories?version_uid=${v2}`)
    const old = list.json.histories.find((h) => !h.is_current)
    expect(old).toBeDefined()
    await call('POST', `/articles/${articleUid}/histories/${String(old?.id)}/restore?version_uid=${v2}`)
    expect(htmlOf(v1)).toBe('<p>Version1の本文</p>')
    expect(htmlOf(v2)).not.toBe('<p>Version1の本文</p>')
  })

  it('別のVersionの履歴の番号を指定して復元はできない（404）', async () => {
    const { articleUid, v1, v2 } = await seedTwoVersions()
    await call('POST', `/articles/${articleUid}/histories`, { html: '<p>Version2 の本文A</p>', version_uid: v2 })
    const list = await call<{ histories: { id: number }[] }>('GET', `/articles/${articleUid}/histories?version_uid=${v2}`)
    const id = list.json.histories[0]?.id
    const res = await call('POST', `/articles/${articleUid}/histories/${String(id)}/restore?version_uid=${v1}`)
    expect(res.status).toBe(404)
  })
})

describe('同じVersionを2か所で直したときの上書きの検知（E）', () => {
  it('開いたあとに別のタブが保存していたら、古い土台での保存は 409 で止まり、相手の中身を返す', async () => {
    const { v1 } = await seedTwoVersions()
    const opened = await call<{ version: { content_revision: number } }>('PUT', `/versions/${v1}`, { html: '<p>A が直した</p>' }, 'tab-A')
    const base = opened.json.version.content_revision
    await call('PUT', `/versions/${v1}`, { html: '<p>B が直した</p>', base_revision: base }, 'tab-B')
    const res = await call<{ error: { code: string }; version: { html: string } }>(
      'PUT',
      `/versions/${v1}`,
      { html: '<p>A がさらに直した</p>', base_revision: base },
      'tab-A',
    )
    expect(res.status).toBe(409)
    expect(res.json.error.code).toBe('conflict')
    expect(res.json.version.html).toBe('<p>B が直した</p>')
    expect(htmlOf(v1)).toBe('<p>B が直した</p>')
  })

  it('自分（同じタブ）の保存や置換で進んだぶんは、ぶつかったことにしない', async () => {
    const { v1 } = await seedTwoVersions()
    const first = await call<{ version: { content_revision: number } }>('PUT', `/versions/${v1}`, { html: '<p>1</p>' }, 'tab-A')
    await call('PUT', `/versions/${v1}`, { html: '<p>2</p>' }, 'tab-A')
    const res = await call('PUT', `/versions/${v1}`, { html: '<p>3</p>', base_revision: first.json.version.content_revision }, 'tab-A')
    expect(res.status).toBe(200)
    expect(htmlOf(v1)).toBe('<p>3</p>')
  })

  it('土台を送らない保存（「自分の内容で上書き」・古い画面）は今までどおり通る', async () => {
    const { v1 } = await seedTwoVersions()
    await call('PUT', `/versions/${v1}`, { html: '<p>B</p>' }, 'tab-B')
    const res = await call('PUT', `/versions/${v1}`, { html: '<p>A</p>' }, 'tab-A')
    expect(res.status).toBe(200)
    expect(htmlOf(v1)).toBe('<p>A</p>')
  })
})

describe('Versionの削除で配信を止めない（点検42: アーカイブには防止があるのに削除には無かった）', () => {
  it('配信割合が1以上のVersionがほかに無いとき、配信中のVersionは削除できない（422）', async () => {
    const { v1, v2 } = await seedTwoVersions()
    // v1=100% / v2=0%（追加したVersionは0%）
    const res = await call<{ error: { message: string } }>('DELETE', `/versions/${v1}`)
    expect(res.status).toBe(422)
    expect(res.json.error.message).toContain('配信割合')
    expect(getState().versions.some((v) => v.uid === v1)).toBe(true)
    // 0% の方は消せる
    const ok = await fetch(`${api}/versions/${v2}`, { method: 'DELETE' })
    expect(ok.status).toBe(204)
  })

  it('ページのVersionが1つだけなら削除できない（Versionが無いページになるため）', async () => {
    const created = await call<{ version: { uid: string } }>('POST', '/ab_tests', { title: '1つだけ', folder_id: null, media_id: null, editor_version: 2 })
    const res = await call('DELETE', `/versions/${created.json.version.uid}`)
    expect(res.status).toBe(422)
  })
})

describe('Version複製のリンク設定（点検13）', () => {
  it('【削除】全てのページ内URL を選ぶと、複製先のリンクを外す（元のVersionはそのまま）', async () => {
    const { v1 } = await seedTwoVersions()
    await call('PUT', `/versions/${v1}`, { html: '<p><a href="https://shop.example.test/?sb_tracking=true">買う</a> と <a href="/about">会社</a></p>' })
    const res = await call<{ version: { uid: string; html: string } }>('POST', `/versions/${v1}/duplicate`, { link_mode: 'remove_links' })
    expect(res.status).toBe(201)
    expect(res.json.version.html).toBe('<p>買う と 会社</p>')
    expect(htmlOf(v1)).toContain('<a href="/about">')
  })

  it('【削除】トラッキングリンクだけ を選ぶと、計測付きのリンクだけ外す', async () => {
    const { v1 } = await seedTwoVersions()
    await call('PUT', `/versions/${v1}`, { html: '<p><a href="https://shop.example.test/?sb_tracking=true">買う</a> と <a href="/about">会社</a></p>' })
    const res = await call<{ version: { html: string } }>('POST', `/versions/${v1}/duplicate`, { link_mode: 'remove_tracking_links' })
    expect(res.json.version.html).toBe('<p>買う と <a href="/about">会社</a></p>')
  })

  it('知らない指定は 422（黙って残さない）', async () => {
    const { v1 } = await seedTwoVersions()
    const res = await call('POST', `/versions/${v1}/duplicate`, { link_mode: 'xxx' })
    expect(res.status).toBe(422)
  })
})

describe('履歴の1件の中身（比較モードの「更新履歴・復元」で見比べる・点検17）', () => {
  it('そのVersionの履歴なら本文を返す。別のVersionを指したら 404', async () => {
    const { articleUid, v1, v2 } = await seedTwoVersions()
    await call('POST', `/articles/${articleUid}/histories`, { html: '<p>Version2 のある時点</p>', version_uid: v2 })
    const list = await call<{ histories: { id: number }[] }>('GET', `/articles/${articleUid}/histories?version_uid=${v2}`)
    const id = list.json.histories[0]?.id
    const ok = await call<{ history: { id: number; html: string } }>('GET', `/articles/${articleUid}/histories/${String(id)}?version_uid=${v2}`)
    expect(ok.status).toBe(200)
    expect(ok.json.history.html).toBe('<p>Version2 のある時点</p>')
    const ng = await call('GET', `/articles/${articleUid}/histories/${String(id)}?version_uid=${v1}`)
    expect(ng.status).toBe(404)
  })
})
