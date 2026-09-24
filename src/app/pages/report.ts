/**
 * レポートタブ（`/ab_tests/:uid/reports`・企画書 §10-3）。
 *
 * この画面はアプリの他画面と**配色が違う（ダークテーマ）**。
 * 見た目は採取した実DOM＋実CSS（`capture/clean/ab_tests__UID__reports/default/`）が担保し、
 * ここは「挙動だけ」を後付けする（企画書 §11 capture-and-rehydrate）。
 *
 * 採取物には4つのセクションがある:
 *   デイリーレポート / クリエイティブ / Branch Operation / ファネル（＋ポップアップの未契約枠）
 */
import substrate from '../fragments/ab_tests__UID__reports__default.html?raw'
import { api } from '../api.ts'
import { isStale } from '../main.ts'
import {
  applyLightTheme,
  mountCapturedPage,
  replaceBakedPageName,
  setTopBarNames,
  wireBackLink,
  wireCapturedLinks,
  wireThemeToggle,
  wireCapturedDropdowns,
} from './report-dom.ts'
import { recordHistory } from './folders-history.ts'
import { defaultRange, toRangeQuery, type DateRange } from './report-period.ts'
import { buildReportBody, REPORT_FILTER_DEFAULT, type ReportFilter } from './report-v2.ts'
import { wireAbTestTabs, setupHorizTabs, setupBreadcrumb } from './tab-nav.ts'
import { mountMetaSummary } from './report-meta.ts'

/** ハッシュのクエリから期間を読む。未指定は採取物と同じ「当日のみ」 */
export function rangeFromParams(params: URLSearchParams): DateRange {
  const start = params.get('start_date')
  const end = params.get('end_date')
  if (start === null || end === null) return defaultRange()
  return start <= end ? { startDate: start, endDate: end } : { startDate: end, endDate: start }
}

/** ハッシュのクエリから絞り込み（Version / アーカイブ / 端末）を読む */
export function filterFromParams(params: URLSearchParams): ReportFilter {
  const device = params.get('device') ?? ''
  return {
    version: params.get('version') ?? '',
    archive: params.get('archive') === 'all' ? 'all' : 'except_archived',
    device: device === 'sp' || device === 'tablet' || device === 'pc' ? device : '0',
  }
}

/** 絞り込みをクエリ文字列にする（既定値は載せない＝URLを短く保つ） */
export function filterToQuery(filter: ReportFilter): string {
  const parts: string[] = []
  if (filter.version !== '') parts.push(`version=${encodeURIComponent(filter.version)}`)
  if (filter.archive !== REPORT_FILTER_DEFAULT.archive) parts.push(`archive=${filter.archive}`)
  if (filter.device !== REPORT_FILTER_DEFAULT.device) parts.push(`device=${filter.device}`)
  return parts.join('&')
}

function reportHash(abTestUid: string, range: DateRange, filter: ReportFilter): string {
  const query = [toRangeQuery(range), filterToQuery(filter)].filter((p) => p !== '').join('&')
  return `/ab_tests/${abTestUid}/reports?${query}`
}

export async function renderReport(
  container: HTMLElement,
  abTestUid: string,
  params: URLSearchParams,
  generation?: number,
): Promise<void> {
  // エディタが `height:100vh;overflow:hidden` を残していくので、縦に伸びるこの画面では戻す
  container.style.cssText = 'flex:1;min-width:0'
  container.innerHTML = ''

  const range = rangeFromParams(params)
  const filter = filterFromParams(params)
  const query = [toRangeQuery(range), filterToQuery(filter)].filter((p) => p !== '').join('&')
  const [{ ab_test }, report, { folders }] = await Promise.all([
    api.abTest(abTestUid),
    api.report(abTestUid, query),
    api.folders(),
  ])
  const folder = folders.find((f) => f.id === ab_test.folder_id) ?? null

  // API待ちの間に別の描画が始まっていたら降りる（main.ts の描画世代トークン）
  if (generation !== undefined && isStale(generation)) return

  // レポート閲覧を履歴に記録
  recordHistory(abTestUid, ab_test.title, 'ab_test', 'レポート閲覧')

  const folderName = folder?.name ?? ''
  const root = mountCapturedPage(container, substrate)
  wireCapturedLinks(root, substrate, abTestUid)
  // 左レールの4タブと「戻る」は、採取元のフォルダuidが焼き付いているので専用の配線で上書きする
  wireAbTestTabs(root, abTestUid, folder?.uid ?? '')
  setupHorizTabs(root, 'report', { abTestUid, folderUid: folder?.uid ?? '' })
  // 指示86: navWrapper の親に flex-column を設定し、採取CSSのレイアウト干渉を防ぐ
  const navWrapper86 = root.querySelector<HTMLElement>('[class*="_navArticleWrapper_"]')
  if (navWrapper86?.parentElement !== null && navWrapper86?.parentElement !== undefined) {
    navWrapper86.parentElement.style.display = 'flex'
    navWrapper86.parentElement.style.flexDirection = 'column'
    navWrapper86.parentElement.style.background = 'var(--sb-c-ffffff, #FFFFFF)'
  }
  wireBackLink(root, folder?.uid ?? null)
  setTopBarNames(root, ab_test.title, folderName)
  setupBreadcrumb(root, folderName, ab_test.title, folder?.uid)
  applyLightTheme(root)
  wireThemeToggle(root)
  // 「広告データ取得日時」「パラメーター設定」の小さな面を押して開けるようにする。
  // 設定を変えて閉じたら、その設定で一覧を組み直す（2026-09-24）
  wireCapturedDropdowns(root, abTestUid, () => {
    void renderReport(container, abTestUid, params, generation)
  })

  const alert = root.querySelector<HTMLElement>('.MuiAlert-message')
  if (alert !== null) replaceBakedPageName(alert, ab_test.title)

  /**
   * 指示178: レポート本体は採取物ではなく**指定されたデザイン**で組み直す。
   * 差し替えるのは中身だけで、ナビ・パンくず・上部タブは採取物のまま
   * （それらは他画面と共通の土台なので壊さない）。
   */
  const wrapper = root.querySelector<HTMLElement>('[class*="_abTestReportWrapper_"]')
  if (wrapper === null) {
    console.warn('[report] レポート本体の器が土台に見つかりませんでした')
  } else {
    wrapper.replaceChildren(
      await buildReportBody({
        abTestUid,
        title: ab_test.title,
        range,
        report,
        onRangeChange: (next) => {
          location.hash = reportHash(abTestUid, next, filter)
        },
        filter,
        onFilterChange: (next) => {
          location.hash = reportHash(abTestUid, range, next)
        },
      }),
    )
  }

  // Meta連携（env設定済みのときだけ）: アカウント全体の実データKPIを上部バナーで出す（指示⑤⑧）。
  void mountMetaSummary(root, toRangeQuery(range), range)
}
