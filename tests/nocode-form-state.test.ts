/**
 * 「型から作る」「部品を積んで作る」の入力の書き換え（2026-09-22・ノーコードでWidgetを作る③④）。
 *
 * 入力のたびに新しい中身を作る（元の中身は変えない）。値の場所は道のり（path）で指す:
 *   ['title'] / ['items', 1, 'q'] / ['screens', 0, 'blocks', 2, 'label']（画面の中の部品）
 * 並びは 足す・消す・上下に動かす・複製 ができ、型が決めた数（最小・最大）を超えない。
 */
import { describe, expect, it } from 'vitest'
import { addAt, applySymbol, duplicateAt, getAt, moveAt, removeAt, setAt } from '../src/app/panels/nocode/form-state.ts'
import type { ItemData, TemplateData } from '../src/app/panels/nocode/templates/types.ts'

const base: TemplateData = {
  title: 'よくある質問',
  items: [
    { q: 'A', a: '1' },
    { q: 'B', a: '2' },
  ],
}

const screens: TemplateData = {
  screens: [
    { id: 's1', name: '画面①', blocks: [{ type: 'button', label: 'はい' }, { type: 'button', label: 'いいえ' }] },
    { id: 's2', name: '画面②', blocks: [{ type: 'text', text: 'ありがとう' }] },
  ],
}

const list = (data: TemplateData, ...path: (string | number)[]): readonly ItemData[] => getAt(data, path) as readonly ItemData[]

describe('値の書き換え', () => {
  it('新しい中身を返し、元の中身は変えない', () => {
    const next = setAt(base, ['title'], 'Q&A')
    expect(next['title']).toBe('Q&A')
    expect(base['title']).toBe('よくある質問')
  })

  it('並びの中の1件だけ書き換える（ほかの件は同じもの）', () => {
    const next = setAt(base, ['items', 1, 'q'], 'B2')
    expect(list(next, 'items')[1]?.['q']).toBe('B2')
    expect(list(next, 'items')[0]).toBe(list(base, 'items')[0])
    expect(list(base, 'items')[1]?.['q']).toBe('B')
  })

  it('画面の中の部品も書き換えられる（ほかの画面は同じもの）', () => {
    const next = setAt(screens, ['screens', 0, 'blocks', 1, 'label'], 'たぶん')
    expect(getAt(next, ['screens', 0, 'blocks', 1, 'label'])).toBe('たぶん')
    expect(list(next, 'screens')[1]).toBe(list(screens, 'screens')[1])
    expect(getAt(screens, ['screens', 0, 'blocks', 1, 'label'])).toBe('いいえ')
  })

  it('無い場所は書き換えない（元の中身をそのまま返す）', () => {
    expect(setAt(base, ['items', 5, 'q'], 'x')).toBe(base)
  })
})

describe('並びの足し引き', () => {
  it('最後に足す。上限を超えては足さない', () => {
    expect(list(addAt(base, ['items'], { q: '', a: '' }, 5), 'items').length).toBe(3)
    expect(addAt(base, ['items'], { q: '', a: '' }, 2)).toBe(base)
  })

  it('消す。下限より少なくはしない', () => {
    const next = removeAt(base, ['items'], 0, 1)
    expect(list(next, 'items').map((i) => i['q'])).toEqual(['B'])
    expect(removeAt(next, ['items'], 0, 1)).toBe(next)
  })

  it('上下に動かす。端ではそのまま', () => {
    expect(list(moveAt(base, ['items'], 0, 1), 'items').map((i) => i['q'])).toEqual(['B', 'A'])
    expect(moveAt(base, ['items'], 0, -1)).toBe(base)
    expect(moveAt(base, ['items'], 1, 1)).toBe(base)
  })

  it('複製は、すぐ下に同じ中身を入れる（選択肢のボタンを3つから4つに）。上限なら増やさない', () => {
    const next = duplicateAt(screens, ['screens', 0, 'blocks'], 1, 10)
    expect(list(next, 'screens', 0, 'blocks').map((b) => b['label'])).toEqual(['はい', 'いいえ', 'いいえ'])
    expect(duplicateAt(screens, ['screens', 0, 'blocks'], 1, 2)).toBe(screens)
  })

  it('複製するときに中身を少し変えられる（画面を複製したら別の名前・別のidにする）', () => {
    const next = duplicateAt(screens, ['screens'], 1, 10, (copy) => ({ ...copy, id: 's3', name: '画面③' }))
    expect(list(next, 'screens').map((s) => s['id'])).toEqual(['s1', 's2', 's3'])
    expect(getAt(next, ['screens', 2, 'blocks', 0, 'text'])).toBe('ありがとう')
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
