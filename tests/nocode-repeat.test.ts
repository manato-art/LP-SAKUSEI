/**
 * 並んでいる部品を増やす・複製・消す・並べ替える（2026-09-22・本人の依頼。ノーコードでWidgetを作る②）。
 *
 * よくある質問・口コミ・特徴リスト・料金表の行のように、同じ形が並んでいるところを見つけて、
 * 編集画面で「＋下に複製」「↑」「↓」「消す」を出す。
 *
 * 「同じ形」は、タグ名とクラスがそろっている兄弟が2つ以上あること。
 * 文の途中の <span> や <b> のような飾りは部品として扱わない（1文字ずつ消せてしまうと壊れる）。
 * 判定は小さな形（tagName・className・親・子）だけを見るので、DOMが無くても確かめられる。
 */
import { describe, expect, it } from 'vitest'
import { createKnownGroups, findRepeatItem, neighborOf, repeatGroupOf, repeatSignature, type NodeShape } from '../src/app/panels/nocode/repeat-logic.ts'

/** テスト用の小さな木 */
function node(tagName: string, className = '', children: NodeShape[] = []): NodeShape {
  const self: NodeShape = { tagName, className, parentElement: null, children }
  for (const child of children) (child as { parentElement: NodeShape | null }).parentElement = self
  return self
}

describe('同じ形の見分け方', () => {
  it('タグ名とクラスでそろえる（クラスの順番は問わない）', () => {
    expect(repeatSignature(node('DIV', 'faq item'))).toBe(repeatSignature(node('DIV', 'item faq')))
    expect(repeatSignature(node('DIV', 'faq'))).not.toBe(repeatSignature(node('LI', 'faq')))
  })

  it('開いている・選ばれているなどの状態のクラスは無視する（1つだけ開いていても同じ形）', () => {
    expect(repeatSignature(node('DIV', 'faq is-open active'))).toBe(repeatSignature(node('DIV', 'faq')))
  })
})

describe('部品を見つける', () => {
  const q1 = node('DIV', 'faq', [node('P', 'q'), node('P', 'a')])
  const q2 = node('DIV', 'faq', [node('P', 'q'), node('P', 'a')])
  const q3 = node('DIV', 'faq', [node('P', 'q'), node('P', 'a')])
  const title = node('H2', 'title')
  const root = node('DIV', 'widget', [title, q1, q2, q3])

  it('中の文字を指していても、並んでいる部品（よくある質問の1問）を返す', () => {
    const answer = q2.children[1] as NodeShape
    expect(findRepeatItem(answer, root)).toBe(q2)
  })

  it('同じ形の兄弟がいなければ部品ではない（見出しは1つだけ）', () => {
    expect(findRepeatItem(title, root)).toBeNull()
  })

  it('同じ形がそろっている仲間を並び順で返す', () => {
    expect(repeatGroupOf(q2)).toEqual([q1, q2, q3])
  })

  it('文の途中の飾り（span・b など）は部品として扱わない', () => {
    const s1 = node('SPAN', 'mark')
    const s2 = node('SPAN', 'mark')
    const p = node('P', 'text', [s1, s2])
    const r = node('DIV', 'w', [p])
    expect(findRepeatItem(s1, r)).toBeNull()
  })

  it('Widgetの外（編集画面そのもの）までは探さない', () => {
    const outside = node('DIV', 'faq', [])
    const inside = node('DIV', 'faq', [])
    const widgetRoot = node('DIV', 'widget', [inside])
    node('SECTION', 'page', [outside, widgetRoot])
    expect(findRepeatItem(inside, widgetRoot)).toBeNull()
  })

  it('行（tr）・箇条書き（li）も部品になる', () => {
    const r1 = node('TR')
    const r2 = node('TR')
    const tbody = node('TBODY', '', [r1, r2])
    const r = node('TABLE', '', [tbody])
    expect(findRepeatItem(r1, r)).toBe(r1)
    const l1 = node('LI')
    const l2 = node('LI')
    const ul = node('UL', '', [l1, l2])
    expect(findRepeatItem(l2, node('DIV', '', [ul]))).toBe(l2)
  })
})

describe('中に段落が並んでいても、まとまり（1問・1件）を選ぶ', () => {
  it('よくある質問の1問の中の文字を指したら、段落ではなく1問ごと選ぶ', () => {
    const q1 = node('DIV', 'faq', [node('P'), node('P')])
    const q2 = node('DIV', 'faq', [node('P'), node('P')])
    node('DIV', 'widget', [q1, q2])
    const answer = q2.children[1] as NodeShape
    expect(findRepeatItem(answer, q2.parentElement as NodeShape)).toBe(q2)
  })

  it('段落しか並んでいない文章なら、段落を選ぶ', () => {
    const p1 = node('P')
    const p2 = node('P', '', [node('B')])
    const root = node('DIV', 'text', [p1, p2])
    expect(findRepeatItem(p2.children[0] as NodeShape, root)).toBe(p2)
  })
})

describe('消して1つになっても、同じ仲間として扱い続ける', () => {
  it('一度並んでいると分かった形は、残り1つでも部品のまま（また増やせる）', () => {
    const a = node('LI', 'review')
    const b = node('LI', 'review')
    const ul = node('UL', '', [a, b])
    const root = node('DIV', '', [ul])
    const known = createKnownGroups()
    expect(findRepeatItem(a, root, known)).toBe(a)
    // b を消した（ul の子が a だけになった）
    ;(ul as unknown as { children: NodeShape[] }).children = [a]
    expect(findRepeatItem(a, root)).toBeNull()
    expect(findRepeatItem(a, root, known)).toBe(a)
  })
})

describe('上へ・下へ', () => {
  it('同じ仲間の中で1つ前・1つ後ろを返す（端なら null）', () => {
    const items = ['a', 'b', 'c']
    expect(neighborOf(items, 'b', -1)).toBe('a')
    expect(neighborOf(items, 'b', 1)).toBe('c')
    expect(neighborOf(items, 'a', -1)).toBeNull()
    expect(neighborOf(items, 'c', 1)).toBeNull()
  })
})
