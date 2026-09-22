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

describe('選択肢のボタン（アンケートの3択→4択）', () => {
  /** 文字の子を持てる親（childNodes に文字が入る） */
  function parentWithText(tagName: string, text: string, children: NodeShape[]): NodeShape {
    const self = node(tagName, '', children) as NodeShape & { childNodes: { nodeType: number; textContent: string | null }[] }
    self.childNodes = [{ nodeType: 3, textContent: text }, ...children.map(() => ({ nodeType: 1, textContent: '' }))]
    return self
  }

  it('並んだ選択肢のボタンは、1つずつ部品になる（設問ごとの箱が並んでいても、ボタンの方を選ぶ）', () => {
    const b1 = node('BUTTON', 'choice')
    const b2 = node('BUTTON', 'choice')
    const b3 = node('BUTTON', 'choice')
    const q1 = node('DIV', 'question', [node('P', 'q'), node('DIV', 'choices', [b1, b2, b3])])
    const q2 = node('DIV', 'question', [node('P', 'q'), node('DIV', 'choices', [node('BUTTON', 'choice'), node('BUTTON', 'choice')])])
    const root = node('DIV', 'survey', [q1, q2])
    expect(findRepeatItem(b2, root)).toBe(b2)
  })

  it('リンクのボタン（a）も同じ。文の途中のリンクは部品にしない', () => {
    const a1 = node('A', 'btn')
    const a2 = node('A', 'btn')
    const root = node('DIV', 'w', [node('DIV', 'links', [a1, a2])])
    expect(findRepeatItem(a1, root)).toBe(a1)
    const l1 = node('A')
    const l2 = node('A')
    const sentence = parentWithText('P', '詳しくはこちらとこちら', [l1, l2])
    expect(findRepeatItem(l1, node('DIV', 'w', [sentence]))).toBeNull()
  })

  it('「部品を積んで作る」の部品ごとのクラス（nc-b-3 など）は形の見分けに使わない（同じ種類の部品はそろう）', () => {
    expect(repeatSignature(node('DIV', 'nc-b nc-b-button nc-b-3'))).toBe(repeatSignature(node('DIV', 'nc-b nc-b-button nc-b-4')))
  })
})

describe('「部品を積んで作る」の画面の中の選択肢', () => {
  it('ボタンだけが入った部品（選択肢）を選ぶ。画面（nc-screen）ごと選ばない', () => {
    const choice = (): NodeShape => node('DIV', 'nc-b nc-b-button nc-b-button--choice', [node('A', 'nc-b-button__a', [node('SPAN', 'nc-b-button__label')])])
    const c1 = choice()
    const c2 = choice()
    const s1 = node('DIV', 'nc-screen', [node('H2', 'nc-b nc-b-heading'), c1, c2])
    const s2 = node('DIV', 'nc-screen', [choice(), choice()])
    const root = node('DIV', 'nc nc-builder', [s1, s2])
    const label = (c2.children[0] as NodeShape).children[0] as NodeShape
    expect(findRepeatItem(label, root)).toBe(c2)
  })

  it('画面そのものは部品にしない（画面の複製・並べ替えは入力の画面で行う）', () => {
    const s1 = node('DIV', 'nc-screen', [node('P', 'nc-b nc-b-text')])
    const s2 = node('DIV', 'nc-screen', [node('P', 'nc-b nc-b-text')])
    const root = node('DIV', 'nc nc-builder', [s1, s2])
    expect(findRepeatItem(s1.children[0] as NodeShape, root)).toBeNull()
  })

  it('文の中のリンクがある段落は選択肢ではない（よくある質問は1問ごと選ぶまま）', () => {
    const answer = (): NodeShape => {
      const p = node('P', '', [node('A')]) as NodeShape & { childNodes: { nodeType: number; textContent: string | null }[] }
      p.childNodes = [{ nodeType: 3, textContent: '詳しくは' }, { nodeType: 1, textContent: 'こちら' }]
      return p
    }
    const q1 = node('DIV', 'faq', [node('P', 'q'), answer()])
    const q2 = node('DIV', 'faq', [node('P', 'q'), answer()])
    const root = node('DIV', 'w', [q1, q2])
    expect(findRepeatItem(q2.children[1] as NodeShape, root)).toBe(q2)
  })
})
