/**
 * 計測タグが「読み込み完了までの時間」を送る（2026-09-16・本人の依頼で表示の遅さを出すため）。
 *
 * 離脱時にまとめて送るヒートマップと一緒に `load: { ms, done }` を付ける（通信を1回増やさない）。
 *  - 読み込みが終わっていれば、終わるまでの時間（Navigation Timing の loadEventEnd）と done:1
 *  - 終わる前に帰ったなら、そこまでの時間と done:0（遅くて帰った人を捨てないため）
 * 古いブラウザは performance.timing で同じ値を出す。どちらも無ければ付けない。
 */
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { buildTrackingScriptBody } from '../src/shared/tracking-tag.ts'

type Listener = (event: unknown) => void

function heatmapOf(performance: unknown): Record<string, unknown> | undefined {
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
    ...(performance === undefined ? {} : { performance }),
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
  }
  context['window'] = context
  runInNewContext(buildTrackingScriptBody('https://lp.example.test/lp/AB1/__track', 'V1'), context)
  for (const fn of listeners.get('pagehide') ?? []) fn({})
  return sent.find((b) => b['event'] === 'heatmap')
}

describe('読み込み完了までの時間を送る', () => {
  it('読み込みが終わっていれば、終わるまでの時間を送る', () => {
    const heatmap = heatmapOf({
      getEntriesByType: (type: string) => (type === 'navigation' ? [{ loadEventEnd: 2345.6 }] : []),
      now: () => 9000,
    })
    expect(heatmap?.['load']).toEqual({ ms: 2346, done: 1 })
  })

  it('終わる前に帰ったなら、そこまでの時間を done:0 で送る', () => {
    const heatmap = heatmapOf({
      getEntriesByType: () => [{ loadEventEnd: 0 }],
      now: () => 4100.2,
    })
    expect(heatmap?.['load']).toEqual({ ms: 4100, done: 0 })
  })

  it('古いブラウザは performance.timing から出す', () => {
    const heatmap = heatmapOf({
      timing: { navigationStart: 1_000_000, loadEventEnd: 1_001_800 },
      now: () => 5000,
    })
    expect(heatmap?.['load']).toEqual({ ms: 1800, done: 1 })
  })

  it('測る手段が無いブラウザでは付けない（ヒートマップ自体は送る）', () => {
    const heatmap = heatmapOf(undefined)
    expect(heatmap).toBeDefined()
    expect(heatmap).not.toHaveProperty('load')
  })
})
