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

type NoteSource = Pick<ReportResponse, 'filtered_by' | 'hidden_rows' | 'device_since'>

/** `2026-09-24` → `9/24` */
function shortDate(key: string): string {
  const [, m, d] = key.split('-')
  return `${Number(m)}/${Number(d)}`
}

/** 端末の表示名（採取した「端末」の選択肢の表記） */
const DEVICE_LABELS: Readonly<Record<'0' | 'sp' | 'tablet' | 'pc', string>> = {
  '0': '全て',
  sp: 'スマートフォン',
  tablet: 'タブレット',
  pc: 'PC',
}

/** レポート一覧の「デバイス」列。上の「端末」で絞っていればその端末、絞っていなければ「全て」 */
export function deviceColumnLabel(device: '0' | 'sp' | 'tablet' | 'pc'): string {
  return DEVICE_LABELS[device]
}

/**
 * 端末を記録する前の日は、端末で絞ると0になる（2026-09-24 から記録・点検29）。
 * 期間がそこにかかっていれば、何日からかを書く。
 */
function deviceSinceLine(since: string | null | undefined, range: { startDate: string } | undefined): string | null {
  if (since === undefined) return null
  if (since === null) return '端末の記録はまだありません。端末で絞った数字は、記録が始まるまで0です。'
  if (range === undefined || range.startDate >= since) return null
  return `端末の記録は ${shortDate(since)} からです。${shortDate(since)} より前の日は、端末で絞ると0になります。`
}

export function totalsNoteLines(report: NoteSource, range?: { startDate: string; endDate: string }): string[] {
  const lines: string[] = []
  const hidden = report.hidden_rows ?? 0
  if (hidden > 0) {
    lines.push(
      `合計と日別はページ全体の数字です（表に出していないアーカイブ済みのVersion ${hidden}本と、Versionに紐づかない計測を含みます）。`,
    )
  }
  const filteredBy = report.filtered_by ?? []
  if (filteredBy.length > 0) {
    lines.push(
      '配信金額はページ全体の値です（Version・端末ごとには分かれていません）。絞り込んでいるあいだは CPA・MCPA を出しません。',
    )
  }
  if (filteredBy.includes('device')) {
    const since = deviceSinceLine(report.device_since, range)
    if (since !== null) lines.push(since)
  }
  return lines
}

/** 断り書きの箱。書くことが無ければ null */
export function buildTotalsNote(
  report: NoteSource,
  range?: { startDate: string; endDate: string },
): HTMLElement | null {
  const lines = totalsNoteLines(report, range)
  if (lines.length === 0) return null
  const box = el('div', { style: `font-size:12px;color:${T.sub};line-height:1.7;margin:0 0 12px` })
  for (const line of lines) box.append(el('div', { text: line }))
  return box
}
