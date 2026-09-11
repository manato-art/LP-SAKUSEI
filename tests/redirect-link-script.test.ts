/**
 * 配信LPの中間ページリンクに、SquadBeyond 本体と同じパラメーターを付けることの機械証明（2026-09-11 本体で確認）。
 *
 * 本体の配信LP（assignParameterToLink）は、本文の http リンクに LP を開いたときのパラメーター
 * （sbrd / sb_tu_id / step_uid を除く）を足し、中間ページへのリンク（/redirect_pages/）には article_url
 * （LPのURL＋開いたときのパラメーター）を付け直す。中間ページはこの article_url を、リファラー設定「Version」の
 * 書き換え先に使う。
 */
import { runInNewContext } from 'node:vm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { REDIRECT_LINK_SCRIPT } from '../mock-server/routes/redirect-link-script.ts'
import { postJson, resetStore, startTestServer, type TestServer } from './helpers/server.ts'

/** 配信LPのスクリプトを、ブラウザの代わりの最小の入れ物で動かす（pageUrl で開いたとして） */
function run(pageUrl: string, hrefs: readonly string[]): string[] {
  const script = /^<script>([\s\S]*)<\/script>$/.exec(REDIRECT_LINK_SCRIPT)?.[1]
  if (script === undefined) throw new Error('スクリプトが読めない')
  const url = new URL(pageUrl)
  const links = hrefs.map((href) => ({ href }))
  runInNewContext(script, {
    URL,
    URLSearchParams,
    location: { href: url.href, origin: url.origin, pathname: url.pathname, search: url.search },
    document: {
      querySelectorAll: (selector: string) =>
        selector === 'a[href*="/redirect_pages/"]' ? links.filter((l) => l.href.includes('/redirect_pages/')) : [],
    },
  })
  return links.map((l) => l.href)
}

describe('配信LPの中間ページリンクに、本体と同じパラメーターを付ける', () => {
  it('LPを開いたときのパラメーター（sbrd などを除く）と、article_url（LPのURL）を付ける', () => {
    const [href] = run('https://lp.example.test/lp/AB1?utm_source=news&sbrd=lp.example.test', [
      'https://lp.example.test/redirect_pages/RP1?sbrp=true&sbrpuid=RP1',
    ])
    const url = new URL(href ?? '')
    expect([...url.searchParams.keys()]).toEqual(['sbrp', 'sbrpuid', 'utm_source', 'article_url'])
    expect(url.searchParams.get('utm_source')).toBe('news')
    expect(url.searchParams.get('article_url')).toBe('https://lp.example.test/lp/AB1?utm_source=news&sbrd=lp.example.test')
  })

  it('すでに article_url が付いていたら、今のLPのURLに付け直す', () => {
    const [href] = run('https://lp.example.test/lp/AB1', [
      'https://lp.example.test/redirect_pages/RP1?sbrp=true&article_url=https%3A%2F%2Fold.example.test%2F',
    ])
    const url = new URL(href ?? '')
    expect(url.searchParams.getAll('article_url')).toEqual(['https://lp.example.test/lp/AB1'])
  })

  it('中間ページ以外のリンクには触らない', () => {
    expect(run('https://lp.example.test/lp/AB1?utm_source=news', ['https://shop.example.test/item?id=1'])).toEqual([
      'https://shop.example.test/item?id=1',
    ])
  })
})

describe('中間ページへのリンクがあるLPだけに入れる', () => {
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

  async function lpWith(html: string): Promise<string> {
    const created = await postJson<{ ab_test: { uid: string }; version: { uid: string } }>(`${server.api}/ab_tests`, {
      title: '中間ページリンク入りLP',
      media_id: 1,
    })
    await fetch(`${server.api}/versions/${created.json.version.uid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html }),
    })
    return (await fetch(`${server.baseUrl}/lp/${created.json.ab_test.uid}`)).text()
  }

  it('本文に中間ページへのリンクがあると入る', async () => {
    const html = await lpWith('<p><a href="https://lp.example.test/redirect_pages/RP1?sbrp=true&amp;sbrpuid=RP1">商品を見る</a></p>')
    expect(html).toContain(REDIRECT_LINK_SCRIPT)
  })

  it('無いLPには入れない', async () => {
    expect(await lpWith('<p><a href="https://shop.example.test/">商品を見る</a></p>')).not.toContain(REDIRECT_LINK_SCRIPT)
  })
})
