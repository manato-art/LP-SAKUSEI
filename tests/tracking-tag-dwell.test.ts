/**
 * 滞在時間は「その間に画面に出ていた場所」に付ける（2026-09-25・数値面分析テスト）。
 *
 * 計測タグは1秒ごとと、スクロールしたときに時間を足す。以前は「足すときの画面」に付けていたので、
 * スクロールした瞬間に、スクロール前に読んでいた時間（最大1秒ぶん）が**スクロール後の場所**に付いていた。
 * ロボットで実際にLPを読ませると、1人あたり最大1秒以上ずれた（1バンドに約2秒のところ3秒）。
 */
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { buildTrackingScriptBody } from '../src/shared/tracking-tag.ts'

type Listener = (event: unknown) => void

function run(): {
  at: (ms: number) => void
  scrollTo: (y: number) => void
  tickTimer: () => void
  leave: () => Record<string, unknown> | undefined
} {
  const sent: Record<string, unknown>[] = []
  const listeners = new Map<string, Listener[]>()
  const on = (type: string, fn: Listener): void => {
    listeners.set(type, [...(listeners.get(type) ?? []), fn])
  }
  const fire = (type: string): void => {
    for (const fn of listeners.get(type) ?? []) fn({})
  }
  class FakeBlob {
    constructor(readonly parts: string[]) {}
  }
  let now = 0
  let timer: (() => void) | null = null
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
    Date: { now: () => now },
    URL,
    URLSearchParams,
    addEventListener: on,
    innerHeight: 800,
    innerWidth: 400,
    scrollY: 0,
    setInterval: (fn: () => void) => {
      timer = fn
      return 1
    },
    clearInterval: () => undefined,
    fetch: () => undefined,
  }
  context['window'] = context
  runInNewContext(buildTrackingScriptBody('https://lp.example.test/lp/AB1/__track', 'V1'), context)
  return {
    at: (ms) => {
      now = ms
    },
    scrollTo: (y) => {
      context['scrollY'] = y
      fire('scroll')
    },
    tickTimer: () => timer?.(),
    leave: () => {
      fire('pagehide')
      return sent.find((b) => b['event'] === 'heatmap')
    },
  }
}

describe('滞在時間はスクロールする前の場所に付ける', () => {
  it('上で1.9秒読んでからスクロールし、下で1秒読んで離れた', () => {
    const page = run()
    page.at(1000)
    page.tickTimer() // 上（0〜40%）を見たまま1秒
    page.at(1900)
    page.scrollTo(1200) // ここまでの0.9秒も、上を見ていた時間
    page.at(2900)
    const heatmap = page.leave() // 下（60〜100%）を見ていた1秒
    const dwell = heatmap?.['dwell'] as number[]
    expect(dwell[10]).toBe(1900)
    expect(dwell[80]).toBe(1000)
    // 上と下の間（41〜59%）は一度も画面に出ていない
    expect(dwell[50]).toBe(0)
  })
})
