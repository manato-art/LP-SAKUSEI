/**
 * 右の欄で文字を直しても、見たまま画面で付けた飾り（太字・色・大きさ）を消さない（2026-09-24・点検で見つけた食い違い）。
 * 右の欄は飾りを外した素の文字を出す。直したら、変わった所だけを飾りつきの文字に差し替える（ほかの飾りは残す）。
 */
import { describe, expect, it } from 'vitest'
import { applyPlainEdit, plainTextOfRich } from '../src/app/panels/nocode/rich-text.ts'

describe('素の文字の直しを、飾りつきの文字に当てる', () => {
  it('末尾に足しても、前の飾りはそのまま', () => {
    expect(applyPlainEdit('<b>いち</b>ばん', 'いちばん!')).toBe('<b>いち</b>ばん!')
  })

  it('飾りの中の続きに打った文字は、その飾りのまま（打ち足しと同じ）', () => {
    expect(applyPlainEdit('<b>abc</b>', 'abcd')).toBe('<b>abcd</b>')
    expect(applyPlainEdit('<font color="#E5573F">赤</font>い', '赤赤い')).toBe('<font color="#E5573F">赤赤</font>い')
  })

  it('途中を書き換えても、ほかの飾りは残る', () => {
    expect(applyPlainEdit('<b>ab</b>cd', 'aXcd')).toBe('<b>aX</b>cd')
    expect(applyPlainEdit('<span style="font-size: 20px;">大</span>きい', '大きな')).toBe('<span style="font-size: 20px;">大</span>きな')
  })

  it('飾りの境目をまたいで消しても、タグは壊さない', () => {
    expect(applyPlainEdit('<b>ab</b>cd', 'ad')).toBe('<b>a</b>d')
  })

  it('改行は <br>、入力の < > & は文字のまま', () => {
    expect(applyPlainEdit('a<br>b', 'a\nbc')).toBe('a<br>bc')
    expect(applyPlainEdit('ab', 'a\nb')).toBe('a<br>b')
    expect(applyPlainEdit('ab', 'a<b')).toBe('a&lt;b')
    expect(applyPlainEdit('a&amp;b', 'a&bc')).toBe('a&amp;bc')
    expect(applyPlainEdit('x', 'x&amp;')).toBe('x&amp;amp;')
  })

  it('空から打つ・全部消す・変わらない', () => {
    expect(applyPlainEdit('', 'x')).toBe('x')
    expect(plainTextOfRich(applyPlainEdit('<b>ab</b>', ''))).toBe('')
    expect(applyPlainEdit('<b>ab</b>cd', 'abcd')).toBe('<b>ab</b>cd')
  })

  it('直したあとの素の文字は、右の欄で打った文字と同じ', () => {
    const cases: [string, string][] = [
      ['<b>いち</b>ばん<br><i>だいじ</i>', 'いちばん\nとてもだいじ'],
      ['<u>下線</u>と<s>取り消し</s>', '下線と取り消し線'],
      ['a&lt;b', 'a<bc'],
    ]
    for (const [rich, plain] of cases) expect(plainTextOfRich(applyPlainEdit(rich, plain))).toBe(plain)
  })
})
