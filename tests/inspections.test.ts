import { describe, it, expect, beforeEach } from 'vitest'
import { createServer, type Server } from 'node:http'
import express from 'express'
import { abTestsRouter } from '../mock-server/routes/ab-tests.ts'
import { foldersRouter } from '../mock-server/routes/folders.ts'
import { tasksRouter } from '../mock-server/routes/tasks.ts'
import { inspectionsRouter } from '../mock-server/routes/inspections.ts'
import { resetState } from '../mock-server/store/store.ts'

/**
 * 審査（実SB「ツール > 審査」）。2026-09-10 に実機で確認した関係を固定する。
 *
 * 実物は2画面あって役割が違う:
 *   /inspections         … 審査そのもの（Version/ポップアップ・状態で絞り込み）
 *   /inspections/folders … 審査対象（フォルダごとのトグル）
 * 対象にしたフォルダのものだけが審査に並ぶ。
 * （実際、対象が1つもONでない状態では審査画面のツリーは見出しだけで中身が空だった）
 */
describe('審査', () => {
  let server: Server
  let base = ''

  const call = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    return (await res.json()) as T
  }

  beforeEach(async () => {
    if (server !== undefined) await new Promise<void>((r) => server.close(() => r()))
    resetState()
    const app = express()
    app.use(express.json())
    // 実際の並び（tasks が先）で載せる。tasks に置き石が戻ると、ここで落ちる。
    app.use('/api/v1', tasksRouter, foldersRouter, abTestsRouter, inspectionsRouter)
    server = createServer(app)
    await new Promise<void>((r) => server.listen(0, r))
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`
  })

  async function seed(): Promise<{ folderUid: string; versionUid: string }> {
    const f = await call<{ folder: { id: number; uid: string } }>('POST', '/folders', {
      name: '審査テスト',
    })
    const ab = await call<{ version: { uid: string } }>('POST', '/ab_tests', {
      title: 'サンプル施策001',
      folder_id: f.folder.id,
    })
    return { folderUid: f.folder.uid, versionUid: ab.version.uid }
  }

  it('審査対象にしていないフォルダのものは審査に並ばない', async () => {
    await seed()
    const res = await call<{ total: number }>('GET', '/inspections/entries?kind=version&status=all')
    expect(res.total).toBe(0)
  })

  it('審査対象にすると並び、はじめは「審査待ち」', async () => {
    const { folderUid } = await seed()
    await call('PUT', `/inspections/folders/${folderUid}`, { inspection_target: true })
    const res = await call<{ total: number; entries: { status: string }[] }>(
      'GET',
      '/inspections/entries?kind=version&status=all',
    )
    expect(res.total).toBe(1)
    expect(res.entries[0]?.status).toBe('waiting')
  })

  it('状態を変えると、その絞り込みにだけ出る', async () => {
    const { folderUid, versionUid } = await seed()
    await call('PUT', `/inspections/folders/${folderUid}`, { inspection_target: true })
    await call('PUT', `/inspections/entries/${versionUid}`, {
      kind: 'version',
      status: 'approved',
    })
    const approved = await call<{ entries: unknown[] }>(
      'GET',
      '/inspections/entries?kind=version&status=approved',
    )
    const waiting = await call<{ entries: unknown[] }>(
      'GET',
      '/inspections/entries?kind=version&status=waiting',
    )
    expect(approved.entries).toHaveLength(1)
    expect(waiting.entries).toHaveLength(0)
  })

  it('知らない状態は受け付けない', async () => {
    const { folderUid, versionUid } = await seed()
    await call('PUT', `/inspections/folders/${folderUid}`, { inspection_target: true })
    const res = await fetch(`${base}/inspections/entries/${versionUid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'version', status: 'なにか' }),
    })
    expect(res.status).toBe(422)
  })

  it('審査対象の一覧は グループ と グループにいないフォルダ に分かれる', async () => {
    await seed()
    const res = await call<{ groups: unknown[]; ungrouped: { name: string }[] }>(
      'GET',
      '/inspections/folders',
    )
    expect(res.groups).toEqual([])
    expect(res.ungrouped.map((f) => f.name)).toEqual(['審査テスト'])
  })
})
