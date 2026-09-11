/**
 * 配信LPのリンクに、SquadBeyond 本体と同じパラメーターを付けることの機械証明（2026-09-11 本体の配信HTMLで確認）。
 *
 * 本体の配信LP（assignParameterToLink）がやっていること:
 *   - 本文の http リンク全部に、LP を開いたときのパラメーター（sbrd / sb_tu_id / step_uid を除く）を足す
 *   - squadbeyond_uid＝訪問者ID（Cookie _sb_tu）、sb_article_uid＝記事uid を付け直す（値が無ければ名前だけ）
 *   - 中間ページ（/redirect_pages/）へのリンクには article_url（LPのURL＋開いたときのパラメーター）を付け直す
 *   - リンクを押したとき、LPのURLに sb_article_uid と sb_tu_id を付けて書き換える
 */
import { runInNewContext } from 'node:vm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildLpLinkParamsScript } from '../mock-server/routes/lp-link-params-script.ts'
import { postJson, resetStore, startTestServer, type TestServer } from './helpers/server.ts'

interface OpenedLp {
  readonly links: { href: string }[]
  readonly clicks: (() => void)[]
  readonly seen: { replacedTo: string | null }
}

/** 配信LPのスクリプトを、ブラウザの代わりの最小の入れ物で動かす */
function openLp(pageUrl: string, hrefs: readonly string[], cookie: string): OpenedLp {
  const script = /^<script>([\s\S]*)<\/script>$/.exec(buildLpLinkParamsScript('ART1'))?.[1]
  if (script === undefined) throw new Error('スクリプトが読めない')
  const url = new URL(pageUrl)
  const clicks: (() => void)[] = []
  const links = hrefs.map((href) => ({
    href,
    addEventListener: (type: string, handler: () => void) => {
      if (type === 'click') clicks.push(handler)
    },
  }))
  const seen: { replacedTo: string | null } = { replacedTo: null }
  runInNewContext(script, {
    URL,
    URLSearchParams,
    location: { href: url.href, origin: url.origin, pathname: url.pathname, search: url.search },
    history: {
      replaceState: (_state: unknown, _title: unknown, next: string) => {
        seen.replacedTo = String(next)
      },
    },
    document: {
      cookie,
      body: {
        querySelectorAll: (selector: string) =>
          selector === 'a[href^="http"]' ? links.filter((l) => l.href.startsWith('http')) : [],
      },
    },
  })
  return { links, clicks, seen }
}

const LP = 'https://lp.example.test/lp/AB1?utm_source=news&sbrd=lp.example.test&step_uid=S1'

describe('配信LPのリンクに、本体と同じパラメーターを付ける', () => {
  it('ふつうのリンク: LPのパラメーター（sbrd / step_uid を除く）＋訪問者ID＋記事uid', () => {
    const lp = openLp(LP, ['https://shop.example.test/item?id=1'], 'other=1; _sb_tu=VISITOR1')
    expect(lp.links[0]?.href).toBe(
      'https://shop.example.test/item?id=1&utm_source=news&squadbeyond_uid=VISITOR1&sb_article_uid=ART1',
    )
  })

  it('もとから付いている squadbeyond_uid / sb_article_uid は付け直す（ほかのパラメーターと順番はそのまま）', () => {
    const lp = openLp(LP, ['https://shop.example.test/?squadbeyond_uid=old&sb_tracking=true&sb_article_uid=old#buy'], '_sb_tu=VISITOR1')
    expect(lp.links[0]?.href).toBe(
      'https://shop.example.test/?sb_tracking=true&utm_source=news&squadbeyond_uid=VISITOR1&sb_article_uid=ART1#buy',
    )
  })

  it('中間ページへのリンクには、さらに article_url（LPのURL）を付け直す', () => {
    const lp = openLp(LP, ['https://lp.example.test/redirect_pages/RP1?sbrp=true&sbrpuid=RP1&article_url=old'], '_sb_tu=VISITOR1')
    const url = new URL(lp.links[0]?.href ?? '')
    expect([...url.searchParams.keys()]).toEqual(['sbrp', 'sbrpuid', 'utm_source', 'squadbeyond_uid', 'sb_article_uid', 'article_url'])
    expect(url.searchParams.get('article_url')).toBe(LP)
  })

  it('訪問者IDの Cookie が無いときは、名前だけを付ける（本体と同じ）', () => {
    const lp = openLp('https://lp.example.test/lp/AB1', ['https://shop.example.test/'], '')
    expect(lp.links[0]?.href).toBe('https://shop.example.test/?squadbeyond_uid&sb_article_uid=ART1')
  })

  it('リンクを押すと、LPのURLに sb_article_uid と sb_tu_id を付けて書き換える', () => {
    const lp = openLp(LP, ['https://shop.example.test/'], '_sb_tu=VISITOR1')
    for (const click of lp.clicks) click()
    expect(lp.seen.replacedTo).toBe('https://lp.example.test/lp/AB1?utm_source=news&sb_article_uid=ART1&sb_tu_id=VISITOR1')
  })
})

describe('配信LPを開くと、本体と同じ Cookie を置き、リンクのスクリプトを入れる', () => {
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

  async function openDelivered(cookie?: string): Promise<{ html: string; cookies: Map<string, string>; articleUid: string }> {
    const created = await postJson<{ ab_test: { uid: string }; article: { uid: string }; version: { uid: string } }>(
      `${server.api}/ab_tests`,
      { title: 'リンク確認LP', media_id: 1 },
    )
    await fetch(`${server.api}/versions/${created.json.version.uid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: '<p><a href="https://shop.example.test/">商品を見る</a></p>' }),
    })
    const res = await fetch(`${server.baseUrl}/lp/${created.json.ab_test.uid}`, cookie === undefined ? {} : { headers: { cookie } })
    const cookies = new Map(res.headers.getSetCookie().map((c) => [c.slice(0, c.indexOf('=')), c]))
    return { html: await res.text(), cookies, articleUid: created.json.article.uid }
  }

  const valueOf = (setCookie: string | undefined): string => decodeURIComponent(/^[^=]+=([^;]*)/.exec(setCookie ?? '')?.[1] ?? '')
  const expiresInMs = (setCookie: string | undefined): number =>
    Date.parse(/Expires=([^;]+)/.exec(setCookie ?? '')?.[1] ?? '') - Date.now()

  it('_sb_tu は見るたびに新しいID（5分）、_sb_global は同じブラウザで同じID（20年）、_sb_a は記事uid（5分）', async () => {
    const first = await openDelivered()
    for (const name of ['_sb_tu', '_sb_global', '_sb_a']) {
      expect(first.cookies.get(name), name).toMatch(/SameSite=Lax/)
      expect(first.cookies.get(name), name).toMatch(/Path=\//)
      expect(first.cookies.get(name), name).not.toMatch(/HttpOnly/)
    }
    expect(valueOf(first.cookies.get('_sb_a'))).toBe(first.articleUid)
    for (const name of ['_sb_tu', '_sb_a']) {
      expect(expiresInMs(first.cookies.get(name))).toBeGreaterThan(4 * 60 * 1000)
      expect(expiresInMs(first.cookies.get(name))).toBeLessThan(6 * 60 * 1000)
    }
    expect(expiresInMs(first.cookies.get('_sb_global'))).toBeGreaterThan(19.9 * 365 * 24 * 60 * 60 * 1000)

    const tu = valueOf(first.cookies.get('_sb_tu'))
    const global = valueOf(first.cookies.get('_sb_global'))
    expect(tu).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    const second = await openDelivered(`_sb_tu=${tu}; _sb_global=${global}`)
    expect(valueOf(second.cookies.get('_sb_tu'))).not.toBe(tu)
    expect(valueOf(second.cookies.get('_sb_global'))).toBe(global)
  })

  it('本文のリンクにパラメーターを付けるスクリプト（記事uid入り）を入れる', async () => {
    const { html, articleUid } = await openDelivered()
    expect(html).toContain(buildLpLinkParamsScript(articleUid))
  })
})
