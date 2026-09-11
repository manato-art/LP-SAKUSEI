/**
 * 計測スクリプト・CVタグ・受け渡しタグが、訪問者の目印（squadbeyond_uid）を送る・保存することの機械証明（2026-09-11）。
 *
 * - 計測スクリプト（LP本体）: 表示のときは Cookie _sb_tu、計測リンクを押したときはリンクに付いた squadbeyond_uid を送る
 * - CVタグ（サンクスページ）: URL の squadbeyond_uid、無ければ受け渡しタグが保存した目印（1日以内）を送る。どちらも無ければ送らない
 * - 受け渡しタグ（広告主サイトの最初のページ）: URL の目印を保存するだけ
 * サーバーでの照らし合わせは tests/cv-attribution.test.ts が固定する。
 */
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { buildCvScriptBody, buildKeepUidScriptBody, buildTrackingScriptBody } from '../src/shared/tracking-tag.ts'

const DAY_MS = 24 * 60 * 60 * 1000
const STORAGE_KEY = 'sb_uid'

interface Beacon {
  url: string
  body: Record<string, unknown>
}

type Listener = (event: unknown) => void

/** スクリプトを動かす最小のブラウザもどき */
function fakeBrowser(options: { href: string; cookie?: string; storage?: Map<string, string>; amount?: number }) {
  const sent: Beacon[] = []
  const listeners = new Map<string, Listener[]>()
  const storage = options.storage ?? new Map<string, string>()
  const on = (type: string, fn: Listener): void => {
    listeners.set(type, [...(listeners.get(type) ?? []), fn])
  }
  class FakeBlob {
    constructor(readonly parts: string[]) {}
  }
  const url = new URL(options.href)
  const context: Record<string, unknown> = {
    location: { href: url.href, origin: url.origin, pathname: url.pathname, search: url.search },
    document: {
      cookie: options.cookie ?? '',
      hidden: false,
      documentElement: { scrollHeight: 2000 },
      addEventListener: on,
    },
    navigator: {
      sendBeacon: (to: string, blob: FakeBlob) => {
        sent.push({ url: to, body: JSON.parse(blob.parts[0] ?? '{}') as Record<string, unknown> })
        return true
      },
    },
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
    },
    Blob: FakeBlob,
    URL,
    URLSearchParams,
    addEventListener: on,
    innerHeight: 800,
    innerWidth: 400,
    scrollY: 0,
    setInterval: () => 1,
    clearInterval: () => undefined,
    fetch: () => undefined,
    __sbCvAmount: options.amount,
  }
  context['window'] = context
  return {
    sent,
    storage,
    run: (script: string) => runInNewContext(script, context),
    /** 計測リンクなどを押す */
    click: (href: string) => {
      const anchor = { getAttribute: (name: string) => (name === 'href' ? href : null) }
      for (const fn of listeners.get('click') ?? []) fn({ target: { closest: () => anchor }, clientX: 10, pageY: 10 })
    },
  }
}

describe('計測スクリプト（LP本体）', () => {
  const endpoint = 'https://lp.example.test/lp/AB1/__track'

  it('表示のとき、Cookie _sb_tu の目印を送る', () => {
    const browser = fakeBrowser({ href: 'https://lp.example.test/lp/AB1?utm_source=news', cookie: 'a=1; _sb_tu=VISITOR-1' })
    browser.run(buildTrackingScriptBody(endpoint, 'VERSION_0001'))
    expect(browser.sent[0]?.body).toEqual({
      version: 'VERSION_0001',
      event: 'pv',
      u: 'https://lp.example.test/lp/AB1',
      vid: 'VISITOR-1',
    })
  })

  it('計測リンクを押したとき、リンクに付いた squadbeyond_uid を目印として送る', () => {
    const browser = fakeBrowser({ href: 'https://lp.example.test/lp/AB1', cookie: '_sb_tu=VISITOR-1' })
    browser.run(buildTrackingScriptBody(endpoint, 'VERSION_0001'))
    browser.click('https://shop.example.test/item?sb_tracking=true&squadbeyond_uid=LINK-UID-1&sb_article_uid=ART1')
    expect(browser.sent[1]?.body).toEqual({ version: 'VERSION_0001', event: 'click', vid: 'LINK-UID-1' })
  })

  it('リンクに目印が無ければ、Cookie の目印を送る', () => {
    const browser = fakeBrowser({ href: 'https://lp.example.test/lp/AB1', cookie: '_sb_tu=VISITOR-2' })
    browser.run(buildTrackingScriptBody(endpoint))
    browser.click('https://shop.example.test/item?sb_tracking=true')
    expect(browser.sent[1]?.body).toEqual({ event: 'click', vid: 'VISITOR-2' })
  })
})

describe('CVタグ（サンクスページ）', () => {
  const endpoint = 'https://lp.example.test/lp/AB1/__track'

  it('サンクスページのURLの squadbeyond_uid を売上と一緒に送り、1日保存する', () => {
    const browser = fakeBrowser({ href: 'https://thanks.example.test/done?squadbeyond_uid=UID-A', amount: 1200 })
    browser.run(buildCvScriptBody(endpoint))
    expect(browser.sent).toEqual([{ url: endpoint, body: { event: 'cv', amount: 1200, vid: 'UID-A' } }])
    expect(JSON.parse(browser.storage.get(STORAGE_KEY) ?? '{}')).toMatchObject({ v: 'UID-A' })
  })

  it('URLに目印が無ければ、受け渡しタグが保存した目印（1日以内）を送る', () => {
    const storage = new Map([[STORAGE_KEY, JSON.stringify({ v: 'UID-B', t: Date.now() - 60_000 })]])
    const browser = fakeBrowser({ href: 'https://thanks.example.test/done', storage })
    browser.run(buildCvScriptBody(endpoint))
    expect(browser.sent.map((b) => b.body)).toEqual([{ event: 'cv', amount: 0, vid: 'UID-B' }])
  })

  it('保存した目印が1日より古いとき・目印がどこにも無いときは送らない', () => {
    const storage = new Map([[STORAGE_KEY, JSON.stringify({ v: 'UID-C', t: Date.now() - DAY_MS - 60_000 })]])
    const stale = fakeBrowser({ href: 'https://thanks.example.test/done', storage })
    stale.run(buildCvScriptBody(endpoint))
    const nothing = fakeBrowser({ href: 'https://thanks.example.test/done' })
    nothing.run(buildCvScriptBody(endpoint))
    expect(stale.sent).toEqual([])
    expect(nothing.sent).toEqual([])
  })
})

describe('受け渡しタグ（広告主サイトの最初のページ）', () => {
  it('URLの squadbeyond_uid を保存するだけで、CVは送らない', () => {
    const browser = fakeBrowser({ href: 'https://shop.example.test/item?sb_tracking=true&squadbeyond_uid=UID-D' })
    browser.run(buildKeepUidScriptBody())
    expect(browser.sent).toEqual([])
    expect(JSON.parse(browser.storage.get(STORAGE_KEY) ?? '{}')).toMatchObject({ v: 'UID-D' })
  })

  it('URLに目印が無ければ、保存済みの目印を消さない', () => {
    const storage = new Map([[STORAGE_KEY, JSON.stringify({ v: 'UID-E', t: Date.now() })]])
    const browser = fakeBrowser({ href: 'https://shop.example.test/cart', storage })
    browser.run(buildKeepUidScriptBody())
    expect(JSON.parse(browser.storage.get(STORAGE_KEY) ?? '{}')).toMatchObject({ v: 'UID-E' })
  })
})
