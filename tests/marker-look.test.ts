/**
 * Versionの編集画面の「マーカー」（2026-10-18 本人「下線だけではなくマーカー機能もほしい」）。
 *
 * 文字の下側に敷く太い帯（LPでよく使う蛍光ペンの線）。色・太さ・不透明度を変えられる。
 * Quill の `marker` の値に見た目を持たせ、`<span class="sb-marker">` の style（background-image）に書く。
 * 見た目の正本は `data-marker`（ブラウザが style を書き直しても、開き直したときに同じ値で読める）。
 */
import { describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'
import {
  DEFAULT_MARKER_LOOK,
  applyMarkerLook,
  encodeMarker,
  markerBackground,
  markerLookOf,
  markerValueOfElement,
} from '../src/app/panels/marker-look.ts'

describe('マーカーの見た目を Quill の値にする', () => {
  it('初めて引くときは黄色・文字の下40%・不透明度100%', () => {
    expect(DEFAULT_MARKER_LOOK).toEqual({ color: '#ffe45c', thickness: 40, opacity: 100 })
    expect(encodeMarker(DEFAULT_MARKER_LOOK)).toBe('#ffe45c,40,100')
  })

  it('色は小文字の #rrggbb、太さ・不透明度は決めた幅に収める', () => {
    expect(encodeMarker({ color: '#FFB3C7', thickness: 0, opacity: 140 })).toBe('#ffb3c7,10,100')
    expect(encodeMarker({ color: '#a8dbff', thickness: 150, opacity: -3 })).toBe('#a8dbff,100,0')
  })

  it('読めない色は黄色にする', () => {
    expect(encodeMarker({ color: 'あか', thickness: 40, opacity: 100 })).toBe('#ffe45c,40,100')
  })
})

describe('Quill の値から見た目を読む', () => {
  it('保存した値を読む', () => {
    expect(markerLookOf('#ffb3c7,60,50')).toEqual({ color: '#ffb3c7', thickness: 60, opacity: 50 })
  })
  it('選んだ範囲で見た目が混ざっているときは、先頭の見た目', () => {
    expect(markerLookOf(['#a8dbff,30,100', '#ffe45c,40,100'])).toEqual({ color: '#a8dbff', thickness: 30, opacity: 100 })
  })
  it('読めないときは初めの見た目', () => {
    expect(markerLookOf(true)).toEqual(DEFAULT_MARKER_LOOK)
    expect(markerLookOf('こわれた値')).toEqual(DEFAULT_MARKER_LOOK)
  })
  it('読んで書き直しても同じ値（隣どうしの同じマーカーが1つにまとまるため）', () => {
    expect(encodeMarker(markerLookOf('#ffb3c7,60,50'))).toBe('#ffb3c7,60,50')
  })
})

describe('帯の CSS', () => {
  it('文字の下から太さの分だけ色を敷く', () => {
    expect(markerBackground({ color: '#ffe45c', thickness: 40, opacity: 100 })).toBe(
      'linear-gradient(transparent 60%, rgb(255, 228, 92) 60%)',
    )
  })
  it('不透明度は帯の色の透明度', () => {
    expect(markerBackground({ color: '#ffb3c7', thickness: 100, opacity: 50 })).toBe(
      'linear-gradient(transparent 0%, rgba(255, 179, 199, 0.5) 0%)',
    )
  })
})

describe('<span class="sb-marker"> に書く・読む（Quill のマーカーの部品が使う）', () => {
  const makeSpan = (attrs = ''): HTMLElement => {
    const { document } = parseHTML(`<!doctype html><html><body><p><span class="sb-marker"${attrs}>大事な一文</span></p></body></html>`)
    return document.querySelector('span') as unknown as HTMLElement
  }

  it('見た目を data-marker と style に書く（配信のLPでは style だけで帯が出る）', () => {
    const span = makeSpan()
    applyMarkerLook(span, '#ffb3c7,60,50')
    expect(span.getAttribute('data-marker')).toBe('#ffb3c7,60,50')
    expect(span.getAttribute('style')).toContain('linear-gradient(transparent 40%, rgba(255, 179, 199, 0.5) 40%)')
    expect(markerValueOfElement(span)).toBe('#ffb3c7,60,50')
  })

  it('文字色など、ほかの指定は消さない', () => {
    const span = makeSpan(' style="color: rgb(255, 0, 0)"')
    applyMarkerLook(span, '#ffe45c,40,100')
    expect(span.getAttribute('style')).toMatch(/(^|;)\s*color:\s*rgb\(255, 0, 0\)/)
  })

  it('data-marker の無い古い要素は初めの見た目で読む', () => {
    expect(markerValueOfElement(makeSpan())).toBe('#ffe45c,40,100')
  })
})
