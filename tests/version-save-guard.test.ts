/**
 * データ損失防止ガードの機械証明（「めぐり」の画像が全消えした事故の再発防止）。
 *
 * エディタのQuillはリコンサイルで本文が一瞬「空」になることがあり、その瞬間に自動保存が走ると
 * 入れた画像ごとサーバーの本文を消してしまう。サーバー側の updateVersion が
 * 「中身のあるVersionを空HTMLで上書きしない」ことを、実サーバーのPUT経由で確かめる。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getJson, postJson, resetStore, sendJson, startTestServer, type TestServer } from './helpers/server.ts'

let server: TestServer

beforeEach(async () => {
  server = await startTestServer()
  resetStore()
})
afterEach(async () => {
  await server.close()
})

async function newVersion(): Promise<{ articleUid: string; versionUid: string }> {
  const created = await postJson<{ article: { uid: string }; version: { uid: string } }>(
    `${server.api}/ab_tests`,
    { title: 'サンプル施策001', media_id: 1 },
  )
  return { articleUid: created.json.article.uid, versionUid: created.json.version.uid }
}

async function htmlOf(articleUid: string, versionUid: string): Promise<string> {
  const { versions } = await getJson<{ versions: { uid: string; html: string }[] }>(
    `${server.api}/articles/${articleUid}/versions`,
  )
  return versions.find((v) => v.uid === versionUid)?.html ?? ''
}

// 実際に入るのは dataURL 画像だが、匿名化ゲートが長い base64 を秘密トークンと誤検知するため、
// ガードの判定に必要な `<img>` タグだけを持つ短い src にする（ガードは src の中身を見ない）。
const IMG_HTML = '<p>本文</p><p><img src="/uploads/sample-image.png" alt="サンプル画像"></p>'
const EMPTY_HTML = '<p><br></p>'

describe('空HTMLで既存の本文を上書きしない（データ損失防止）', () => {
  it('画像入りで保存 → 空HTMLで保存しても画像は消えない', async () => {
    const { articleUid, versionUid } = await newVersion()

    const saved = await sendJson('PUT', `${server.api}/versions/${versionUid}`, { html: IMG_HTML })
    expect(saved.status).toBe(200)
    expect(await htmlOf(articleUid, versionUid)).toContain('sample-image.png')

    // Quillのリコンサイル事故を模した「空」保存
    const wipe = await sendJson('PUT', `${server.api}/versions/${versionUid}`, { html: EMPTY_HTML })
    expect(wipe.status).toBe(200) // リクエスト自体は成功扱い
    // だが本文（画像）は残っている
    expect(await htmlOf(articleUid, versionUid)).toContain('sample-image.png')
  })

  it('中身のある本文どうしの更新は通常どおり反映される', async () => {
    const { articleUid, versionUid } = await newVersion()
    await sendJson('PUT', `${server.api}/versions/${versionUid}`, { html: IMG_HTML })

    const next = '<p>書き換えた本文</p>'
    await sendJson('PUT', `${server.api}/versions/${versionUid}`, { html: next })
    const html = await htmlOf(articleUid, versionUid)
    expect(html).toContain('書き換えた本文')
    expect(html).not.toContain('sample-image.png')
  })
})
