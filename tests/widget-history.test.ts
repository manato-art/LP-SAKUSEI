/**
 * Widget編集の「元に戻す・やり直す」（2026-09-24・点検で見つけた「部品の操作が戻せない」）。
 * 部品を足す・消す・動かす・右の欄で変える・文字を打つ、のどれも Widget の中身の変わり目として覚える。
 * 続けて打った文字（すぐ続いた変わり目）は1回ぶんにまとめる。
 */
import { describe, expect, it } from 'vitest'
import { createHistory } from '../src/app/panels/widget-studio-history.ts'

describe('元に戻す・やり直す', () => {
  it('変わり目を順に戻し、やり直せる', () => {
    const h = createHistory('a', { mergeMs: 700, limit: 100 })
    h.record('b', 1000)
    h.record('c', 3000)
    expect(h.undo()).toBe('b')
    expect(h.undo()).toBe('a')
    expect(h.undo()).toBeNull()
    expect(h.redo()).toBe('b')
    expect(h.redo()).toBe('c')
    expect(h.redo()).toBeNull()
  })

  it('すぐ続いた変わり目（打っている途中）は1回ぶんにまとめる', () => {
    const h = createHistory('', { mergeMs: 700, limit: 100 })
    h.record('い', 1000)
    h.record('いち', 1200)
    h.record('いちば', 1500)
    h.record('いちばん', 3000)
    expect(h.undo()).toBe('いちば')
    expect(h.undo()).toBe('')
  })

  it('戻したあとに変えたら、やり直しの先は捨てる', () => {
    const h = createHistory(1, { mergeMs: 700, limit: 100 })
    h.record(2, 1000)
    h.record(3, 3000)
    expect(h.undo()).toBe(2)
    h.record(9, 3100)
    expect(h.redo()).toBeNull()
    expect(h.undo()).toBe(2)
  })

  it('戻した直後の変わり目は、戻した所にまとめない（新しい1回ぶん）', () => {
    const h = createHistory('a', { mergeMs: 700, limit: 100 })
    h.record('b', 1000)
    expect(h.undo()).toBe('a')
    h.record('x', 1100)
    expect(h.undo()).toBe('a')
  })

  it('同じ中身は覚えない。覚えるのは決めた数まで', () => {
    const h = createHistory(0, { mergeMs: 0, limit: 3 })
    h.record(0, 1)
    expect(h.canUndo()).toBe(false)
    for (let n = 1; n <= 5; n++) h.record(n, n * 1000)
    expect(h.undo()).toBe(4)
    expect(h.undo()).toBe(3)
    expect(h.undo()).toBeNull()
  })
})
