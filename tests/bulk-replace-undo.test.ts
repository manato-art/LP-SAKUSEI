/**
 * マジック置換の「選んだ行 → 置換の指定」と「元に戻す」の機械証明。
 *
 * 1. 半角スペースを含む語（例「赤い 花」）でも、選んだ行がそのまま置換の指定になる。
 *    以前は `${version_uid} ${value}` を空白で割り直していたため、語が「赤い」に切れ、
 *    別の場所（「赤い」だけの所）が置き換わっていた。
 * 2. 置換したVersionは「変更・復元履歴」に前後が積まれ、結果画面の「元に戻す」で戻せる。
 *    戻すのは置換した直後の本文のままのVersionだけ（後から手で直した所は上書きしない）。
 */
import { createServer, type Server } from 'node:http'
import express from 'express'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { abTestsRouter } from '../mock-server/routes/ab-tests.ts'
import { versionsRouter } from '../mock-server/routes/versions.ts'
import { bulkReplaceRouter } from '../mock-server/routes/bulk-replace.ts'
import { historyRouter } from '../mock-server/routes/panel-history.ts'
import { miscRouter } from '../mock-server/routes/misc.ts'
import { resetState } from '../mock-server/store/store.ts'
import { resetArticleHistories } from '../mock-server/store/article-history.ts'
import { collectReplaceTargets, rowKey } from '../src/app/pages/bulk-replace-targets.ts'
import type { BulkReplacePage } from '../src/app/api.ts'

describe('選んだ行から置換の指定を組み立てる', () => {
  const page: BulkReplacePage = {
    ab_test_uid: 'ab1',
    title: 'ページ',
    rows: [
      { value: '赤い 花', label: '…赤い 花…', count: 1, version_uid: 'v1', version_name: 'V1', text_index: 0 },
      { value: '赤い 花', label: '…赤い 花…', count: 1, version_uid: 'v1', version_name: 'V1', text_index: 2 },
      { value: '赤い 花', label: '…赤い 花…', count: 1, version_uid: 'v2', version_name: 'V2', text_index: 1 },
    ],
  }

  it('半角スペースを含む語が切れずに、Versionごとの番号付きでまとまる', () => {
    const checked = new Set(page.rows.map((r) => rowKey(page, r)))
    expect(collectReplaceTargets([page], checked, 'text')).toEqual([
      { version_uid: 'v1', value: '赤い 花', indexes: [0, 2] },
      { version_uid: 'v2', value: '赤い 花', indexes: [1] },
    ])
  })

  it('チェックしていない行は入らない', () => {
    const first = page.rows[0]
    if (first === undefined) throw new Error('行がありません')
    const checked = new Set([rowKey(page, first)])
    expect(collectReplaceTargets([page], checked, 'text')).toEqual([
      { version_uid: 'v1', value: '赤い 花', indexes: [0] },
    ])
  })

  it('画像・リンクは番号を付けずに値ごとに出す（空白を含むURLでも切れない）', () => {
    const linkPage: BulkReplacePage = {
      ab_test_uid: 'ab1',
      title: 'ページ',
      rows: [
        { value: 'https://x.test/a b', label: 'https://x.test/a b', count: 2, version_uid: 'v1', version_name: 'V1' },
      ],
    }
    const checked = new Set(linkPage.rows.map((r) => rowKey(linkPage, r)))
    expect(collectReplaceTargets([linkPage], checked, 'link')).toEqual([
      { version_uid: 'v1', value: 'https://x.test/a b' },
    ])
  })

  it('行の鍵は値に空白があっても別の行と取り違えない', () => {
    const a = { ...page, rows: [] }
    const k1 = rowKey(a, { value: 'x 1', label: '', count: 1, version_uid: 'v', version_name: '', text_index: 2 })
    const k2 = rowKey(a, { value: 'x', label: '', count: 1, version_uid: 'v', version_name: '', text_index: 12 })
    expect(k1).not.toBe(k2)
  })
})

let server: Server
let base = ''

async function call<T>(method: string, path: string, body?: unknown): Promise<{ status: number; json: T }> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  return { status: res.status, json: (await res.json().catch(() => null)) as T }
}

async function seed(html: string): Promise<{ abUid: string; articleUid: string; versionUid: string }> {
  const created = await call<{ ab_test: { uid: string }; article: { uid: string }; version: { uid: string } }>(
    'POST',
    '/ab_tests',
    { title: 'サンプル施策001' },
  )
  await call('PUT', `/versions/${created.json.version.uid}`, { html })
  return {
    abUid: created.json.ab_test.uid,
    articleUid: created.json.article.uid,
    versionUid: created.json.version.uid,
  }
}

async function htmlOf(articleUid: string): Promise<string> {
  const res = await call<{ versions: { html: string }[] }>('GET', `/articles/${articleUid}/versions`)
  return res.json.versions[0]?.html ?? ''
}

beforeAll(async () => {
  const app = express()
  app.use(express.json({ limit: '8mb' }))
  app.use('/api/v1', miscRouter, abTestsRouter, versionsRouter, historyRouter, bulkReplaceRouter)
  server = createServer(app)
  await new Promise<void>((r) => server.listen(0, r))
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`
})

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()))
})

beforeEach(() => {
  resetState()
  resetArticleHistories()
})

describe('マジック置換の元に戻す', () => {
  it('半角スペースを含む語を選んだ所だけ置き換える（「赤い」だけの所は触らない）', async () => {
    const { articleUid, versionUid } = await seed('<p>赤い 花</p><p>赤い</p>')
    const done = await call<{ replaced: number }>('POST', '/articles/bulk_replaces', {
      kind: 'text',
      targets: [{ version_uid: versionUid, value: '赤い 花', indexes: [0] }],
      replacement: '白い 花',
    })
    expect(done.json.replaced).toBe(1)
    expect(await htmlOf(articleUid)).toBe('<p>白い 花</p><p>赤い</p>')
  })

  it('置換の前後が変更・復元履歴に積まれる', async () => {
    const { articleUid, versionUid } = await seed('<p>あああ</p>')
    await call('POST', '/articles/bulk_replaces', {
      kind: 'text',
      targets: [{ version_uid: versionUid, value: 'あああ' }],
      replacement: 'いいい',
    })
    const res = await call<{ histories: { label: string }[] }>(
      'GET',
      `/articles/${articleUid}/histories?version_uid=${versionUid}`,
    )
    // 新しい順: 置換後 → 置換前
    expect(res.json.histories.length).toBeGreaterThanOrEqual(2)
  })

  it('「元に戻す」で置換前の本文に戻り、戻した結果も履歴に残る', async () => {
    const { articleUid, versionUid } = await seed('<p>あああ</p>')
    const done = await call<{ undo_id: string }>('POST', '/articles/bulk_replaces', {
      kind: 'text',
      targets: [{ version_uid: versionUid, value: 'あああ' }],
      replacement: 'いいい',
    })
    expect(typeof done.json.undo_id).toBe('string')
    const before = await call<{ histories: unknown[] }>('GET', `/articles/${articleUid}/histories?version_uid=${versionUid}`)

    const undo = await call<{ restored: number; skipped: number }>(
      'POST',
      `/articles/bulk_replaces/${done.json.undo_id}/undo`,
    )
    expect(undo.status).toBe(200)
    expect(undo.json).toEqual({ restored: 1, skipped: 0 })
    expect(await htmlOf(articleUid)).toBe('<p>あああ</p>')

    const after = await call<{ histories: unknown[] }>('GET', `/articles/${articleUid}/histories?version_uid=${versionUid}`)
    expect(after.json.histories.length).toBe(before.json.histories.length + 1)
  })

  it('置換の後に手で直したVersionは上書きせず、戻せなかった数を返す', async () => {
    const { articleUid, versionUid } = await seed('<p>あああ</p>')
    const done = await call<{ undo_id: string }>('POST', '/articles/bulk_replaces', {
      kind: 'text',
      targets: [{ version_uid: versionUid, value: 'あああ' }],
      replacement: 'いいい',
    })
    await call('PUT', `/versions/${versionUid}`, { html: '<p>手で直した</p>' })
    const undo = await call<{ restored: number; skipped: number }>(
      'POST',
      `/articles/bulk_replaces/${done.json.undo_id}/undo`,
    )
    expect(undo.json).toEqual({ restored: 0, skipped: 1 })
    expect(await htmlOf(articleUid)).toBe('<p>手で直した</p>')
  })

  it('同じ置換を2回戻そうとしたら断る', async () => {
    const { versionUid } = await seed('<p>あああ</p>')
    const done = await call<{ undo_id: string }>('POST', '/articles/bulk_replaces', {
      kind: 'text',
      targets: [{ version_uid: versionUid, value: 'あああ' }],
      replacement: 'いいい',
    })
    await call('POST', `/articles/bulk_replaces/${done.json.undo_id}/undo`)
    const again = await call('POST', `/articles/bulk_replaces/${done.json.undo_id}/undo`)
    expect(again.status).toBe(404)
  })

  it('知らない番号は404', async () => {
    const res = await call('POST', '/articles/bulk_replaces/nope/undo')
    expect(res.status).toBe(404)
  })
})
