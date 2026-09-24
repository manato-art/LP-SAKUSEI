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

  it('端末で絞っていて、期間が記録を始めた日より前からなら、その日付を書く', () => {
    expect(
      totalsNoteLines({ filtered_by: ['device'], hidden_rows: 0, device_since: '2026-09-24' }, {
        startDate: '2026-09-20',
        endDate: '2026-09-25',
      }),
    ).toContain('端末の記録は 9/24 からです。9/24 より前の日は、端末で絞ると0になります。')
  })

  it('端末の記録がまだ1件も無いときもそう書く', () => {
    expect(
      totalsNoteLines({ filtered_by: ['device'], hidden_rows: 0, device_since: null }, {
        startDate: '2026-09-20',
        endDate: '2026-09-25',
      }),
    ).toContain('端末の記録はまだありません。端末で絞った数字は、記録が始まるまで0です。')
  })

  it('期間がすべて記録を始めた日より後なら、日付の断りは出さない', () => {
    const lines = totalsNoteLines({ filtered_by: ['device'], hidden_rows: 0, device_since: '2026-09-01' }, {
      startDate: '2026-09-20',
      endDate: '2026-09-25',
    })
    expect(lines.some((l) => l.startsWith('端末の記録は'))).toBe(false)
  })
})

describe('レポート一覧の「デバイス」列', () => {
  it('端末で絞っていればその端末名、絞っていなければ「全て」', async () => {
    const { deviceColumnLabel } = await import('../src/app/pages/report-totals-note.ts')
    expect(deviceColumnLabel('0')).toBe('全て')
    expect(deviceColumnLabel('sp')).toBe('スマートフォン')
    expect(deviceColumnLabel('tablet')).toBe('タブレット')
    expect(deviceColumnLabel('pc')).toBe('PC')
  })
})
