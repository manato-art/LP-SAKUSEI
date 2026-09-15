import { describe, it, expect } from 'vitest'
import { applyDictionary, type ScrubMap } from '../tools/scrub/dictionary.ts'

const map: ScrubMap = {
  'a-bull': { category: 'campaign', replacement: 'サンプル施策861' },
  大山: { category: 'person', replacement: 'サンプル人物001' },
}

/**
 * ASCIIの短い実名が、無関係な識別子の一部に一致して置換を起こしていた。
 * 実際に FontAwesome の `.fa-bullhorn` が `.fサンプル施策861horn` に化けた。
 */
describe('ASCIIの辞書キーは語の境界でだけ置換する', () => {
  it('単語の一部には一致させない', () => {
    expect(applyDictionary('.fa-bullhorn::before', map)).toBe('.fa-bullhorn::before')
  })

  it('独立した語としてなら置換する', () => {
    expect(applyDictionary('brand: a-bull', map)).toBe('brand: サンプル施策861')
  })

  it('引用符やカンマに囲まれていても置換する', () => {
    expect(applyDictionary('["a-bull", "x"]', map)).toBe('["サンプル施策861", "x"]')
  })

  it('日本語のキーは境界を要求しない（語の区切りが無いため）', () => {
    expect(applyDictionary('担当は大山です', map)).toBe('担当はサンプル人物001です')
  })
})

/**
 * 不透明なID（uid/token）だけは、語の一部に埋まっていても置換する。
 *
 * 実採取で漏れていた2か所:
 *   localStorage.setItem("sb_bp_<uid>", ...)   ← 前が `_` なので語境界が立たない
 *   request_url=...%2Farticles%2F<uid>%3F...   ← 前が `%2F` の `F`
 * どちらも実IDそのものなので、土台に残してはいけない。
 */
const opaque: ScrubMap = {
  SynthAbTestUid01: { category: 'uid', replacement: 'UID_0001' },
  SynthArticleUid1: { category: 'uid', replacement: 'UID_0002' },
  '9182736': { category: 'uid', replacement: 'UID_0003' },
}

describe('不透明なIDは語の一部でも置換する', () => {
  it('前後がアンダースコアでも置換する', () => {
    expect(applyDictionary('setItem("sb_bp_SynthAbTestUid01", v)', opaque)).toBe(
      'setItem("sb_bp_UID_0001", v)',
    )
  })

  it('URLエンコードされた区切りの直後でも置換する', () => {
    expect(applyDictionary('url=%2Farticles%2FSynthArticleUid1%3Fq', opaque)).toBe(
      'url=%2Farticles%2FUID_0002%3Fq',
    )
  })

  it('数字だけの短いIDは語の境界を守る（無関係な数字列を壊さないため）', () => {
    expect(applyDictionary('translate3d(0,-9182736px,0)', opaque)).toBe(
      'translate3d(0,-9182736px,0)',
    )
    expect(applyDictionary('/ab_tests/9182736/versions', opaque)).toBe('/ab_tests/UID_0003/versions')
  })
})
