import { describe, it, expect } from 'vitest'
import { findUrlIdentifierLeaks } from '../tools/gate/denylist.ts'

describe('URLの形をした実IDの残存を検知する', () => {
  it('置換済みのプレースホルダは見逃す', () => {
    expect(findUrlIdentifierLeaks('<a href="/ab_tests/UID_0304/reports">r</a>')).toEqual([])
  })

  it('置換されていないIDを見つける', () => {
    expect(findUrlIdentifierLeaks('/ab_tests/fyVwpUpEzeEkSQZg/reports')).toEqual([
      'fyVwpUpEzeEkSQZg',
    ])
  })

  it('9文字の短いIDも見つける（32文字閾値では取りこぼす）', () => {
    expect(findUrlIdentifierLeaks('/folders/nobUxTzcQ')).toEqual(['nobUxTzcQ'])
  })

  it('数字を含まない小文字語はルート語として扱う（取りこぼす代わりに誤検知を出さない）', () => {
    expect(findUrlIdentifierLeaks('/ab_tests/abcdefgh')).toEqual([])
  })

  it('ルートの語は誤検知しない', () => {
    expect(findUrlIdentifierLeaks('/ab_tests/new /folders/edit /htmls/heatmaps')).toEqual([])
  })

  it('ファイル名は誤検知しない', () => {
    expect(findUrlIdentifierLeaks('/articles/main.css')).toEqual([])
  })

  it('同じIDが複数回出ても1回だけ報告する', () => {
    // 全部小文字の語はルート名と区別できないため、実在のIDと同じく大文字を含む値で確かめる
    expect(findUrlIdentifierLeaks('/ab_tests/abcdEfgh/a /ab_tests/abcdEfgh/b')).toEqual(['abcdEfgh'])
  })
})

describe('ルートの語と実IDの見分け（小文字のみの語はルート扱い）', () => {
  it('入れ子ルートの語を実IDと誤認しない', () => {
    const text = '/ab_tests/UID_0304/articles/exit_popups /ab_tests/UID_0304/htmls/heatmaps/comparisons'
    expect(findUrlIdentifierLeaks(text)).toEqual([])
  })

  it('スネークケースの語を実IDと誤認しない', () => {
    expect(findUrlIdentifierLeaks('/ab_tests/reports_total')).toEqual([])
  })

  it('大文字を含むトークンは実IDとして検知する', () => {
    expect(findUrlIdentifierLeaks('/ab_tests/fyVwpUpEzeEkSQZg')).toEqual(['fyVwpUpEzeEkSQZg'])
  })

  it('UUID形（全部小文字）も実IDとして検知する', () => {
    expect(findUrlIdentifierLeaks('/folders/73401422-01b9-456e-8910-3aa2600cb5a7')).toEqual([
      '73401422-01b9-456e-8910-3aa2600cb5a7',
    ])
  })
})

describe('ルート語の許可リストは routes.json から作る（形だけでは不十分だった）', () => {
  const ROUTE_WORDS = ['articles', 'reports', 'exit_popups', 'htmls', 'heatmaps', 'comparisons']

  it('routes.json に載っている語は実IDとして扱わない', () => {
    expect(findUrlIdentifierLeaks('/ab_tests/UID_1997/articles/exit_popups', ROUTE_WORDS)).toEqual([])
  })

  it('許可リストにあってもIDの形なら検知する（許可リストは構造語のためのもの）', () => {
    expect(findUrlIdentifierLeaks('/ab_tests/noba2_sn2/articles', ROUTE_WORDS)).toEqual([
      'noba2_sn2',
    ])
  })
})

describe('ルート語と実IDの見分け（数字の有無で分ける）', () => {
  it('APIのエンドポイント語を実IDと誤認しない（英字とアンダースコアのみ）', () => {
    const text = '/ab_tests/rankings /folders/views /ab_tests/daily_reports /ab_tests/editor_types'
    expect(findUrlIdentifierLeaks(text)).toEqual([])
  })

  it('数字を含む小文字トークンは実IDとして検知する（実測のページIDがこの形）', () => {
    expect(findUrlIdentifierLeaks('/ab_tests/noba2_sn2 /folders/tochirac_y24').sort()).toEqual([
      'noba2_sn2',
      'tochirac_y24',
    ])
  })

  it('大文字を含むトークンは実IDとして検知する', () => {
    expect(findUrlIdentifierLeaks('/ab_tests/fyVwpUpEzeEkSQZg')).toEqual(['fyVwpUpEzeEkSQZg'])
  })

  it('UUID形も実IDとして検知する', () => {
    expect(findUrlIdentifierLeaks('/folders/73401422-01b9-456e-8910-3aa2600cb5a7')).toEqual([
      '73401422-01b9-456e-8910-3aa2600cb5a7',
    ])
  })
})
