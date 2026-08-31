import { describe, it, expect } from 'vitest'
import { collectUrlIdentifiers, applyDictionary } from '../tools/scrub/dictionary.ts'
import type { ScrubMap } from '../tools/scrub/dictionary.ts'

describe('URLの形から実IDを見つけて辞書へ入れる', () => {
  it('/ab_tests/<id> の id を拾う', () => {
    const map: ScrubMap = {}
    collectUrlIdentifiers('<a href="/ab_tests/SynthIdAaBbCcDd/reports">r</a>', map)
    expect(Object.keys(map)).toEqual(['SynthIdAaBbCcDd'])
    expect(map['SynthIdAaBbCcDd']?.category).toBe('uid')
  })

  it('短いIDも拾う（長さでは判定しない）', () => {
    const map: ScrubMap = {}
    collectUrlIdentifiers('/folders/SynthShort1', map)
    expect(Object.keys(map)).toEqual(['SynthShort1'])
  })

  it('ルートの語（new / edit など）はIDとして扱わない', () => {
    const map: ScrubMap = {}
    collectUrlIdentifiers('/ab_tests/new /folders/edit /ab_tests/index', map)
    expect(Object.keys(map)).toEqual([])
  })

  it('入れ子ルートの構造語を置換しない（URLを壊さないため）', () => {
    const map: ScrubMap = {}
    collectUrlIdentifiers('/ab_tests/UID_1997/articles/exit_popups', map)
    collectUrlIdentifiers('/ab_tests/UID_1997/articles/htmls/heatmaps/comparisons', map)
    expect(Object.keys(map)).toEqual([])
  })

  it('置換済みのプレースホルダを二重に置換しない', () => {
    const map: ScrubMap = {}
    collectUrlIdentifiers('/ab_tests/UID_5748/articles /folders/FOLDER_0001', map)
    expect(Object.keys(map)).toEqual([])
  })

  it('同じIDが複数箇所にあっても写像は1つ（参照整合を壊さない）', () => {
    const map: ScrubMap = {}
    collectUrlIdentifiers('/ab_tests/abcdEfgh/articles と /ab_tests/abcdEfgh/reports', map)
    const replaced = applyDictionary('/ab_tests/abcdEfgh/x /ab_tests/abcdEfgh/y', map)
    const ids = [...replaced.matchAll(/\/ab_tests\/([^/]+)/g)].map((m) => m[1])
    expect(ids[0]).toBe(ids[1])
    expect(ids[0]).not.toBe('abcdEfgh')
  })

  it('articles / exit_popups / htmls 配下のIDも拾う', () => {
    const map: ScrubMap = {}
    collectUrlIdentifiers('/articles/SynthIdEeFfGgHhIiJj', map)
    expect(Object.keys(map)).toEqual(['SynthIdEeFfGgHhIiJj'])
  })

  it('拡張子付きのファイル名をIDと誤認しない', () => {
    const map: ScrubMap = {}
    collectUrlIdentifiers('/articles/main.css', map)
    expect(Object.keys(map)).toEqual([])
  })
})
