import { describe, it, expect } from 'vitest'
import { collectFromJson, applyDictionary, type ScrubMap } from '../tools/scrub/dictionary.ts'

describe('URLはホスト名だけ置き換える（パスを壊さない）', () => {
  it('URL全体ではなくホスト名を辞書に入れる', () => {
    const map: ScrubMap = {}
    collectFromJson({ url: 'https://api.example-real.test/api/v1/folders?x=1' }, map)
    expect(Object.keys(map)).toEqual(['api.example-real.test'])
  })

  it('置換してもパスとクエリが残る', () => {
    const map: ScrubMap = {}
    collectFromJson({ url: 'https://api.example-real.test/api/v1/folders?x=1' }, map)
    const out = applyDictionary('https://api.example-real.test/api/v1/folders?x=1', map)
    expect(out).toContain('/api/v1/folders?x=1')
    expect(out).not.toContain('api.example-real.test')
  })

  it('同じホストの別URLでも写像は1つ（参照整合を保つ）', () => {
    const map: ScrubMap = {}
    collectFromJson({ a: 'https://h.example-real.test/one', b: 'https://h.example-real.test/two' }, map)
    expect(Object.keys(map)).toEqual(['h.example-real.test'])
  })

  it('ホスト名だけの値もこれまでどおり置き換える', () => {
    const map: ScrubMap = {}
    collectFromJson({ domain: 'lp.example-real.test' }, map)
    expect(Object.keys(map)).toEqual(['lp.example-real.test'])
  })
})
