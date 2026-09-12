/**
 * フォルダがドメインを持ち、配信URLがそれに従うことの機械証明（2026-09-13・本人承認）。
 *
 * 実物（公式FAQ）では配信URLは `https://<フォルダのドメイン>/ab/<ID>` で、
 * フォルダにドメインが無いと配信URLは表示されず「フォルダの設定＞ドメイン変更から設定してください」と案内される。
 * クローンは今まで、フォルダに関係なく常に自分のホストで配信URLを出していた。
 *
 * 保存する値: '' ＝ 未設定 / 'system' ＝ このシステムのドメイン / それ以外 ＝ 登録した独自ドメインのホスト名。
 * 項目が無い古い保存データは 'system' として読む（今まで出ていた配信URLを変えないため）。
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { getJson, postJson, resetStore, sendJson, startTestServer, type TestServer } from './helpers/server.ts'
import { getState } from '../mock-server/store/store.ts'
import { createEmptyState } from '../mock-server/store/seed-empty.ts'
import { createFolder } from '../mock-server/store/actions.ts'
import { migrateFolderDomains } from '../mock-server/store/folder-domain.ts'
import type { Folder, State } from '../mock-server/store/types.ts'

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

describe('フォルダが持つドメイン', () => {
  it('新しく作ったフォルダは未設定（実物と同じ）', () => {
    const out = createFolder(createEmptyState(), { name: 'A', parent_id: null })
    expect(out.folder.domain).toBe('')
  })

  it('ドメインの項目が無い古い保存データは、このシステムのドメインとして読む', () => {
    const base = createFolder(createEmptyState(), { name: 'A', parent_id: null }).state
    const legacy = JSON.parse(JSON.stringify(base)) as State
    for (const folder of legacy.folders as Folder[]) delete (folder as { domain?: string }).domain
    const out = migrateFolderDomains(legacy)
    expect(out.changed).toBe(1)
    expect(out.state.folders[0]?.domain).toBe('system')
  })

  it('すでにドメインが入っていれば何も変えない', () => {
    const state = createFolder(createEmptyState(), { name: 'A', parent_id: null }).state
    const out = migrateFolderDomains(state)
    expect(out.changed).toBe(0)
    expect(out.state).toBe(state)
  })
})

describe('フォルダのドメインを変える', () => {
  async function makeFolder(): Promise<string> {
    const created = await postJson<{ folder: { uid: string } }>(`${server.api}/folders`, { name: 'ドメインの確認' })
    return created.json.folder.uid
  }

  it('このシステムのドメインに設定できる', async () => {
    const uid = await makeFolder()
    const res = await sendJson('PUT', `${server.api}/folders/${uid}`, { domain: 'system' })
    expect(res.status).toBe(200)
    expect(getState().folders.find((f) => f.uid === uid)?.domain).toBe('system')
  })

  it('登録した独自ドメインに設定できる（大文字は小文字にそろえる）', async () => {
    const uid = await makeFolder()
    await sendJson('PUT', `${server.api}/folders/${uid}`, { domain: 'SB.Example.Test' })
    expect(getState().folders.find((f) => f.uid === uid)?.domain).toBe('sb.example.test')
  })

  it('未設定に戻せる', async () => {
    const uid = await makeFolder()
    await sendJson('PUT', `${server.api}/folders/${uid}`, { domain: 'system' })
    await sendJson('PUT', `${server.api}/folders/${uid}`, { domain: '' })
    expect(getState().folders.find((f) => f.uid === uid)?.domain).toBe('')
  })

  it('ドメインの形になっていない文字列は受け付けない', async () => {
    const uid = await makeFolder()
    for (const bad of ['http://sb.example.test', 'sb example test', 'a'.repeat(300)]) {
      expect((await sendJson('PUT', `${server.api}/folders/${uid}`, { domain: bad })).status).toBe(422)
    }
    expect(getState().folders.find((f) => f.uid === uid)?.domain).toBe('')
  })

  it('ページの情報に、そのフォルダのドメインが入っている（画面が余計な通信をしなくて済む）', async () => {
    const folderUid = await makeFolder()
    await sendJson('PUT', `${server.api}/folders/${folderUid}`, { domain: 'sb.example.test' })
    const folderId = getState().folders.find((f) => f.uid === folderUid)?.id ?? null
    const created = await postJson<{ ab_test: { uid: string } }>(`${server.api}/ab_tests`, {
      title: 'ドメイン確認用ページ',
      media_id: 1,
      folder_id: folderId,
    })
    const got = await getJson<{ ab_test: { folder: { domain: string } } }>(
      `${server.api}/ab_tests/${created.json.ab_test.uid}`,
    )
    expect(got.ab_test.folder.domain).toBe('sb.example.test')
  })

  it('名前の変更だけを送ったときは、ドメインを消さない', async () => {
    const uid = await makeFolder()
    await sendJson('PUT', `${server.api}/folders/${uid}`, { domain: 'sb.example.test' })
    await sendJson('PUT', `${server.api}/folders/${uid}`, { name: '名前だけ変更' })
    const folder = getState().folders.find((f) => f.uid === uid)
    expect(folder?.name).toBe('名前だけ変更')
    expect(folder?.domain).toBe('sb.example.test')
  })
})
