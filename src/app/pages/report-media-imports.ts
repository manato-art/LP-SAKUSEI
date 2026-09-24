/**
 * レポート／ヒートマップ上部の「広告データ取得日時」（2026-09-24・点検19）。
 *
 * 採取物の中身は「データなし」が焼き付いたままで、取り込んでも変わらなかった。
 * 最後に媒体実績を取り込んだ時刻（出どころごと・mock-server/store/media-imports.ts）を出す。
 * 自動の取り込みが失敗していたら、その理由もここに出す（黙って失敗させない）。
 */
import { api, type MediaImportRecord } from '../api.ts'
import { jstParts } from '../jst.ts'

const SOURCE_LABEL: Readonly<Record<MediaImportRecord['source'], string>> = {
  csv: 'CSV',
  meta: 'Meta',
}

const pad = (n: number): string => String(n).padStart(2, '0')

/** UNIXミリ秒 → `2026/09/24 10:15`（日本時間） */
function stamp(ms: number): string {
  const p = jstParts(new Date(ms))
  return `${p.year}/${pad(p.month)}/${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}`
}

/** 1行ずつの文言（出どころの名前順）。まだ何も取り込んでいなければ空 */
export function mediaImportLines(imports: readonly MediaImportRecord[]): string[] {
  return [...imports]
    .sort((a, b) => SOURCE_LABEL[a.source].localeCompare(SOURCE_LABEL[b.source]))
    .map((record) => {
      const label = SOURCE_LABEL[record.source]
      const auto = record.trigger === 'auto' ? '（自動）' : ''
      if (record.last_error === null && record.last_success_at !== null) {
        return `${label}：${stamp(record.last_success_at)} に${record.last_days}日分を取り込み${auto}`
      }
      const since =
        record.last_success_at === null
          ? 'まだ一度も取り込めていません'
          : `前回取り込めたのは ${stamp(record.last_success_at)}`
      return `${label}：${stamp(record.last_attempt_at)} の取り込み${auto}に失敗しました（${record.last_error ?? '理由不明'}）。${since}`
    })
}

/**
 * 採取した「広告データ取得日時」の面に、最後に取り込んだ時刻を入れる。
 * 取り込みが無ければ採取物の「データなし」のまま。読めなければそう書く。
 */
export async function mountMediaImportSummary(root: HTMLElement, abTestUid: string): Promise<void> {
  const summaries = root.querySelector<HTMLElement>('[class*="_summaries_7hxs9"]')
  const noData = root.querySelector<HTMLElement>('[class*="_noDataDescription_7hxs9"]')
  if (summaries === null) return
  let lines: string[]
  try {
    lines = mediaImportLines((await api.mediaImports(abTestUid)).imports)
  } catch (error) {
    lines = [`取り込みの記録を読めませんでした（${error instanceof Error ? error.message : '通信エラー'}）`]
  }
  if (lines.length === 0) return
  summaries.replaceChildren(
    ...lines.map((text) => {
      const line = document.createElement('div')
      line.textContent = text
      line.style.cssText = 'font-size:12px;line-height:1.7'
      return line
    }),
  )
  if (noData !== null) noData.style.display = 'none'
}
