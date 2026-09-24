/**
 * 見出しの保存状態（2026-09-24 全体点検11: 保存に失敗しても「✓保存済み」のままだった）
 */
import { describe, expect, it } from 'vitest'
import { saveStatusView } from '../src/app/pages/editor-save-status.ts'
import { isEmptyOverwrite } from '../src/app/pages/editor-save.ts'
import { parseHTML } from 'linkedom'

describe('保存状態の出し方', () => {
  it('未保存・保存中・失敗・空・ぶつかった・保存済みを、それぞれ別の言葉で出す', () => {
    const labels = (['dirty', 'saving', 'error', 'empty', 'conflict', 'saved'] as const).map((s) => saveStatusView(s).label)
    expect(new Set(labels).size).toBe(labels.length)
    expect(saveStatusView('saved').label).toBe('保存済み')
    expect(saveStatusView('error').label).toContain('保存できませんでした')
  })

  it('保存した時刻は「保存済み」のときだけ添える', () => {
    expect(saveStatusView('saved').showTime).toBe(true)
    for (const s of ['dirty', 'saving', 'error', 'empty', 'conflict'] as const) expect(saveStatusView(s).showTime).toBe(false)
  })

  it('失敗・ぶつかったときは押してやり直せる', () => {
    expect(saveStatusView('error').canRetry).toBe(true)
    expect(saveStatusView('conflict').canRetry).toBe(true)
    expect(saveStatusView('saved').canRetry).toBe(false)
  })
})

describe('空の本文で上書きしない', () => {
  it('中身のあるVersionを空で上書きしようとしたら止める（ヘッダー画像だけ残っていても空とみなす）', () => {
    ;(globalThis as unknown as Record<string, unknown>)['document'] = parseHTML('<!doctype html><html><body></body></html>').document
    expect(isEmptyOverwrite('<p><br></p>', '<p>本文</p>')).toBe(true)
    expect(isEmptyOverwrite('<!--header-image:/uploads/a.webp--><p><br></p>', '<p>本文</p>')).toBe(true)
    expect(isEmptyOverwrite('<p>新しい本文</p>', '<p>本文</p>')).toBe(false)
    expect(isEmptyOverwrite('<p><br></p>', '<p><br></p>')).toBe(false)
  })
})
