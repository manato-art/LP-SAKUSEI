/**
 * 画面（ルート）ごとの寿命（2026-10-25 本人「クロームのメモリ見たら1.2Gだった。重すぎない？」）。
 *
 * LPの編集画面は、画面全体（document・window）への見張りや1分ごとのタイマーを描くたびに足していて、画面を移っても外していなかった。
 * 見張りの中の処理が前の編集画面（Quill と LPの中身ごと）をつかみ続け、行き来するたびにメモリに溜まっていた
 * （手元で3回行き来 → 前の編集画面3つが全部残った）。画面を移ったら寿命を止めて外す。
 */
import { parseHTML } from 'linkedom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { pageLife, startPageLife } from '../src/app/page-life.ts'
import { createSaveStatus } from '../src/app/pages/editor-save-status.ts'

const globals = globalThis as unknown as Record<string, unknown>
const savedDocument = globals['document']

afterEach(() => {
  globals['document'] = savedDocument
  vi.useRealTimers()
})

describe('画面の寿命', () => {
  it('新しい画面を始めると、前の画面の寿命が止まる（いまの寿命は新しい方）', () => {
    const first = startPageLife()
    expect(first.aborted).toBe(false)
    expect(pageLife()).toBe(first)
    const second = startPageLife()
    expect(first.aborted).toBe(true)
    expect(second.aborted).toBe(false)
    expect(pageLife()).toBe(second)
  })

  it('見出しの保存状態の「N分前」を進めるタイマーは、画面を移ったら止まる', () => {
    vi.useFakeTimers()
    globals['document'] = parseHTML('<!doctype html><html><body></body></html>').document
    const life = new AbortController()
    const before = vi.getTimerCount()
    createSaveStatus(() => undefined, life.signal)
    expect(vi.getTimerCount()).toBe(before + 1)
    life.abort()
    expect(vi.getTimerCount()).toBe(before)
  })
})
