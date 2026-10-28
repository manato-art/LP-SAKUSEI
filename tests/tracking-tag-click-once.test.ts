/**
 * 計測リンクのクリックは、1回の表示につき1回まで数える（2026-10-28）。
 *
 * 本人「3人がクリックして、8人が購入するってことになってる」＝ページ一覧で PV 3・Click 8・CTR 266.67%。
 * 計測タグが、計測リンクを押すたびに毎回 click を送っていた（同じ人が同じ表示で何度も押すと、その数だけ増える）。
 * CTR（Click÷PV）は「見た人のうち押した割合」なので、1回の表示で何度押しても1回にする＝Click は PV を超えない。
 */
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { buildTrackingScriptBody } from '../src/shared/tracking-tag.ts'

const ENDPOINT = 'https://lp.example.test/lp/AB1/__track'

/** タグを1回動かす（＝1回の表示）。返す click(href) で、そのリンクを押したことにする */
function load(): { sent: Record<string, unknown>[]; click: (href: string) => void } {
  const sent: Record<string, unknown>[] = []
  const clickListeners: ((e: unknown) => void)[] = []
  class FakeBlob {
    constructor(readonly parts: string[]) {}
  }
  const url = new URL('https://lp.example.test/lp/AB1')
  const context: Record<string, unknown> = {
    location: { href: url.href, origin: url.origin, pathname: url.pathname, search: url.search },
    document: {
      cookie: '_sb_tu=VISITOR-1',
      hidden: false,
      documentElement: { scrollHeight: 2000 },
      querySelectorAll: () => [],
      addEventListener: (type: string, fn: (e: unknown) => void) => {
        if (type === 'click') clickListeners.push(fn)
      },
    },
    navigator: {
      sendBeacon: (_to: string, blob: FakeBlob) => {
        sent.push(JSON.parse(blob.parts[0] ?? '{}') as Record<string, unknown>)
        return true
      },
    },
    localStorage: { getItem: () => null, setItem: () => undefined },
    Blob: FakeBlob,
    URL,
    URLSearchParams,
    addEventListener: () => undefined,
    innerHeight: 800,
    innerWidth: 400,
    scrollY: 0,
    setInterval: () => 1,
    clearInterval: () => undefined,
    fetch: () => undefined,
  }
  context['window'] = context
  runInNewContext(buildTrackingScriptBody(ENDPOINT, 'V1'), context)
  const click = (href: string): void => {
    const anchor = { getAttribute: (name: string) => (name === 'href' ? href : null) }
    const event = { target: { closest: () => anchor }, clientX: 10, pageY: 10 }
    for (const fn of clickListeners) fn(event)
  }
  return { sent, click }
}

const clicks = (sent: Record<string, unknown>[]): Record<string, unknown>[] => sent.filter((s) => s['event'] === 'click')
const TRACKED = 'https://shop.example.test/cart?sb_tracking=true'

describe('計測リンクのクリックは1回の表示につき1回まで', () => {
  it('同じ表示で計測リンクを何度押しても、click は1回だけ送る', () => {
    const page = load()
    page.click(TRACKED)
    page.click(TRACKED)
    page.click('https://shop.example.test/other?sb_tracking=true')
    expect(clicks(page.sent)).toHaveLength(1)
    expect(page.sent.filter((s) => s['event'] === 'pv')).toHaveLength(1)
  })

  it('計測のないリンクを先に押しても、あとの計測リンクは数える', () => {
    const page = load()
    page.click('https://example.test/about')
    page.click(TRACKED)
    expect(clicks(page.sent)).toHaveLength(1)
  })

  it('表示し直せば（新しい PV）、また1回数える', () => {
    const first = load()
    first.click(TRACKED)
    const second = load()
    second.click(TRACKED)
    expect(clicks(first.sent)).toHaveLength(1)
    expect(clicks(second.sent)).toHaveLength(1)
  })
})

describe('ページ一覧の合計の段', () => {
  it('数字を2行に折り返さない（「266.67」と「%」が分かれていた）', async () => {
    const { parseHTML } = await import('linkedom')
    const { document } = parseHTML('<!doctype html><html><head></head><body></body></html>')
    ;(globalThis as unknown as Record<string, unknown>)['document'] = document
    const { ensurePageListStyle } = await import('../src/app/pages/folders-redesign-style.ts')
    ensurePageListStyle()
    const css = document.getElementById('page-list-v2-style')?.textContent ?? ''
    expect(/\.en4zj401\{[^}]*white-space:nowrap/.test(css)).toBe(true)
  })
})
