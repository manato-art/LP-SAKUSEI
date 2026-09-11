/**
 * 中間ページリンク（`/redirect_pages/:uid?sbrp=true&sbrpuid=:uid`）を開いたときの動きの機械証明（本人依頼・2026-09-11）。
 *
 * 採取した中間ページ設定の画面に書かれている動き:
 *   - リダイレクト先 … 中間ページリンクをクリックした後にリダイレクトさせたいURL（商品LP・クライアントLP など）
 *   - リダイレクト時間 … 0.1〜10秒（推奨: SmartNews・Gunosy は0.4秒、TikTok Ads は1秒）
 *   - リファラー設定 … Version なら /articles/ のような Version のURL、中間ページなら /redirect_pages/ のURLになる
 *   - タグ … 一括タグ設定のタグ ＋ 中間ページタグ設定（HEAD / BODY）
 * これまでは設定を保存できるだけで、リンクを開いても「この画面はまだ作っていません」と出ていた。
 *
 * 2026-09-11 に SquadBeyond 本体（本人がログインした画面）でテスト用の中間ページを作り、実際の応答と移動を確かめた:
 *   - 応答は 200 のHTML（サーバーでは飛ばさない）。ヘッダー Referrer-Policy: no-referrer-when-downgrade、robots は nofollow,noarchive
 *   - 本文に .js-redirect-url / .js-referrer-type の data-value、「自動でジャンプしない場合は…」と .js-redirect-url-link
 *   - リンクに付いたパラメーターは article_url / sbrp / sbrpuid を除いてリダイレクト先へ引き継ぐ（先にあるパラメーターの後ろに足す）
 *   - リファラー「Version」: article_url（同じドメインのLPのURL）へ URL を書き換えてから移動。article_url が無ければ書き換えない
 *   - リファラー「中間ページ」: 中間ページのURL（パラメーターを外す）へ書き換えてから移動
 *   - どちらも書き換えたURLに squadbeyond_uid / sb_article_uid を付ける（値が無いときは名前だけ）
 *   - 待ち時間はリダイレクト時間×1000ミリ秒
 */
import { runInNewContext } from 'node:vm'
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

/** 中間ページタグ設定: HEAD / BODY を押して1件足し、タグ名と JavaScript を入れる（本体と同じ操作） */
async function addTag(uid: string, property: 'head' | 'body', body: string, name = 'テスト'): Promise<number> {
  const created = await postJson<{ tag: { id: number } }>(`${server.api}/redirect_pages/${uid}/tags`, {
    document_property: property,
  })
  expect(created.status).toBe(201)
  expect((await sendJson('PATCH', `${server.api}/redirect_pages/${uid}/tags/${created.json.tag.id}`, { name, body })).status).toBe(200)
  return created.json.tag.id
}

/** 中間ページリンクを開く（リンクの形は採取した設定画面と同じ） */
async function open(uid: string): Promise<{ status: number; html: string }> {
  const res = await fetch(`${server.baseUrl}/redirect_pages/${uid}?sbrp=true&sbrpuid=${uid}`, { redirect: 'manual' })
  return { status: res.status, html: await res.text() }
}


function decodeHtml(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

interface Moved {
  /** location.replace で移動した先 */
  readonly to: string | null
  /** 移動の前に書き換えたURL（移動先に「どこから来たか」として渡るURL）。書き換えなければ null */
  readonly rewrittenTo: string | null
  /** 「自動でジャンプしない場合は」のリンク先 */
  readonly linkHref: string | null
  readonly waitMs: number | null
}

/** 応答HTMLの移動スクリプトを、ブラウザの代わりの最小の入れ物で動かす（pageUrl で開いたとして） */
function runRedirect(html: string, pageUrl: string): Moved {
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1] ?? '')
    .find((body) => body.includes('js-redirect-url'))
  if (script === undefined) throw new Error('移動スクリプトが見つからない')
  const dataValue = (className: string): string =>
    decodeHtml(new RegExp(`<div class="${className}" data-value="([^"]*)"`).exec(html)?.[1] ?? '')
  const url = new URL(pageUrl)
  const link = { href: '' }
  const seen: { to: string | null; rewrittenTo: string | null; timer: { run: () => void; ms: number } | null } = {
    to: null,
    rewrittenTo: null,
    timer: null,
  }
  runInNewContext(script, {
    URL,
    URLSearchParams,
    location: {
      href: url.href,
      search: url.search,
      pathname: url.pathname,
      origin: url.origin,
      replace: (to: string) => {
        seen.to = to
      },
    },
    document: {
      querySelector: (selector: string) =>
        selector === '.js-redirect-url' || selector === '.js-referrer-type'
          ? { dataset: { value: dataValue(selector.slice(1)) } }
          : null,
      querySelectorAll: (selector: string) => (selector === '.js-redirect-url-link' ? [link] : []),
    },
    history: {
      replaceState: (_state: unknown, _title: unknown, next: string) => {
        seen.rewrittenTo = String(next)
      },
    },
    setTimeout: (run: () => void, ms: number) => {
      seen.timer = { run, ms }
    },
  })
  seen.timer?.run()
  return { to: seen.to, rewrittenTo: seen.rewrittenTo, linkHref: link.href === '' ? null : link.href, waitMs: seen.timer?.ms ?? null }
}

describe('応答は SquadBeyond 本体の中間ページと同じ形', () => {
  it('200 のHTMLで、リダイレクト先・リファラー設定・待ち時間・案内文を持つ', async () => {
    const { uid } = await createRedirectPage()
    expect((await save(uid, { url: 'https://example.com/product?a=1', redirect_time: 1, referrer_type: 'redirect_page' })).status).toBe(200)

    const res = await fetch(`${server.baseUrl}/redirect_pages/${uid}?sbrp=true&sbrpuid=${uid}`)
    const html = await res.text()
    expect(res.status).toBe(200)
    expect(res.headers.get('referrer-policy')).toBe('no-referrer-when-downgrade')
    expect(html).toContain('<meta content="nofollow,noarchive" name="robots" />')
    expect(html).toContain('<div class="js-redirect-url" data-value="https://example.com/product?a=1"></div>')
    expect(html).toContain('<div class="js-referrer-type" data-value="redirect_page"></div>')
    expect(html).toContain('<div>自動でジャンプしない場合は、下記のＵＲＬをクリックしてください。</div>')
    expect(html).toContain('<a class="js-redirect-url-link">URL</a>')
    expect(runRedirect(html, `https://lp.example.test/redirect_pages/${uid}?sbrp=true&sbrpuid=${uid}`).waitMs).toBe(1000)
  })

  it('一括タグ設定の範囲に入るタグと、この中間ページのタグを入れる（HEAD は head の中、BODY は案内文より前）', async () => {
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
    await save(uid, { url: 'https://example.com/' })
    await addTag(uid, 'head', '<script>window.pageHead=1</script>')
    await addTag(uid, 'body', '<script>window.pageBody=1</script>')

    const { html } = await open(uid)
    const head = html.slice(0, html.indexOf('</head>'))
    const body = html.slice(html.indexOf('<body'))
    expect(head).toContain('window.bulkHead=1')
    expect(head).toContain('window.pageHead=1')
    const guide = body.indexOf('自動でジャンプしない場合は')
    expect(body.indexOf('window.bulkBody=1')).toBeLessThan(guide)
    expect(body.indexOf('window.pageBody=1')).toBeLessThan(guide)
    expect(body.indexOf('js-referrer-type')).toBeLessThan(body.indexOf('window.pageBody=1'))
  })

  it('中間ページタグ設定は、名前付きのタグを何件でも足せて、1件ずつ直したり消したりできる（本体と同じ）', async () => {
    const { abTestUid, uid } = await createRedirectPage()
    await save(uid, { url: 'https://example.com/keep' })
    const first = await addTag(uid, 'head', '<script>window.first=1</script>', '計測タグA')
    const second = await addTag(uid, 'head', '<script>window.second=1</script>', '計測タグB')
    expect((await sendJson('DELETE', `${server.api}/redirect_pages/${uid}/tags/${first}`)).status).toBe(204)

    const list = await getJson<{ redirect_pages: { uid: string; url: string; tags?: unknown[] }[] }>(
      `${server.api}/ab_tests/${abTestUid}/redirect_pages`,
    )
    const saved = list.redirect_pages.find((p) => p.uid === uid)
    expect(saved?.url).toBe('https://example.com/keep')
    expect(saved?.tags).toEqual([
      { id: second, name: '計測タグB', document_property: 'head', body: '<script>window.second=1</script>' },
    ])
    const html = (await open(uid)).html
    expect(html).toContain('window.second=1')
    expect(html).not.toContain('window.first=1')
  })

  it('以前の形（名前なしの2欄）で保存したタグも入り、一覧を開くと名前付きのタグに置き換わる', async () => {
    const { abTestUid, uid } = await createRedirectPage()
    await save(uid, { url: 'https://example.com/' })
    setState((state) => ({
      ...state,
      redirectPages: state.redirectPages.map((p) =>
        p.uid === uid
          ? { ...p, html_tags: [{ tag: 'script', document_property: 'body' as const, body: '<script>window.legacy=1</script>' }] }
          : p,
      ),
    }))
    expect((await open(uid)).html).toContain('window.legacy=1')

    const list = await getJson<{ redirect_pages: { uid: string; tags?: unknown[] }[] }>(
      `${server.api}/ab_tests/${abTestUid}/redirect_pages`,
    )
    expect(list.redirect_pages.find((p) => p.uid === uid)?.tags).toEqual([
      { id: expect.any(Number), name: '', document_property: 'body', body: '<script>window.legacy=1</script>' },
    ])
    expect((await open(uid)).html).toContain('window.legacy=1')
  })
})

describe('移動の動き（SquadBeyond 本体で確かめたとおり）', () => {
  const LP = 'https://lp.example.test'

  it('付いているパラメーターは、article_url・sbrp・sbrpuid を除いてリダイレクト先へ引き継ぐ', async () => {
    const { uid } = await createRedirectPage()
    await save(uid, { url: 'https://example.com/', referrer_type: 'version' })
    const moved = runRedirect((await open(uid)).html, `${LP}/redirect_pages/${uid}?sbrp=true&sbrpuid=${uid}&cc_check=1`)
    expect(moved.to).toBe('https://example.com/?cc_check=1')
    expect(moved.linkHref).toBe('https://example.com/?cc_check=1')
    // リファラー「Version」でも article_url が無ければURLは書き換えない（本体では中間ページのURLがそのまま渡った）
    expect(moved.rewrittenTo).toBeNull()
  })

  it('リダイレクト先に元からあるパラメーターの後ろに足す', async () => {
    const { uid } = await createRedirectPage()
    await save(uid, { url: 'https://example.com/?dest=1', referrer_type: 'redirect_page' })
    const page = `${LP}/redirect_pages/${uid}?sbrp=true&sbrpuid=${uid}&article_url=${encodeURIComponent(`${LP}/articles/test-lp`)}&squadbeyond_uid=test-visitor&sb_article_uid=test-article&cc_check=1`
    expect(runRedirect((await open(uid)).html, page).to).toBe(
      'https://example.com/?dest=1&squadbeyond_uid=test-visitor&sb_article_uid=test-article&cc_check=1',
    )
  })

  it('リファラー「中間ページ」は、中間ページのURL（パラメーターを外して計測用の2つだけ）へ書き換えてから移動する', async () => {
    const { uid } = await createRedirectPage()
    await save(uid, { url: 'https://example.com/', referrer_type: 'redirect_page' })
    const html = (await open(uid)).html
    const withIds = runRedirect(html, `${LP}/redirect_pages/${uid}?sbrp=true&sbrpuid=${uid}&squadbeyond_uid=test-visitor&sb_article_uid=test-article`)
    expect(withIds.rewrittenTo).toBe(`${LP}/redirect_pages/${uid}?squadbeyond_uid=test-visitor&sb_article_uid=test-article`)
    // 値が無いときは名前だけが付く（本体と同じ）
    const withoutIds = runRedirect(html, `${LP}/redirect_pages/${uid}?sbrp=true&sbrpuid=${uid}&cc_check=1`)
    expect(withoutIds.rewrittenTo).toBe(`${LP}/redirect_pages/${uid}?squadbeyond_uid&sb_article_uid`)
  })

  it('リファラー「Version」は、article_url（LPのURL）へ書き換えてから移動する。別ドメインのURLには書き換えない', async () => {
    const { uid } = await createRedirectPage()
    await save(uid, { url: 'https://example.com/', referrer_type: 'version' })
    const html = (await open(uid)).html
    const sameSite = runRedirect(
      html,
      `${LP}/redirect_pages/${uid}?sbrp=true&sbrpuid=${uid}&article_url=${encodeURIComponent(`${LP}/articles/test-lp`)}&squadbeyond_uid=test-visitor&sb_article_uid=test-article`,
    )
    expect(sameSite.rewrittenTo).toBe(`${LP}/articles/test-lp?squadbeyond_uid=test-visitor&sb_article_uid=test-article`)
    expect(sameSite.to).toBe('https://example.com/?squadbeyond_uid=test-visitor&sb_article_uid=test-article')
    const otherSite = runRedirect(
      html,
      `${LP}/redirect_pages/${uid}?sbrp=true&sbrpuid=${uid}&article_url=${encodeURIComponent('https://other.example.test/articles/x')}`,
    )
    expect(otherSite.rewrittenTo).toBeNull()
    expect(otherSite.to).toBe('https://example.com/')
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

  it('閉じていないタグは保存できず、どちらの欄のタグかを返す', async () => {
    const { uid } = await createRedirectPage()
    const created = await postJson<{ tag: { id: number } }>(`${server.api}/redirect_pages/${uid}/tags`, {
      document_property: 'body',
    })
    const res = await sendJson('PATCH', `${server.api}/redirect_pages/${uid}/tags/${created.json.tag.id}`, {
      body: '<script>window.x=1',
    })
    expect(res.status).toBe(422)
    expect(JSON.stringify(res.json)).toContain('invalid_script_body')
  })

  it('タグは HEAD か BODY にしか足せず、無い中間ページ・無いタグは 404', async () => {
    const { uid } = await createRedirectPage()
    expect((await postJson(`${server.api}/redirect_pages/${uid}/tags`, { document_property: 'footer' })).status).toBe(422)
    expect((await postJson(`${server.api}/redirect_pages/REDIRECT_NOPE/tags`, { document_property: 'head' })).status).toBe(404)
    expect((await sendJson('PATCH', `${server.api}/redirect_pages/${uid}/tags/999999`, { body: '' })).status).toBe(404)
    expect((await sendJson('DELETE', `${server.api}/redirect_pages/${uid}/tags/999999`)).status).toBe(404)
  })

  it('リダイレクト先のURLに書かれた文字で、ページにスクリプトを差し込めない', async () => {
    const { uid } = await createRedirectPage()
    expect((await save(uid, { url: 'https://example.com/?q=</script><script>alert(1)</script>' })).status).toBe(200)
    const { html } = await open(uid)
    expect(html).not.toContain('<script>alert(1)')
  })
})
