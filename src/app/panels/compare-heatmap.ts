/**
 * 比較モードの「ヒートマップ」タブ。
 *
 * レポート画面のヒートマップ（`pages/heatmap-columns.ts`）と**同じ描画**を使う。
 * 別実装にすると、色や到達ラインの直しが片方だけに入って食い違うため。
 *
 * レポート画面との違いは選び方だけ:
 *   レポート … 見たいVersionにチェックを入れて列を並べる
 *   比較モード … 編集中のVersionを1本だけ出す（狭いパネルなので）
 */
import { api, type HeatmapVersionStat } from '../api.ts'
import { defaultRange, toRangeQuery } from '../pages/report-period.ts'
import { renderHeatmapColumns, type ColumnSpec } from '../pages/heatmap-columns.ts'

export interface CompareHeatmapDeps {
  abTestUid: string
  versionUid: string
  /** 編集中のHTML（実LPを取得できないときの背景に使う） */
  getCurrentHtml: () => string
}

function message(container: HTMLElement, text: string): void {
  const box = document.createElement('div')
  box.className = 'sb-cmp-placeholder'
  box.style.whiteSpace = 'pre-line'
  box.textContent = text
  container.replaceChildren(box)
}

/**
 * 比較パネルにヒートマップを描く。
 * 取得に時間がかかるので、まず「読み込み中」を出してから差し替える。
 */
export async function renderCompareHeatmap(
  container: HTMLElement,
  deps: CompareHeatmapDeps,
): Promise<void> {
  message(container, '読み込み中…')
  const range = defaultRange()
  const query = toRangeQuery(range)

  let stats: readonly HeatmapVersionStat[]
  let report: Awaited<ReturnType<typeof api.report>>
  let externalHtml: string | null
  try {
    const [s, r, ext] = await Promise.all([
      api.heatmapStats(deps.abTestUid, query),
      api.report(deps.abTestUid, query),
      // 外部LPの実HTML。自前配信や未計測では404が正常なので、失敗しても止めない。
      api.externalPage(deps.abTestUid).catch(() => null),
    ])
    stats = s.versions
    report = r
    externalHtml = ext?.html ?? null
  } catch {
    message(container, 'ヒートマップを読み込めませんでした。\n時間をおいて開き直してください。')
    return
  }

  // このパネルが閉じられた／別タブへ移った場合は書き込まない
  if (!container.isConnected) return

  const hasAny = stats.some((v) => v.pv > 0)
  if (!hasAny) {
    message(
      container,
      'このページのヒートマップはまだありません。\n' +
        '位置の記録は表示したときではなく、\n' +
        'ページを離れたときに1回だけ送られます。',
    )
    return
  }

  const row = report.rows.find((r) => r.entity_uid === deps.versionUid) ?? null
  const spec: ColumnSpec = {
    versionUid: deps.versionUid,
    versionName: row?.name ?? '編集中のVersion',
    metric: 'exit',
    html: deps.getCurrentHtml(),
    pv: row?.pv ?? 0,
    ctr: row?.ctr ?? null,
    cv: row?.cv ?? 0,
  }

  const host = document.createElement('div')
  host.style.cssText = 'padding:10px;overflow:auto;flex:1'
  container.replaceChildren(host)
  renderHeatmapColumns(host, [spec], {
    stats,
    totals: { pv: report.totals.pv, ctr: report.totals.ctr, cv: report.totals.cv },
    externalHtml,
    range: { startDate: range.startDate, endDate: range.endDate },
    fullPage: false,
  })
}
