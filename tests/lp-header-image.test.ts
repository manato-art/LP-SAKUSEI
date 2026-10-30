/**
 * 公開LP（/lp）にもヘッダー画像を出すことの機械証明（2026-09-11・本人承認）。
 *
 * エディタはヘッダー画像を、本文の先頭に `<!--header-image:画像のURL-->` として保存する。
 * プレビュー（/preview）はこれを画像にして出していたが、公開LPはコメントのまま送っていたので、
 * 公開LPを見た人にはヘッダー画像が表示されていなかった。
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { postJson, resetStore, sendJson, startTestServer, type TestServer, issueCreatedPage } from './helpers/server.ts'
import { getState } from '../mock-server/store/store.ts'

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

const HEADER_IMG = /<img [^>]*alt="ヘッダー画像">/

/** beyondページを作り、その Version の本文を html にする */
async function pageWithHtml(html: string): Promise<{ abTestUid: string; versionUid: string }> {
  const created = await postJson<{ ab_test: { uid: string } }>(`${server.api}/ab_tests`, { title: 'ヘッダー画像', media_id: 1 })
  await issueCreatedPage(server.api, created.json)
  const version = getState().versions.at(-1)
  if (version === undefined) throw new Error('Versionを作れませんでした')
  expect((await sendJson('PUT', `${server.api}/versions/${version.uid}`, { html })).status).toBe(200)
  return { abTestUid: created.json.ab_test.uid, versionUid: version.uid }
}

async function textOf(url: string): Promise<string> {
  return (await fetch(url)).text()
}

describe('公開LPのヘッダー画像', () => {
  it('本文の先頭のヘッダー画像を、本文の上に画像として出す（コメントのまま送らない）', async () => {
    const page = await pageWithHtml('<!--header-image:https://example.com/header.png--><p>本文</p>')
    const lp = await textOf(`${server.baseUrl}/lp/${page.abTestUid}`)
    expect(lp).not.toContain('<!--header-image:')
    expect(lp).toMatch(/<body><img src="https:\/\/example\.com\/header\.png" [^>]*alt="ヘッダー画像"><p>本文<\/p>/)
  })

  it('プレビューと同じタグ（同じ見た目）で出す', async () => {
    const page = await pageWithHtml('<!--header-image:https://example.com/header.png--><p>本文</p>')
    const lpHeader = (await textOf(`${server.baseUrl}/lp/${page.abTestUid}`)).match(HEADER_IMG)?.[0]
    const previewHeader = (await textOf(`${server.baseUrl}/preview/${page.versionUid}`)).match(HEADER_IMG)?.[0]
    expect(lpHeader).toBeDefined()
    expect(lpHeader).toBe(previewHeader)
  })

  it('ヘッダー画像が無いLPは、今までどおり何も足さない', async () => {
    const page = await pageWithHtml('<p>本文だけ</p>')
    const lp = await textOf(`${server.baseUrl}/lp/${page.abTestUid}`)
    expect(lp).not.toMatch(HEADER_IMG)
    expect(lp).toContain('<body><p>本文だけ</p>')
  })

  it('ヘッダーに動画を置いたら、公開LPとプレビューで動画（自動で再生・音なし・くり返し）を出す（2026-10-27）', async () => {
    const page = await pageWithHtml('<!--header-image:https://example.com/header.mp4--><p>本文</p>')
    const lp = await textOf(`${server.baseUrl}/lp/${page.abTestUid}`)
    expect(lp).toMatch(/<body><video src="https:\/\/example\.com\/header\.mp4" [^>]*autoplay muted loop playsinline aria-label="ヘッダー動画"><\/video><p>本文<\/p>/)
    const preview = await textOf(`${server.baseUrl}/preview/${page.versionUid}`)
    expect(preview).toContain('<video src="https://example.com/header.mp4"')
  })

  it('記事設定の背景が動画なら、公開LPとプレビューの本文の先頭に動画の層を入れる（2026-10-27）', async () => {
    const page = await pageWithHtml('<p>本文</p>')
    const article = getState().articles.at(-1)
    if (article === undefined) throw new Error('記事がありません')
    const saved = await sendJson('PUT', `${server.api}/articles/${article.uid}/master_style_sheet`, {
      outer_background_image: 'https://example.com/outer.mp4',
      inner_background_image: 'https://example.com/inner.webm',
    })
    expect(saved.status).toBe(200)
    const lp = await textOf(`${server.baseUrl}/lp/${page.abTestUid}`)
    expect(lp).toContain(
      '<body><video class="lp-bg lp-bg--outer" src="https://example.com/outer.mp4" autoplay muted loop playsinline preload="auto" aria-hidden="true"></video>' +
        '<video class="lp-bg lp-bg--inner" src="https://example.com/inner.webm" autoplay muted loop playsinline preload="auto" aria-hidden="true"></video><p>本文</p>',
    )
    expect(lp).not.toContain('url("https://example.com/outer.mp4")')
    const preview = await textOf(`${server.baseUrl}/preview/${page.versionUid}`)
    expect(preview).toContain('<video class="lp-bg lp-bg--outer"')
  })

  it('画像のURLに記号が入っていても、タグを壊さない（HTMLとして解釈させない）', async () => {
    const page = await pageWithHtml('<!--header-image:https://example.com/a.png?x="><b>ng</b>--><p>本文</p>')
    const lp = await textOf(`${server.baseUrl}/lp/${page.abTestUid}`)
    expect(lp).not.toContain('"><b>ng</b>')
    expect(lp).toContain('&quot;&gt;&lt;b&gt;ng&lt;/b&gt;')
  })
})
