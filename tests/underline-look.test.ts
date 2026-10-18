/**
 * Versionの編集画面の「下線」の色・太さ・不透明度（2026-10-18 本人指定）。
 *
 * 下線は Quill の `underline` の値に見た目を持たせる（`true`＝今までどおりの線、文字列＝見た目つき）。
 * 値は `<u>` そのものの style（text-decoration-color / text-decoration-thickness）として保存され、
 * 配信のLPでもそのまま効く。不透明度は色の透明度（rgba）として持つ。
 */
import { describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'
import {
  DEFAULT_UNDERLINE_LOOK,
  applyUnderlineLook,
  encodeUnderline,
  isFormatOn,
  underlineLookOf,
  underlineValueOfElement,
} from '../src/app/panels/underline-look.ts'

describe('下線の見た目を Quill の値にする', () => {
  it('何も変えていなければ、今までどおりの下線（true）', () => {
    expect(encodeUnderline(DEFAULT_UNDERLINE_LOOK)).toBe(true)
  })

  it('色だけ変えると、線の色だけが入る', () => {
    expect(encodeUnderline({ color: '#E5573F', opacity: 100, thickness: null })).toBe(
      'text-decoration-color: rgb(229, 87, 63)',
    )
  })

  it('不透明度は色の透明度として入る', () => {
    expect(encodeUnderline({ color: '#e5573f', opacity: 50, thickness: null })).toBe(
      'text-decoration-color: rgba(229, 87, 63, 0.5)',
    )
    expect(encodeUnderline({ color: '#000000', opacity: 35, thickness: null })).toBe(
      'text-decoration-color: rgba(0, 0, 0, 0.35)',
    )
  })

  it('太さは px で入る', () => {
    expect(encodeUnderline({ color: null, opacity: 100, thickness: 3 })).toBe('text-decoration-thickness: 3px')
    expect(encodeUnderline({ color: '#1F7AE0', opacity: 80, thickness: 6 })).toBe(
      'text-decoration-color: rgba(31, 122, 224, 0.8); text-decoration-thickness: 6px',
    )
  })

  it('太さ・不透明度は決めた幅に収める', () => {
    expect(encodeUnderline({ color: null, opacity: 100, thickness: 0 })).toBe('text-decoration-thickness: 1px')
    expect(encodeUnderline({ color: null, opacity: 100, thickness: 99 })).toBe('text-decoration-thickness: 30px')
    expect(encodeUnderline({ color: '#000000', opacity: -5, thickness: null })).toBe(
      'text-decoration-color: rgba(0, 0, 0, 0)',
    )
    expect(encodeUnderline({ color: '#000000', opacity: 140, thickness: null })).toBe(
      'text-decoration-color: rgb(0, 0, 0)',
    )
  })
})

describe('Quill の値・保存したHTMLから見た目を読む', () => {
  it('true は今までどおりの下線', () => {
    expect(underlineLookOf(true)).toEqual(DEFAULT_UNDERLINE_LOOK)
  })

  it('ブラウザが書き直した style（ほかの指定が混ざる）からも読める', () => {
    const style = 'color: rgb(0, 0, 0); text-decoration-color: rgba(229, 87, 63, 0.35); text-decoration-thickness: 4px;'
    expect(underlineLookOf(style)).toEqual({ color: '#e5573f', opacity: 35, thickness: 4 })
  })

  it('#付きの色・新しい書き方の rgb も読める', () => {
    expect(underlineLookOf('text-decoration-color: #1f7ae0')).toEqual({ color: '#1f7ae0', opacity: 100, thickness: null })
    expect(underlineLookOf('text-decoration-color: rgb(31 122 224 / 0.6)')).toEqual({
      color: '#1f7ae0',
      opacity: 60,
      thickness: null,
    })
  })

  it('文字と同じ色（currentcolor）・自動の太さは「変えていない」扱い', () => {
    expect(underlineLookOf('text-decoration-color: currentcolor; text-decoration-thickness: auto')).toEqual(
      DEFAULT_UNDERLINE_LOOK,
    )
  })

  it('選んだ範囲で見た目が混ざっているときは、先頭の見た目を出す', () => {
    expect(underlineLookOf(['text-decoration-thickness: 5px', true])).toEqual({
      color: null,
      opacity: 100,
      thickness: 5,
    })
  })

  it('読んで書き直しても同じ値になる（隣どうしの同じ下線が1つにまとまるため）', () => {
    const value = 'text-decoration-color: rgba(31, 122, 224, 0.8); text-decoration-thickness: 6px'
    expect(encodeUnderline(underlineLookOf(value))).toBe(value)
  })
})

describe('下線が付いているか', () => {
  it('見た目つきの下線も「付いている」', () => {
    expect(isFormatOn(true)).toBe(true)
    expect(isFormatOn('text-decoration-thickness: 3px')).toBe(true)
    expect(isFormatOn(['text-decoration-thickness: 3px', true])).toBe(true)
  })
  it('付いていない', () => {
    expect(isFormatOn(undefined)).toBe(false)
    expect(isFormatOn(false)).toBe(false)
    expect(isFormatOn('')).toBe(false)
  })
})

describe('<u> の要素に書く・要素から読む（Quill の下線の部品が使う）', () => {
  const makeU = (html = '<u>大事な一文</u>'): HTMLElement => {
    const { document } = parseHTML(`<!doctype html><html><body><p>${html}</p></body></html>`)
    return document.querySelector('u') as unknown as HTMLElement
  }

  it('見た目を <u> 自身の style に書く（外側の太字などに書くと線に効かない）', () => {
    const u = makeU()
    applyUnderlineLook(u, 'text-decoration-color: rgba(229, 87, 63, 0.5); text-decoration-thickness: 3px')
    expect(underlineValueOfElement(u)).toBe(
      'text-decoration-color: rgba(229, 87, 63, 0.5); text-decoration-thickness: 3px',
    )
  })

  it('見た目の無い <u> は、今までどおりの下線（true）', () => {
    expect(underlineValueOfElement(makeU())).toBe(true)
  })

  it('文字色など、ほかの指定は消さない', () => {
    const u = makeU('<u style="color: rgb(255, 0, 0)">大事な一文</u>')
    applyUnderlineLook(u, 'text-decoration-thickness: 2px')
    // 書き直したあとの空白の入り方はブラウザ次第なので、指定が残っているかだけを見る
    expect(u.getAttribute('style')).toMatch(/(^|;)\s*color:\s*rgb\(255, 0, 0\)/)
    expect(underlineValueOfElement(u)).toBe('text-decoration-thickness: 2px')
  })

  it('保存してあったHTMLの <u style> から読める', () => {
    const u = makeU('<u style="text-decoration-color: rgb(31, 122, 224); text-decoration-thickness: 4px;">大事な一文</u>')
    expect(underlineValueOfElement(u)).toBe('text-decoration-color: rgb(31, 122, 224); text-decoration-thickness: 4px')
  })
})
