/**
 * 取り込んだ見本の中の「中身が空のリンク（href=""）」は、SB本体と同じく押しても何も起きないようにする（2026-10-27 本人選択）。
 * SB本体の編集画面（TinyMCE）は保存のときに空の href を消すので、SBでは押しても何も起きない。
 * EBIyon は書かれたままだったので、押すと同じページを読み込み直していた（「この記事を書いた人」「ランキング表」など26個）。
 */
import { describe, expect, it } from 'vitest'
import { withoutEmptyLinksInSbParts } from '../src/shared/sb-parts.ts'

const PART = (id: number, inner: string): string =>
  `<section class="sb-widget-block" data-widget-block="true"><div id="sb-part-${id}" class="sb-custom-part sbtoken${id}">${inner}</div><style data-sb-custom-style="">#sb-part-${id}.sbtoken${id} .a{color:red}</style></section>`

describe('取り込んだ見本の空のリンク', () => {
  it('取り込んだ見本の中の <a href=""> から href を外す（ほかの属性はそのまま）', () => {
    const html = PART(3025, '<a class="btn" href="" target="_blank">詳しくはこちら</a><a href=\'\'>x</a>')
    expect(withoutEmptyLinksInSbParts(html)).toBe(PART(3025, '<a class="btn" target="_blank">詳しくはこちら</a><a>x</a>'))
  })

  it('リンク先が入っているものはそのまま（javascript: も押せるまま・2026-10-27 本人選択）', () => {
    const html = PART(293, '<a href="https://example.com">a</a><a href="javascript:void(0);">b</a><a href="#">c</a>')
    expect(withoutEmptyLinksInSbParts(html)).toBe(html)
  })

  it('スクリプトの中の文字列は変えない', () => {
    const html = PART(1, '<script>el.innerHTML = \'<a href="">x</a>\'</script><a href="">y</a>')
    expect(withoutEmptyLinksInSbParts(html)).toBe(PART(1, '<script>el.innerHTML = \'<a href="">x</a>\'</script><a>y</a>'))
  })

  it('取り込んだ見本の外（自作の Widget・本文）は変えない', () => {
    const own = '<section class="sb-widget-block"><a href="">自作</a></section><p><a href="">本文</a></p>'
    expect(withoutEmptyLinksInSbParts(`${own}${PART(2, '<a href="">見本</a>')}`)).toBe(`${own}${PART(2, '<a>見本</a>')}`)
  })
})
