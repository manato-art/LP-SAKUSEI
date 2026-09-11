/**
 * 中間ページリンク（`/redirect_pages/:uid?sbrp=true&sbrpuid=:uid`）を開いたときの動きの機械証明（本人依頼・2026-09-11）。
 *
 * 採取した中間ページ設定の画面に書かれている動き:
 *   - リダイレクト先 … 中間ページリンクをクリックした後にリダイレクトさせたいURL（商品LP・クライアントLP など）
 *   - リダイレクト時間 … 0.1〜10秒（推奨: SmartNews・Gunosy は0.4秒、TikTok Ads は1秒）
 *   - リファラー設定 … Version なら /articles/ のような Version のURL、中間ページなら /redirect_pages/ のURLになる
 *   - タグ … 一括タグ設定のタグ ＋ 中間ページタグ設定（HEAD / BODY）
 * これまでは設定を保存できるだけで、リンクを開いても「この画面はまだ作っていません」と出ていた。
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { getJson, postJson, resetStore, sendJson, startTestServer, type TestServer } from './helpers/server.ts'
import { getState, setState } from '../mock-server/store/store.ts'
import { createBulkTag, updateBulkTag } from '../mock-server/store/bulk-tags.ts'

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

async function createRedirectPage(): Promise<{ abTestUid: string; uid: string }> {
  const created = await postJson<{ ab_test: { uid: string } }>(`${server.api}/ab_tests`, {
    title: '中間ページ確認',
    media_id: 1,
  })
  const abTestUid = created.json.ab_test.uid
  const added = await postJson<{ redirect_page: { uid: string } }>(
    `${server.api}/ab_tests/${abTestUid}/redirect_pages/create`,
  )
  return { abTestUid, uid: added.json.redirect_page.uid }
}

async function save(uid: string, body: Record<string, unknown>): Promise<{ status: number; json: unknown }> {
  return sendJson('PATCH', `${server.api}/redirect_pages/${uid}`, body)
}

/** 中間ページリンクを開く（リンクの形は採取した設定画面と同じ） */
async function open(uid: string): Promise<{ status: number; html: string }> {
  const res = await fetch(`${server.baseUrl}/redirect_pages/${uid}?sbrp=true&sbrpuid=${uid}`, { redirect: 'manual' })
  return { status: res.status, html: await res.text() }
}

describe('中間ページリンクを開くと、リダイレクト時間のあとにリダイレクト先へ移動する', () => {
  it('リダイレクト先へ、リダイレクト時間（秒）待ってから移動する', async () => {
    const { uid } = await createRedirectPage()
    expect((await save(uid, { url: 'https://example.com/product?a=1', redirect_time: 1 })).status).toBe(200)

    const { status, html } = await open(uid)
    expect(status).toBe(200)
    expect(html).toContain('location.replace("https://example.com/product?a=1")')
    expect(html).toContain('},1000)</script>')
    // JavaScript が動かない環境でも移動する
    expect(html).toContain('<meta http-equiv="refresh" content="1;url=https://example.com/product?a=1">')
  })

  it('リファラー設定「Version」なら、移動する直前にURLをVersionの配信URL（/lp/:uid）へ書き換える', async () => {
    const { abTestUid, uid } = await createRedirectPage()
    await save(uid, { url: 'https://example.com/', referrer_type: 'version' })
    const { html } = await open(uid)
    expect(html).toContain(`history.replaceState(null,'',"/lp/${abTestUid}")`)
    // 移動先にURLのパスまで渡す（ブラウザ既定だと別サイトにはドメインしか渡らず、設定の違いが伝わらない）
    expect(html).toContain('<meta name="referrer" content="no-referrer-when-downgrade">')
  })

  it('リファラー設定「中間ページ」なら、中間ページのURLのまま移動する', async () => {
    const { uid } = await createRedirectPage()
    await save(uid, { url: 'https://example.com/', referrer_type: 'redirect_page' })
    const { html } = await open(uid)
    expect(html).not.toContain('history.replaceState')
    expect(html).toContain('location.replace("https://example.com/")')
  })

  it('一括タグ設定の範囲に入るタグと、この中間ページのタグを入れ、読み込んでから移動する', async () => {
    const { abTestUid, uid } = await createRedirectPage()
    const teamId = getState().abTests.find((t) => t.uid === abTestUid)?.team_id ?? -1
    setState((state) => {
      const created = createBulkTag(state, teamId)
      return updateBulkTag(created.state, created.tag.uid, {
        team_wide: true,
        head_js: '<script>window.bulkHead=1</script>',
        body_js: '<script>window.bulkBody=1</script>',
      }).state
    })
    await save(uid, {
      url: 'https://example.com/',
      html_tags: [
        { tag: 'script', document_property: 'head', body: '<script>window.pageHead=1</script>' },
        { tag: 'script', document_property: 'body', body: '<script>window.pageBody=1</script>' },
      ],
    })

    const { html } = await open(uid)
    const head = html.slice(0, html.indexOf('</head>'))
    const body = html.slice(html.indexOf('<body'))
    expect(head).toContain('window.bulkHead=1')
    expect(head).toContain('window.pageHead=1')
    expect(body).toContain('window.bulkBody=1')
    expect(body).toContain('window.pageBody=1')
    expect(body.indexOf('window.pageBody=1')).toBeLessThan(body.indexOf('location.replace('))
  })

  it('中間ページタグだけを保存しても、リダイレクト先は消えない', async () => {
    const { abTestUid, uid } = await createRedirectPage()
    await save(uid, { url: 'https://example.com/keep' })
    await save(uid, { html_tags: [{ tag: 'script', document_property: 'head', body: '<script>window.x=1</script>' }] })

    const list = await getJson<{ redirect_pages: { uid: string; url: string; html_tags?: unknown[] }[] }>(
      `${server.api}/ab_tests/${abTestUid}/redirect_pages`,
    )
    const saved = list.redirect_pages.find((p) => p.uid === uid)
    expect(saved?.url).toBe('https://example.com/keep')
    expect(saved?.html_tags).toHaveLength(1)
    expect((await open(uid)).html).toContain('location.replace("https://example.com/keep")')
  })
})

describe('開けない・移動できないときは、移動せずに案内する', () => {
  it('存在しない中間ページは 404', async () => {
    const { status, html } = await open('REDIRECT_NOPE')
    expect(status).toBe(404)
    expect(html).toContain('この中間ページは見つかりません')
    expect(html).not.toContain('location.replace')
  })

  it('リダイレクト先が未設定なら 404 で、そう案内する', async () => {
    const { uid } = await createRedirectPage()
    const { status, html } = await open(uid)
    expect(status).toBe(404)
    expect(html).toContain('リダイレクト先が設定されていません')
    expect(html).not.toContain('location.replace')
  })
})

describe('中間ページ設定の保存で、危ない値や範囲外の値を受け付けない', () => {
  it.each(['javascript:alert(1)', 'ftp://example.com/', 'example.com/no-scheme'])(
    'リダイレクト先「%s」は保存できない（http:// か https:// だけ）',
    async (url) => {
      const { uid } = await createRedirectPage()
      expect((await save(uid, { url })).status).toBe(422)
    },
  )

  it.each([0, 0.05, 10.5])('リダイレクト時間 %s 秒は保存できない（0.1〜10秒）', async (seconds) => {
    const { uid } = await createRedirectPage()
    expect((await save(uid, { url: 'https://example.com/', redirect_time: seconds })).status).toBe(422)
  })

  it('閉じていないタグは保存できず、どちらの欄かを返す', async () => {
    const { uid } = await createRedirectPage()
    const res = await save(uid, {
      html_tags: [{ tag: 'script', document_property: 'body', body: '<script>window.x=1' }],
    })
    expect(res.status).toBe(422)
    expect(JSON.stringify(res.json)).toContain('invalid_script_body')
  })

  it('リダイレクト先のURLに書かれた文字で、ページにスクリプトを差し込めない', async () => {
    const { uid } = await createRedirectPage()
    expect((await save(uid, { url: 'https://example.com/?q=</script><script>alert(1)</script>' })).status).toBe(200)
    const { html } = await open(uid)
    expect(html).not.toContain('<script>alert(1)')
  })
})
