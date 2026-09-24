/**
 * Backspace・Delete で部品を消す（2026-09-24・本人「バックスペース・デリートで消したい」）。
 * 文字を打っている途中は、ふつうに文字を消す（部品は消さない）。空になった文字の部品でもう一度押すと部品ごと消す。
 */
import { describe, expect, it } from 'vitest'
import { deleteKeyDecision } from '../src/app/panels/widget-studio-delete-key.ts'

const key = (k: string, mods: Partial<{ metaKey: boolean; ctrlKey: boolean; altKey: boolean }> = {}) => ({
  key: k,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  ...mods,
})

describe('Backspace・Delete を押したとき', () => {
  it('画像・移行先など文字を打たない部品を選んでいれば、部品を消す', () => {
    expect(deleteKeyDecision(key('Backspace'), { hasSelected: true, caret: null })).toBe('remove')
    expect(deleteKeyDecision(key('Delete'), { hasSelected: true, caret: null })).toBe('remove')
  })

  it('何も選んでいなければ何もしない', () => {
    expect(deleteKeyDecision(key('Backspace'), { hasSelected: false, caret: null })).toBe('ignore')
  })

  it('文字の部品の中で打っている途中は、文字を消す（部品は消さない）', () => {
    expect(deleteKeyDecision(key('Backspace'), { hasSelected: true, caret: { isSelected: true, isEmpty: false } })).toBe('type')
    // 別の部品の文字の中にいるときも、打っている方を優先
    expect(deleteKeyDecision(key('Delete'), { hasSelected: true, caret: { isSelected: false, isEmpty: true } })).toBe('type')
  })

  it('選んでいる文字の部品が空なら、もう一度押すと部品ごと消す', () => {
    expect(deleteKeyDecision(key('Backspace'), { hasSelected: true, caret: { isSelected: true, isEmpty: true } })).toBe('remove')
  })

  it('ほかのキー・⌘/Ctrl/Alt と一緒のときは何もしない（行ごと消す・単語ごと消すなどはブラウザに任せる）', () => {
    expect(deleteKeyDecision(key('a'), { hasSelected: true, caret: null })).toBe('ignore')
    expect(deleteKeyDecision(key('Backspace', { metaKey: true }), { hasSelected: true, caret: null })).toBe('ignore')
    expect(deleteKeyDecision(key('Backspace', { ctrlKey: true }), { hasSelected: true, caret: null })).toBe('ignore')
    expect(deleteKeyDecision(key('Delete', { altKey: true }), { hasSelected: true, caret: null })).toBe('ignore')
  })
})
