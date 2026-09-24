/**
 * 到達の物差しを「ページのどこまで見えたか」にそろえる（2026-09-24 点検30）。
 *
 * 以前の到達は `scrollY / (scrollHeight - innerHeight)`（スクロールの進み具合）で、
 * リンクの位置・FV・滞在・クリックは「ページ上の位置」だった。物差しが違うので、
 * 最初の画面に置いたリンクでも、スクロールしないと「到達していない」ことになっていた。
 * 新しいタグは「画面の下端がページの何割まで来たか」＝(scrollY+innerHeight)/scrollHeight で数える。
 * 送る中身に rb:1 を付けて、サーバーが新旧を見分けられるようにする（古いタグの記録は変えない）。
 */
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { buildTrackingScriptBody } from '../src/shared/tracking-tag.ts'

type Listener = (event: unknown) => void

function heatmapAt(scrollY: number, links: { top: number }[] = []): Record<string, unknown> | undefined {
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
      querySelectorAll: () =>
        links.map((link) => ({
          getAttribute: () => 'https://shop.example.test/?sb_tracking=true',
          getBoundingClientRect: () => ({ top: link.top - scrollY }),
        })),
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
    innerWidth: 400,
    scrollY,
    setInterval: () => 1,
    clearInterval: () => undefined,
    fetch: () => undefined,
  }
  context['window'] = context
  runInNewContext(buildTrackingScriptBody('https://lp.example.test/lp/AB1/__track', 'V1'), context)
  for (const fn of listeners.get('pagehide') ?? []) fn({})
  return sent.find((b) => b['event'] === 'heatmap')
}

const reachedBands = (heatmap: Record<string, unknown> | undefined): number =>
  ((heatmap?.['reach'] as number[] | undefined) ?? []).filter((v) => v === 1).length

describe('到達はページ上の位置（画面の下端）で数える', () => {
  it('スクロールしなくても、最初の画面ぶん（高さ800/2000＝40%）は到達している', () => {
    const heatmap = heatmapAt(0)
    expect(reachedBands(heatmap)).toBe(40)
    expect(heatmap?.['exit_band']).toBe(39)
    expect(heatmap?.['fv']).toBe(40)
  })

  it('400px下げたら画面の下端は1200/2000＝60%まで', () => {
    const heatmap = heatmapAt(400)
    expect(reachedBands(heatmap)).toBe(60)
    expect(heatmap?.['exit_band']).toBe(59)
  })

  it('最初の画面にあるリンクは、スクロールしなくても到達したことになる', () => {
    const heatmap = heatmapAt(0, [{ top: 500 }])
    const offer = heatmap?.['offer'] as number
    expect(offer).toBe(25)
    expect((heatmap?.['reach'] as number[])[offer]).toBe(1)
  })

  it('新しい物差しの記録だと分かる目印 rb:1 を付ける', () => {
    expect(heatmapAt(0)?.['rb']).toBe(1)
  })
})
