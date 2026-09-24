/**
 * レポートの合計・日別に添える断り書き（2026-09-24・点検22）。
 *
 * 配信金額はページ（ab_test）にしか入らない。そのため:
 *  - 合計と日別はアーカイブの絞り込みに関係なくページ全体。表の行を足しても合計に合わないことがある
 *  - Version・端末で絞ると、LPの数字は絞ったぶん・配信金額はページ全体のまま（CPA・MCPA は出さない）
 * 数字が合わない理由を画面に書かないと「壊れている」に見えるので、ここで文言を作る。
 */
import { T, el } from '../ui.ts'
import type { ReportResponse } from '../api.ts'

type NoteSource = Pick<ReportResponse, 'filtered_by' | 'hidden_rows'>

export function totalsNoteLines(report: NoteSource): string[] {
  const lines: string[] = []
  const hidden = report.hidden_rows ?? 0
  if (hidden > 0) {
    lines.push(
      `合計と日別はページ全体の数字です（表に出していないアーカイブ済みのVersion ${hidden}本と、Versionに紐づかない計測を含みます）。`,
    )
  }
  if ((report.filtered_by ?? []).length > 0) {
    lines.push(
      '配信金額はページ全体の値です（Version・端末ごとには分かれていません）。絞り込んでいるあいだは CPA・MCPA を出しません。',
    )
  }
  return lines
}

/** 断り書きの箱。書くことが無ければ null */
export function buildTotalsNote(report: NoteSource): HTMLElement | null {
  const lines = totalsNoteLines(report)
  if (lines.length === 0) return null
  const box = el('div', { style: `font-size:12px;color:${T.sub};line-height:1.7;margin:0 0 12px` })
  for (const line of lines) box.append(el('div', { text: line }))
  return box
}
