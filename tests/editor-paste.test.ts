/**
 * ほかのサイト・資料からコピーして貼ったときは、書式を持ち込まず文字だけを貼る（2026-10-27 本人「書式はコピーしないで」。
 * それまでは指示⑩で書体・大きさ・色などを外し、太字・斜め・リンクは残していた。それでも「貼っただけで別のフォントになる」
 * 「フォントを選んでも変わらない」が起きていた）。貼った文字は、貼った所の文字と同じ見た目になる。
 * 同じ編集画面の中でコピーした物（印あり）は、書式ごとそのまま貼る。
 * 編集中のLPで、リンクを付けていないURLの文字を見つける（指示⑧）。
 */
import { describe, expect, it } from 'vitest'
import { pastePlainText, plainPasteText } from '../src/app/pages/editor-paste.ts'
import { urlRanges } from '../src/app/pages/editor-links.ts'

/** クリップボードの代わり（入っている種類だけ返す） */
const clipboard = (data: Record<string, string>) => ({ getData: (type: string): string => data[type] ?? '' })

describe('ほかから貼るときは文字だけ', () => {
  it('文字（text/plain）を使う。改行はそろえる', () => {
    expect(plainPasteText(clipboard({ 'text/plain': '一行目\r\n二行目', 'text/html': '<b style="font-family:Times">一行目</b>' }))).toBe('一行目\n二行目')
  })

  it('文字が無く HTML だけのときは、HTML の文字だけを取り出す', () => {
    expect(plainPasteText(clipboard({ 'text/html': '<p><span style="font-family:Times">ほかの</span><b>文</b></p>' }))).toBe('ほかの文')
  })

  it('文字が何も無い（画像だけなど）ときは横取りしない', () => {
    expect(plainPasteText(clipboard({}))).toBeNull()
    expect(plainPasteText(null)).toBeNull()
  })

  it('貼った所の文字と同じ見た目で入れる（行の書式＝見出し・寄せ などは持ち込まない）。選んでいた文字は置き換える', () => {
    const calls: string[] = []
    const quill = {
      getSelection: () => ({ index: 5, length: 3 }),
      getFormat: (index: number, length: number) => {
        calls.push(`getFormat ${String(index)} ${String(length)}`)
        return { font: 'noto-serif', bold: true, header: 2, align: 'center' }
      },
      deleteText: (index: number, length: number) => calls.push(`delete ${String(index)} ${String(length)}`),
      insertText: (index: number, text: string, formats: Record<string, unknown>) =>
        calls.push(`insert ${String(index)} ${text} ${JSON.stringify(formats)}`),
      setSelection: (index: number, length: number) => calls.push(`select ${String(index)} ${String(length)}`),
    }
    pastePlainText(quill, 'ほかの文')
    expect(calls).toEqual([
      'getFormat 5 0',
      'delete 5 3',
      'insert 5 ほかの文 {"font":"noto-serif","bold":true}',
      'select 9 0',
    ])
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
