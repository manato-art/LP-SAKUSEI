/**
 * 合計の中身の断り書き（2026-09-24 点検22）。
 * 合計はページ全体・配信金額はページ単位。絞り込みで表の行と合計が合わないときは、そうと書く。
 */
import { describe, expect, it } from 'vitest'
import { totalsNoteLines } from '../src/app/pages/report-totals-note.ts'

describe('合計の断り書き', () => {
  it('何も絞っておらず、隠した行も無ければ出さない', () => {
    expect(totalsNoteLines({ filtered_by: [], hidden_rows: 0 })).toEqual([])
  })

  it('アーカイブ済みの行を隠しているときは、合計に入っていることを書く', () => {
    expect(totalsNoteLines({ filtered_by: [], hidden_rows: 2 })).toEqual([
      '合計と日別はページ全体の数字です（表に出していないアーカイブ済みのVersion 2本と、Versionに紐づかない計測を含みます）。',
    ])
  })

  it('Version で絞っているときは、配信金額はページ全体で CPA などを出さないと書く', () => {
    expect(totalsNoteLines({ filtered_by: ['version'], hidden_rows: 0 })).toEqual([
      '配信金額はページ全体の値です（Version・端末ごとには分かれていません）。絞り込んでいるあいだは CPA・MCPA を出しません。',
    ])
  })

  it('古いサーバーの応答（項目なし）は何も出さない', () => {
    expect(totalsNoteLines({})).toEqual([])
  })
})
