/**
 * ほかから文字をコピーして貼ったとき、コピー元の書体・行間を持ち込まない（2026-10-27 本人の指示⑩）。
 * 編集中のLPで、リンクを付けていないURLの文字を見つける（指示⑧）。
 */
import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'
import { cleanPastedHtml, withoutSourceFonts, withoutSourceTypeStyle } from '../src/app/pages/editor-paste.ts'
import { urlRanges } from '../src/app/pages/editor-links.ts'

const parse = (html: string): Element => {
  const { document } = parseHTML(`<!doctype html><html><body><div id="r">${html}</div></body></html>`)
  const root = document.getElementById('r')
  if (root === null) throw new Error('parse')
  return root as unknown as Element
}

describe('貼り付け（指示⑩）', () => {
  it('Versionの編集画面: 貼った文字の書体だけ外す（大きさ・色・太字はそのまま）', () => {
    expect(
      withoutSourceFonts([
        { insert: 'よそから', attributes: { font: 'Georgia', size: '22px', color: '#333333' } },
        { insert: '太字', attributes: { font: 'Times', bold: true } },
        { insert: '書体だけ', attributes: { font: 'Georgia' } },
        { insert: 'ふつう' },
      ]),
    ).toEqual([
      { insert: 'よそから', attributes: { size: '22px', color: '#333333' } },
      { insert: '太字', attributes: { bold: true } },
      { insert: '書体だけ' },
      { insert: 'ふつう' },
    ])
  })

  it('style から書体と行間だけ外す', () => {
    expect(withoutSourceTypeStyle('font-family: "Times New Roman", serif; font-size: 24px; line-height: 3; color: rgb(51, 51, 51)')).toBe(
      'font-size: 24px; color: rgb(51, 51, 51)',
    )
    expect(withoutSourceTypeStyle('font-family: Georgia; line-height:2')).toBe('')
  })

  it('Widget編集に貼る HTML: 書体・行間・<font face> を外し、文字でない物（script・style・meta）は入れない', () => {
    const html =
      '<meta charset="utf-8"><style>p{color:red}</style>' +
      '<p style="font-family: Times; line-height: 3; text-align: center"><span style="font-family: Georgia">よそから</span><font face="Arial" color="#f00">赤</font></p><script>alert(1)</script>'
    expect(cleanPastedHtml(html, parse)).toBe('<p style="text-align: center"><span>よそから</span><font color="#f00">赤</font></p>')
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
