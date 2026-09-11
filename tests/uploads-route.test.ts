/**
 * 保存の入口で埋め込み画像（data URL）を別ファイルにし、/uploads から配ることの機械証明（2026-09-11・本人依頼）。
 * 変換そのものは tests/uploads-externalize.test.ts が固定する。ここは「どの入口を通っても本文に data URL が残らない」こと。
 */
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { postJson, resetStore, sendJson, startTestServer, type TestServer } from './helpers/server.ts'
import { getState } from '../mock-server/store/store.ts'

const dir = mkdtempSync(join(tmpdir(), 'lp-sakusei-uploads-route-'))
let server: TestServer

beforeAll(async () => {
  // 配信ルートは作るときの保存先を使うので、サーバーを作る前に保存先を決める
  vi.stubEnv('UPLOADS_DIR', dir)
  server = await startTestServer()
})

afterAll(async () => {
  await server.close()
  vi.unstubAllEnvs()
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(() => {
  resetStore()
})

function png(fill: number): { bytes: Buffer; dataUrl: string; url: string } {
  const bytes = Buffer.alloc(4000, fill)
  return {
    bytes,
    dataUrl: `data:image/png;base64,${bytes.toString('base64')}`,
    url: `/uploads/${createHash('sha256').update(bytes).digest('hex')}.png`,
  }
}

/** beyondページを作り、その Version の uid を返す */
async function createVersion(): Promise<string> {
  await postJson(`${server.api}/ab_tests`, { title: '画像の確認', media_id: 1 })
  const version = getState().versions.at(-1)
  if (version === undefined) throw new Error('Versionを作れませんでした')
  return version.uid
}

describe('Version の保存', () => {
  it('本文とCSSの埋め込み画像を別ファイルにして保存し、/uploads から同じ中身を配る', async () => {
    const uid = await createVersion()
    const image = png(11)
    const res = await sendJson('PUT', `${server.api}/versions/${uid}`, {
      html: `<p><img src="${image.dataUrl}"></p>`,
      css: `.a{background:url(${image.dataUrl})}`,
    })
    expect(res.status).toBe(200)
    const saved = getState().versions.find((v) => v.uid === uid)
    expect(saved?.html).toBe(`<p><img src="${image.url}"></p>`)
    expect(saved?.css).toBe(`.a{background:url(${image.url})}`)

    const file = await fetch(`${server.baseUrl}${image.url}`)
    expect(file.status).toBe(200)
    expect(file.headers.get('content-type')).toContain('image/png')
    expect(file.headers.get('x-content-type-options')).toBe('nosniff')
    expect(Buffer.from(await file.arrayBuffer()).equals(image.bytes)).toBe(true)
  })

  it('無いファイルや、保存先の外を指すURLは配らない', async () => {
    expect((await fetch(`${server.baseUrl}/uploads/nothing.png`)).status).toBe(404)
    expect((await fetch(`${server.baseUrl}/uploads/..%2F..%2Fpackage.json`)).status).not.toBe(200)
  })
})

describe('マジック置換の画像', () => {
  it('新しい画像が埋め込みでも、別ファイルにしてから置き換える', async () => {
    const uid = await createVersion()
    const old = 'https://example.com/old.png'
    await sendJson('PUT', `${server.api}/versions/${uid}`, { html: `<p><img src="${old}"></p>` })
    const image = png(12)
    const res = await postJson(`${server.api}/articles/bulk_replaces`, {
      kind: 'image',
      targets: [{ version_uid: uid, value: old }],
      replacement: image.dataUrl,
    })
    expect(res.status).toBe(200)
    expect(getState().versions.find((v) => v.uid === uid)?.html).toBe(`<p><img src="${image.url}"></p>`)
  })
})
