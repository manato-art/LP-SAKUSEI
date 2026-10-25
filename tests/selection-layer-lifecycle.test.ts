/**
 * Widget編集の選択枠（selection-layer.ts）は、Widget編集を閉じたら画面全体への見張りを外す
 * （2026-10-25 本人「クロームのメモリ見たら1.2Gだった。重すぎない？」）。
 *
 * 選択枠は画面の大きさが変わったら枠を置き直すため window の resize を見ている。閉じても外していなかったので、
 * その見張りが閉じたWidget編集（見たまま画面・画像・設定データ）を丸ごと握り続け、開くたびにメモリに溜まっていた。
 * Widget編集の寿命（AbortSignal）で外す。
 */
import { parseHTML } from 'linkedom'
import { afterEach, describe, expect, it } from 'vitest'
import { createSelectionLayer } from '../src/app/panels/selection-layer.ts'

const globals = globalThis as unknown as Record<string, unknown>
const saved = Object.fromEntries(['document', 'window', 'ResizeObserver', 'requestAnimationFrame', 'cancelAnimationFrame'].map((k) => [k, globals[k]]))

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) globals[key] = value
})

function setup(): { win: EventTarget; frames: () => number; observers: { observed: number; disconnected: number } } {
  const { document } = parseHTML('<!doctype html><html><body><div id="body"><div id="content"></div></div></body></html>')
  const win = new EventTarget()
  let frames = 0
  const observers = { observed: 0, disconnected: 0 }
  globals['document'] = document
  globals['window'] = win
  globals['requestAnimationFrame'] = () => {
    frames += 1
    return frames
  }
  globals['cancelAnimationFrame'] = () => undefined
  globals['ResizeObserver'] = class {
    observe(): void {
      observers.observed += 1
    }
    disconnect(): void {
      observers.disconnected += 1
    }
  }
  return { win, frames: () => frames, observers }
}

describe('選択枠の見張りは、Widget編集を閉じたら外れる', () => {
  it('閉じる（寿命の signal を止める）と、画面の大きさの変化を見なくなり、大きさの見張りも外す', () => {
    const { win, frames, observers } = setup()
    const doc = globals['document'] as Document
    const life = new AbortController()
    createSelectionLayer(doc.getElementById('body') as HTMLElement, doc.getElementById('content') as HTMLElement, life.signal)
    expect(observers.observed).toBe(1)

    win.dispatchEvent(new Event('resize'))
    expect(frames()).toBe(1)

    life.abort()
    win.dispatchEvent(new Event('resize'))
    expect(frames()).toBe(1)
    expect(observers.disconnected).toBe(1)
  })
})
