/**
 * クリックの横位置は「ページの真ん中から何pxか」も送る（2026-09-25・数値面分析テスト）。
 *
 * LPは真ん中寄せ（最大620px）なので、横に広いPCで押された位置を「画面の幅に対する割合」だけで持つと、
 * ヒートマップの枠（PCは980px）に置いたとき、LPの中の押した場所から横にずれる（1440pxの画面の40%と980pxの40%は別の場所）。
 * 真ん中からの距離なら、画面の幅が違っても、真ん中寄せのLPの同じ場所を指す。
 */
import { runInNewContext } from 'node:vm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'
import { buildTrackingScriptBody } from '../src/shared/tracking-tag.ts'
import { paintLpLayer } from '../src/app/pages/heatmap-lp-layer.ts'
import { installDom } from './helpers/dom.ts'
import { getJson, postJson, resetStore, startTestServer, type TestServer } from './helpers/server.ts'

type Listener = (event: unknown) => void

function clickAt(clientX: number, innerWidth: number): { x: number; y: number; cx?: number } | undefined {
  const sent: Record<string, unknown>[] = []
  const listeners = new Map<string, Listener[]>()
  const on = (type: string, fn: Listener): void => {
    listeners.set(type, [...(listeners.get(type) ?? []), fn])
  }
  class FakeBlob {
    constructor(readonly parts: string[]) {}
  }
  const url = new URL('https://lp.example.test/lp/AB1')
  const context: Record<string, unknown> = {
    location: { href: url.href, origin: url.origin, pathname: url.pathname, search: url.search },
    document: {
      cookie: '',
      hidden: false,
      documentElement: { scrollHeight: 2000 },
      querySelectorAll: () => [],
      addEventListener: on,
    },
    navigator: {
      sendBeacon: (_to: string, blob: FakeBlob) => {
        sent.push(JSON.parse(blob.parts[0] ?? '{}') as Record<string, unknown>)
        return true
      },
    },
    Blob: FakeBlob,
    URL,
    URLSearchParams,
    addEventListener: on,
    innerHeight: 800,
    innerWidth,
    scrollY: 0,
    setInterval: () => 1,
    clearInterval: () => undefined,
    fetch: () => undefined,
  }
  context['window'] = context
  runInNewContext(buildTrackingScriptBody('https://lp.example.test/lp/AB1/__track', 'V1'), context)
  for (const fn of listeners.get('click') ?? []) fn({ target: null, clientX, pageY: 1000 })
  for (const fn of listeners.get('pagehide') ?? []) fn({})
  const heatmap = sent.find((b) => b['event'] === 'heatmap')
  return (heatmap?.['clicks'] as { x: number; y: number; cx?: number }[] | undefined)?.[0]
}

describe('計測タグ', () => {
  it('1440pxの画面で左から700pxを押したら、真ん中から -20px', () => {
    expect(clickAt(700, 1440)).toEqual({ x: 0.486, y: 0.5, cx: -20 })
  })
})

describe('サーバー', () => {
  let server: TestServer
  beforeAll(async () => {
    server = await startTestServer()
  })
  beforeEach(() => resetStore())
  afterAll(() => server?.close())

  it('送られてきた cx を残す（古いタグの送信には無い）', async () => {
    const created = await postJson<{ ab_test: { uid: string } }>(`${server.api}/ab_tests`, { title: 'cx', media_id: 1 })
    const uid = created.json.ab_test.uid
    for (const clicks of [[{ x: 0.486, y: 0.5, cx: -20 }], [{ x: 0.3, y: 0.2 }]]) {
      const res = await fetch(`${server.baseUrl}/lp/${uid}/__track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'heatmap', bands: 10, rb: 1, reach: [1], exit_band: 0, fv: 1, clicks }),
      })
      await res.text()
    }
    const stats = await getJson<{ versions: { clicks: { x: number; y: number; cx?: number }[] }[] }>(
      `${server.api}/ab_tests/${uid}/heatmaps/stats?start_date=2026-01-01&end_date=2026-12-31`,
    )
    expect(stats.versions[0]?.clicks).toEqual([{ x: 0.486, y: 0.5, cx: -20 }, { x: 0.3, y: 0.2 }])
  })
})

describe('ヒートマップの点', () => {
  beforeAll(() => {
    installDom()
  })
  it('cx があれば真ん中からの距離で置き、無ければ割合で置く', () => {
    const { document } = parseHTML('<!doctype html><html><head></head><body></body></html>')
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, get: () => 1000 })
    paintLpLayer(document as unknown as Document, {
      stops: null,
      dots: [
        { x: 0.486, y: 0.5, cx: -20 },
        { x: 0.3, y: 0.2, cx: 35 },
        { x: 0.3, y: 0.2 },
      ],
      dotColor: 'red',
      hideHeat: false,
    })
    const lefts = [...document.querySelectorAll('[data-dot]')].map((d) => (d as HTMLElement).style.left)
    expect(lefts).toEqual(['calc(50% - 20px)', 'calc(50% + 35px)', '30.00%'])
  })
})
