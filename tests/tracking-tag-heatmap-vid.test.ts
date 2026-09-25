/**
 * 位置の記録（heatmap）にも訪問者の目印（vid）を付ける（2026-09-25・申し込んだ人だけのヒートマップ）。
 * 申し込み（cv）はあとから別のページで届くので、同じ目印で結びつける。
 */
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { buildTrackingScriptBody } from '../src/shared/tracking-tag.ts'

type Listener = (event: unknown) => void

function sentOnLeave(cookie: string): Record<string, unknown>[] {
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
    document: { cookie, hidden: false, documentElement: { scrollHeight: 2000 }, querySelectorAll: () => [], addEventListener: on },
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
    innerWidth: 400,
    scrollY: 0,
    setInterval: () => 1,
    clearInterval: () => undefined,
    fetch: () => undefined,
  }
  context['window'] = context
  runInNewContext(buildTrackingScriptBody('https://lp.example.test/lp/AB1/__track', 'V1'), context)
  for (const fn of listeners.get('pagehide') ?? []) fn({})
  return sent
}

describe('位置の記録の目印', () => {
  it('Cookie _sb_tu の目印を、表示と同じく位置の記録にも付ける', () => {
    const sent = sentOnLeave('_sb_tu=visitor-abc-123')
    expect(sent.find((b) => b['event'] === 'pv')?.['vid']).toBe('visitor-abc-123')
    expect(sent.find((b) => b['event'] === 'heatmap')?.['vid']).toBe('visitor-abc-123')
  })

  it('目印が無ければ付けない', () => {
    expect(sentOnLeave('').find((b) => b['event'] === 'heatmap')?.['vid']).toBeUndefined()
  })
})
