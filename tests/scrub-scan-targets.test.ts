import { describe, it, expect } from 'vitest'
import { scansUrlIdentifiers } from '../tools/scrub/scan-targets.ts'
import { findUrlIdentifiers } from '../tools/shared/url-identifier.ts'

describe('URL形の実IDを探す対象ファイル', () => {
  it('DOMとCSSは見る', () => {
    expect(scansUrlIdentifiers('routes/x/default/dom.html')).toBe(true)
    expect(scansUrlIdentifiers('routes/x/default/cssom.css')).toBe(true)
  })

  // 実際に踏んだ不具合: api-urls.json だけに出てくる数字IDが辞書に載らず、
  // JSON はそのまま出力されてゲートに引っかかり、採取物を土台化できなかった。
  it('api-urls.json のような JSON も見る（実IDがURLの形で入っている）', () => {
    expect(scansUrlIdentifiers('routes/x/default/api-urls.json')).toBe(true)
  })

  it('画像は見ない（文字列を持たない）', () => {
    expect(scansUrlIdentifiers('routes/x/default/shot.png')).toBe(false)
  })
})

describe('APIのURLに出てくる数字だけのID', () => {
  it('数字だけの ab_tests のIDも実IDとして拾う', () => {
    const line = 'https://api-workers.example.com/api/v1/ab_tests/9182736/unarchived_versions'
    expect(findUrlIdentifiers(line)).toEqual(['9182736'])
  })
})
