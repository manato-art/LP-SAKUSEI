/**
 * 「型から作る」の入力の書き換え（2026-09-22・ノーコードでWidgetを作る③）。
 *
 * 入力のたびに新しい中身を作る（元の中身は変えない）。並び（よくある質問の1問など）は
 * 足す・消す・上下に動かすができ、型が決めた数（最小・最大）を超えない。
 */
import { describe, expect, it } from 'vitest'
import { addItem, applySymbol, moveItem, removeItem, setField, setItemField } from '../src/app/panels/nocode/form-state.ts'
import type { TemplateData } from '../src/app/panels/nocode/templates/types.ts'

const base: TemplateData = {
  title: 'よくある質問',
  items: [
    { q: 'A', a: '1' },
    { q: 'B', a: '2' },
  ],
}

describe('入力の書き換え', () => {
  it('新しい中身を返し、元の中身は変えない', () => {
    const next = setField(base, 'title', 'Q&A')
    expect(next.title).toBe('Q&A')
    expect(base.title).toBe('よくある質問')
  })

  it('並びの中の1件だけ書き換える（ほかの件は同じもの）', () => {
    const next = setItemField(base, 'items', 1, 'q', 'B2')
    const list = next.items as readonly Record<string, unknown>[]
    expect(list[1]?.q).toBe('B2')
    expect(list[0]).toBe((base.items as readonly Record<string, unknown>[])[0])
    expect((base.items as readonly Record<string, unknown>[])[1]?.q).toBe('B')
  })
})

describe('並びの足し引き', () => {
  it('最後に足す。上限を超えては足さない', () => {
    expect((addItem(base, 'items', { q: '', a: '' }, 5).items as unknown[]).length).toBe(3)
    expect(addItem(base, 'items', { q: '', a: '' }, 2)).toBe(base)
  })

  it('消す。下限より少なくはしない', () => {
    const next = removeItem(base, 'items', 0, 1)
    expect((next.items as readonly Record<string, unknown>[]).map((i) => i.q)).toEqual(['B'])
    expect(removeItem(next, 'items', 0, 1)).toBe(next)
  })

  it('上下に動かす。端ではそのまま', () => {
    const down = moveItem(base, 'items', 0, 1)
    expect((down.items as readonly Record<string, unknown>[]).map((i) => i.q)).toEqual(['B', 'A'])
    expect(moveItem(base, 'items', 0, -1)).toBe(base)
    expect(moveItem(base, 'items', 1, 1)).toBe(base)
  })
})

describe('比較表の記号ボタン', () => {
  const S = ['◎', '○', '△', '×']
  it('頭の記号だけ差し替え、後ろの文字は残す', () => {
    expect(applySymbol('△ 1,980円', '◎', S)).toBe('◎ 1,980円')
    expect(applySymbol('980円', '○', S)).toBe('○ 980円')
    expect(applySymbol('', '×', S)).toBe('×')
    expect(applySymbol('◎', '△', S)).toBe('△')
  })
})
