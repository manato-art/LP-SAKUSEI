/**
 * 到達は、離れるときのページの高さで割合にする（2026-09-25・数値面分析テスト）。
 *
 * 画像の読み込み中はページが短い。以前は「その時点の高さ」で到達のバンドを出して最大を覚えていたので、
 * 読み込み中に測った大きな割合が、ページが伸びたあとも残った（本番で、スクロールしていないPCの人が
 * 正解の15%ではなく18%まで到達したことになっていた）。画面の下端の位置（px）の最大を覚えておき、
 * 離れるときの高さで割合にする。
 */
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { buildTrackingScriptBody } from '../src/shared/tracking-tag.ts'

type Listener = (event: unknown) => void

describe('ページが伸びたあとの到達', () => {
  it('読み込み中（高さ1000）に測っても、離れるとき（高さ4000）の割合で数える', () => {
    const sent: Record<string, unknown>[] = []
    const listeners = new Map<string, Listener[]>()
    const on = (type: string, fn: Listener): void => {
      listeners.set(type, [...(listeners.get(type) ?? []), fn])
    }
    class FakeBlob {
      constructor(readonly parts: string[]) {}
    }
    const timers: (() => void)[] = []
    const documentElement = { scrollHeight: 1000 }
    const url = new URL('https://lp.example.test/lp/AB1')
    const context: Record<string, unknown> = {
      location: { href: url.href, origin: url.origin, pathname: url.pathname, search: url.search },
      document: { cookie: '', hidden: false, documentElement, querySelectorAll: () => [], addEventListener: on },
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
      setInterval: (fn: () => void) => {
        timers.push(fn)
        return 1
      },
      clearInterval: () => undefined,
      fetch: () => undefined,
    }
    context['window'] = context
    runInNewContext(buildTrackingScriptBody('https://lp.example.test/lp/AB1/__track', 'V1'), context)
    for (const tick of timers) tick() // 読み込み中: 画面(800)がページ(1000)の80%を占めている
    documentElement.scrollHeight = 4000 // 画像が読み込まれてページが伸びた
    for (const fn of listeners.get('pagehide') ?? []) fn({})
    const heatmap = sent.find((b) => b['event'] === 'heatmap')
    const reach = heatmap?.['reach'] as number[]
    // スクロールしていないので、見たのは上から800px＝4000pxの20%まで
    expect(reach.lastIndexOf(1)).toBe(19)
    expect(heatmap?.['exit_band']).toBe(19)
  })
})
