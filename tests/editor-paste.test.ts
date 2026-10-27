/**
 * ほかから文字をコピーして貼ったとき、コピー元の見た目（書体・大きさ・行間・色・背景）を持ち込まない（2026-10-27 本人の指示⑩）。
 * 編集中のLPで、リンクを付けていないURLの文字を見つける（指示⑧）。
 */
import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'
import { cleanPastedHtml, pastedStyle, withoutSourceLook } from '../src/app/pages/editor-paste.ts'
import { urlRanges } from '../src/app/pages/editor-links.ts'

const parse = (html: string): Element => {
  const { document } = parseHTML(`<!doctype html><html><body><div id="r">${html}</div></body></html>`)
  const root = document.getElementById('r')
  if (root === null) throw new Error('parse')
  return root as unknown as Element
}

/** Chrome でほかのページの文をコピーしたときクリップボードに入る HTML（本物を短くした物）。見た目を全部の文字に書き込む */
const CHROME_COPY =
  '<html><body><!--StartFragment-->' +
  '<span style="color: rgb(90, 61, 43); font-family: &quot;Noto Serif JP&quot;, serif; font-size: 20px; font-style: normal; font-weight: 400; letter-spacing: 2.4px; text-align: start; text-indent: 0px; white-space: normal; background-color: rgb(255, 248, 238); text-decoration-thickness: initial; display: inline !important; float: none;">ほかのLPの</span>' +
  '<span class="lead" style="font-weight: 700; font-size: 26px; color: rgb(192, 57, 43); letter-spacing: 2.4px; background-color: rgb(255, 248, 238);">大きな赤い太字</span>' +
  '<span style="font-style: italic; color: rgb(90, 61, 43);">斜め</span>' +
  '<!--EndFragment--></body></html>'

describe('貼り付け（指示⑩）', () => {
  it('Versionの編集画面: 貼った文字の書体・大きさ・色・背景の色・寄せを外す（太字・リンクは残す＝2026-10-27）', () => {
    expect(
      withoutSourceLook([
        { insert: 'よそから', attributes: { font: 'Georgia', size: '22px', color: '#5a3d2b', background: '#fff8ee' } },
        { insert: '太字', attributes: { font: 'Times', bold: true, color: '#c0392b' } },
        { insert: 'リンク', attributes: { link: 'https://example.com/', color: '#3366cc' } },
        { insert: '\n', attributes: { align: 'center', header: 2 } },
        { insert: 'ふつう' },
      ]),
    ).toEqual([
      { insert: 'よそから' },
      { insert: '太字', attributes: { bold: true } },
      { insert: 'リンク', attributes: { link: 'https://example.com/' } },
      { insert: '\n', attributes: { header: 2 } },
      { insert: 'ふつう' },
    ])
  })

  it('style は太字・斜めだけ残す（ブラウザが書き込んだ色・背景・字の間・書体・大きさは外す）', () => {
    expect(pastedStyle('color: rgb(51, 51, 51); font-family: Times; font-size: 24px; line-height: 3; letter-spacing: 2px; font-weight: 700', 'SPAN')).toBe(
      'font-weight: bold',
    )
    expect(pastedStyle('font-weight: bold; font-style: italic; background-color: rgb(255, 255, 255)', 'SPAN')).toBe('font-weight: bold; font-style: italic')
    expect(pastedStyle('font-weight: 400; font-style: normal; color: rgb(0, 0, 0)', 'SPAN')).toBe('')
    // Google ドキュメントは全体を <b style="font-weight:normal"> で包む（太字にしない）
    expect(pastedStyle('font-weight:normal;', 'B')).toBe('font-weight: normal')
  })

  it('Widget編集に貼る HTML: Chrome でコピーした文は、太字・斜めだけ残してLPのふだんの見た目にする（class も外す）', () => {
    expect(cleanPastedHtml(CHROME_COPY, parse)).toBe(
      '<span>ほかのLPの</span><span style="font-weight: bold">大きな赤い太字</span><span style="font-style: italic">斜め</span>',
    )
  })

  it('Widget編集に貼る HTML: <font> の書体・大きさ・色を外し、文字でない物（script・style・meta）は入れない。リンク・太字のタグは残す', () => {
    const html =
      '<meta charset="utf-8"><style>p{color:red}</style>' +
      '<p style="font-family: Times; line-height: 3; text-align: center"><font face="Arial" size="5" color="#f00">赤</font><b>太字</b><a href="https://example.com/" style="color: rgb(51, 102, 204)">リンク</a></p><script>alert(1)</script>'
    expect(cleanPastedHtml(html, parse)).toBe('<p><font>赤</font><b>太字</b><a href="https://example.com/">リンク</a></p>')
  })
})

describe('URLの文字（指示⑧）', () => {
  it('https:// と www. で始まる所を見つける。文の終わりの句読点・閉じかっこ・日本語は含めない', () => {
    const text = '詳しくは https://example.com/a?b=1 を。または（www.example.com）、http://example.com/c.'
    expect(urlRanges(text).map(([s, e]) => text.slice(s, e))).toEqual(['https://example.com/a?b=1', 'www.example.com', 'http://example.com/c'])
  })

  it('URLの無い文は何もしない', () => {
    expect(urlRanges('リンクの無いふつうの文です。www.')).toEqual([])
  })
})
