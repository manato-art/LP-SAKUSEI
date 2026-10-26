/**
 * 取り込んだ見本（SquadBeyond の Widget）を、SquadBeyond と同じ形で入れる（2026-10-26 本人「1個1個SB本体のLPに入れて
 * 動きを確かめて再現して」・SB本体の「検証」ページに入れて形を確かめた）。
 *
 * SB本体は Widget を入れるとき:
 *   <div class="sb-custom"><div id="sb-part-番号" class="sb-custom-part 印">元のHTML</div><style data-sb-custom-style>囲ったCSS</style></div>
 * CSS の決まりの頭に「#sb-part-番号.印 」を付けて、その Widget の中だけに効くようにする。@media の中も同じ。
 * @keyframes・@font-face は囲わない。「,」で並べた決まりは1つずつ。body から始まる決まりも機械的に頭を付ける
 * （＝どこにも当たらない。SBではその決まりは効いていない）。印は入れるたびに変わる。
 * EBIyon では外枠の .sb-custom は部品の枠が受け持つ（配信で付く・sb-page-structure.ts）ので、中身は sb-custom-part と style。
 */
import { describe, expect, it } from 'vitest'
import { scopeSbCss, sbInsertMarkup } from '../src/app/panels/sb-widget-scope.ts'

const P = '#sb-part-20428.mvoq1'
const squash = (s: string): string => s.replace(/\s+/g, ' ').trim()

describe('CSS を囲う（SB本体の結果と同じ）', () => {
  it('ふつうの決まり・@media の中には頭を付ける', () => {
    expect(squash(scopeSbCss('.widget-container{margin:0}\n\n.widget-container img{width:100%}', P))).toBe(
      squash(`${P} .widget-container{margin:0} ${P} .widget-container img{width:100%}`),
    )
    expect(squash(scopeSbCss('@media (max-width: 500px){.widget-container{padding:0}}', P))).toBe(
      squash(`@media (max-width: 500px){${P} .widget-container{padding:0}}`),
    )
  })

  it('@keyframes・@font-face は囲わない（中の 50% なども触らない）', () => {
    const keyframes = '@keyframes flash{0%,100%{opacity:1}50%{opacity:0}}'
    expect(scopeSbCss(keyframes, P)).toBe(keyframes)
    const font = "@font-face{font-family:'icomoon';src:url('/uploads/a.woff')}"
    expect(scopeSbCss(font, P)).toBe(font)
  })

  it('「,」で並べた決まりは1つずつ（( ) [ ] の中の「,」では分けない）', () => {
    expect(squash(scopeSbCss('[class^="icon-"], [class*=" icon-"]{speak:none}', P))).toBe(
      squash(`${P} [class^="icon-"], ${P} [class*=" icon-"]{speak:none}`),
    )
    expect(squash(scopeSbCss('.a:is(.b,.c), .d{x:1}', P))).toBe(squash(`${P} .a:is(.b,.c), ${P} .d{x:1}`))
  })

  it('body から始まる決まりも頭を付ける（SBと同じく効かなくなる）', () => {
    expect(squash(scopeSbCss('body .article-body .sb-custom img{margin:0}', P))).toBe(
      squash(`${P} body .article-body .sb-custom img{margin:0}`),
    )
  })

  it('説明書き（コメント）と、文字の中の { } , はそのまま', () => {
    expect(squash(scopeSbCss('/* 矢印 */\n.a::before{content:"{,}"}', P))).toBe(squash(`/* 矢印 */ ${P} .a::before{content:"{,}"}`))
  })
})

describe('入れる形', () => {
  it('sb-custom-part（番号・印）で包み、囲ったCSSを後ろに置く', () => {
    const html = sbInsertMarkup({ id: 44, name: '点滅', html: '<p class="blink">あ</p>', css: '.blink{animation:flash 1s infinite}' }, 'mvoq1')
    expect(html).toBe(
      '<div id="sb-part-44" class="sb-custom-part mvoq1"><p class="blink">あ</p></div>' +
        '<style data-sb-custom-style="">#sb-part-44.mvoq1 .blink{animation:flash 1s infinite}</style>',
    )
  })

  it('CSS が無ければ <style> を付けない', () => {
    expect(sbInsertMarkup({ id: 1, name: 'a', html: '<p>あ</p>', css: ' ' }, 'x1')).toBe('<div id="sb-part-1" class="sb-custom-part x1"><p>あ</p></div>')
  })
})
