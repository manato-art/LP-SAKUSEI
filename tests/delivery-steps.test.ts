/**
 * ステップ配信（2026-09-15）。
 *
 * 採取物の「Versionリンク」は `https://…/ab/<pageUid>?step_uid=<stepUid>` の形。
 * つまりステップは**URLのパラメータで指す**。
 * クローンは常に先頭のステップを出していたので、2つ目以降には誰も来られなかった。
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { getJson, postJson, resetStore, startTestServer, type TestServer } from './helpers/server.ts'

let server: TestServer

beforeEach(async () => {
  if (server === undefined) server = await startTestServer()
  resetStore()
})

afterAll(() => server?.close())

/** 2ステップのページを作る。戻り値はページuidと各ステップのuid */
async function setup(): Promise<{ uid: string; first: string; second: string }> {
  const created = await postJson<{ ab_test: { uid: string } }>(`${server.api}/ab_tests`, {
    title: 'ステップ配信の確認用',
    media_id: 1,
  })
  const uid = created.json.ab_test.uid
  const before = await getJson<{ articles: { uid: string }[] }>(`${server.api}/ab_tests/${uid}/articles`)
  const first = before.articles[0]?.uid ?? ''
  const added = await postJson<{ article: { uid: string } }>(`${server.api}/ab_tests/${uid}/articles`, {
    name: '申込ページ',
  })
  return { uid, first, second: added.json.article.uid }
}

async function fetchLp(path: string): Promise<{ status: number; html: string }> {
  const res = await fetch(`${server.baseUrl}${path}`)
  return { status: res.status, html: await res.text() }
}

describe('ステップ配信', () => {
  it('指定が無ければ先頭のステップを出す（今までどおり）', async () => {
    const { uid } = await setup()
    const out = await fetchLp(`/lp/${uid}`)
    expect(out.status).toBe(200)
  })

  it('step_uid を付けるとそのステップを出す', async () => {
    const { uid, second } = await setup()
    const out = await fetchLp(`/lp/${uid}?step_uid=${second}`)
    expect(out.status).toBe(200)
    // そのステップのVersionが配信される＝計測タグにそのVersionが入る
    const versions = await getJson<{ versions: { uid: string }[] }>(`${server.api}/articles/${second}/versions`)
    const versionUid = versions.versions[0]?.uid ?? ''
    expect(versionUid).not.toBe('')
    expect(out.html).toContain(versionUid)
  })

  it('別ページのステップを指しても出さない（他人のステップを覗けない）', async () => {
    const a = await setup()
    const b = await setup()
    const out = await fetchLp(`/lp/${a.uid}?step_uid=${b.second}`)
    // 知らないステップは先頭にフォールバックせず、そのページの先頭を出す
    const firstVersions = await getJson<{ versions: { uid: string }[] }>(
      `${server.api}/articles/${a.first}/versions`,
    )
    expect(out.html).toContain(firstVersions.versions[0]?.uid ?? 'MISSING')
  })

  it('知らない step_uid は先頭のステップを出す（行き止まりにしない）', async () => {
    const { uid, first } = await setup()
    const out = await fetchLp(`/lp/${uid}?step_uid=NOT_EXIST`)
    expect(out.status).toBe(200)
    const firstVersions = await getJson<{ versions: { uid: string }[] }>(
      `${server.api}/articles/${first}/versions`,
    )
    expect(out.html).toContain(firstVersions.versions[0]?.uid ?? 'MISSING')
  })
})
