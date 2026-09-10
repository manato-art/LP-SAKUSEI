/**
 * コードパネルの文字が背景に溶けないことの機械証明（指示181）。
 *
 * ハイライトは正規表現ベースなので、どのパターンにも当たらなかった語は
 * `<span style="color:…">` に包まれず**素のまま**出る。コードパネルの地は
 * ほぼ黒（#151515）なので、素のまま＝既定の黒文字＝読めない。
 *
 * 実際 `font-family: Hiragino Sans, Arial, sans-serif !important;` の
 * フォント名も `!important` の `important` も包まれておらず、真っ黒だった。
 *
 * ここでは「出力に、spanの外にある可視文字が1つも無い」ことを固定する。
 */
import { describe, expect, it } from 'vitest'
import { highlightCss, highlightHtml, highlightJs } from '../src/app/panels/syntax-highlight.ts'

/** span の中身を全部取り除き、外に残った可視文字（空白以外）を返す */
function textOutsideSpans(html: string): string {
  return html
    .replace(/<span style="color:[^"]*">[\s\S]*?<\/span>/g, '')
    .replace(/\s+/g, '')
}

const CSS_SAMPLE = `#articlePartPreview {
  font-size: 17px !important;
  font-family: Hiragino Sans, Arial, sans-serif !important;
  color: #000000 !important;
  line-height: 1.8 !important;
  letter-spacing: 1px !important;
}
#articlePartPreview img {
  margin-top: 0px !important;
  display: block !important;
}`

describe('ハイライトの取りこぼしが黒文字にならない', () => {
  it('CSS: 色の付いていない裸の文字が残らない', () => {
    expect(textOutsideSpans(highlightCss(CSS_SAMPLE))).toBe('')
  })

  it('CSS: フォント名と !important も色が付く（実際に真っ黒だった2つ）', () => {
    const out = highlightCss('a{font-family: Hiragino Sans !important;}')
    expect(out).toContain('>Hiragino<')
    expect(out).toContain('>important<')
  })

  it('HTML: 色の付いていない裸の文字が残らない', () => {
    const out = highlightHtml('<div class="MuiBox-root css-0"><span>あ</span></div>')
    expect(textOutsideSpans(out)).toBe('')
  })

  it('JS: 色の付いていない裸の文字が残らない', () => {
    const out = highlightJs('const a = foo.bar; // メモ')
    expect(textOutsideSpans(out)).toBe('')
  })
})
