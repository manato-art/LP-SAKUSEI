/**
 * 並んでいる部品を「複製」したときの id・name の付け替え（2026-09-22・ノーコードでWidgetを作る②）。
 *
 * よくある質問の開け閉めは <input id="faq1"><label for="faq1"> のように id でつながっていることが多い。
 * 同じ id のまま複製すると、複製した方を押しても元の方が開く。
 * 複製した部品の中だけで id を新しい名前に付け替え、中の参照（for・aria-*・#id・url(#id)）も合わせる。
 */
import { describe, expect, it } from 'vitest'
import { radioNamesToRename, renameIds, rewriteIdRefs } from '../src/app/panels/nocode/clone-ids.ts'

describe('新しい id の名前', () => {
  it('ページ内で使われていない名前にする（末尾の番号は付け直す）', () => {
    const map = renameIds(['faq1', 'step-2'], new Set(['faq1', 'faq1-2', 'step-2', 'step-3']))
    expect(map.get('faq1')).toBe('faq1-3')
    expect(map.get('step-2')).toBe('step-4')
  })

  it('同じ複製の中で名前がぶつからない', () => {
    const map = renameIds(['a-1', 'a-2'], new Set(['a-1', 'a-2']))
    expect(new Set(map.values()).size).toBe(2)
    expect([...map.values()].every((v) => v !== 'a-1' && v !== 'a-2')).toBe(true)
  })
})

describe('参照の付け替え', () => {
  const map = new Map([
    ['faq1', 'faq1-3'],
    ['g1', 'g1-2'],
  ])

  it('id・for・aria の参照（空白区切りの複数も）', () => {
    expect(rewriteIdRefs('id', 'faq1', map)).toBe('faq1-3')
    expect(rewriteIdRefs('for', 'faq1', map)).toBe('faq1-3')
    expect(rewriteIdRefs('aria-labelledby', 'faq1 other', map)).toBe('faq1-3 other')
  })

  it('#id と url(#id)', () => {
    expect(rewriteIdRefs('href', '#faq1', map)).toBe('#faq1-3')
    expect(rewriteIdRefs('data-target', '#faq1', map)).toBe('#faq1-3')
    expect(rewriteIdRefs('fill', 'url(#g1)', map)).toBe('url(#g1-2)')
    expect(rewriteIdRefs('style', 'background:url("#g1") no-repeat', map)).toBe('background:url("#g1-2") no-repeat')
  })

  it('関係ない属性・外へのリンクは変えない', () => {
    expect(rewriteIdRefs('class', 'faq1', map)).toBe('faq1')
    expect(rewriteIdRefs('href', 'https://example.test/#faq1', map)).toBe('https://example.test/#faq1')
    expect(rewriteIdRefs('alt', 'faq1', map)).toBe('faq1')
  })
})

describe('ラジオボタンのグループ名', () => {
  it('1問まるごと複製したら、複製した問いは別のグループにする（元の問いの答えが消えない）', () => {
    // q1 の選択肢3つが全部この部品の中にある
    expect(radioNamesToRename(new Map([['q1', 3]]), new Map([['q1', 3]]))).toEqual(['q1'])
  })

  it('選択肢を1つ複製したときは、同じ問いの選択肢のままにする', () => {
    // q1 の選択肢は部品の外にもある
    expect(radioNamesToRename(new Map([['q1', 1]]), new Map([['q1', 3]]))).toEqual([])
  })
})
