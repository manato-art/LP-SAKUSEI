/**
 * ヒートマップ比較（`/ab_tests/:uid/articles/htmls/heatmaps/comparisons`・企画書 §10-3）。
 * レポートタブのサブナビ「ヒートマップ」から来る画面で、レポートと同じダークテーマ。
 *
 * 見た目は採取した実DOM＋実CSS
 * （`capture/clean/ab_tests__UID__articles__htmls__heatmaps__comparisons/default/`）が担保する。
 * 左＝Version一覧（PV付き・並び替え）、右＝ヒートマップの並び（採取時も空）。
 */
import substrate from '../fragments/ab_tests__UID__articles__htmls__heatmaps__comparisons__default.html?raw'
import { api, type ReportVersionRow } from '../api.ts'
import { isStale } from '../main.ts'
import { toast } from '../ui.ts'
import {
  cloneNote,
  mountCapturedPage,
  setTopBarNames,
  wireBackLink,
  wireCapturedLinks,
  wireThemeToggle,
} from './report-dom.ts'
import { defaultRange, toRangeQuery, type DateRange } from './report-period.ts'
import { sortVersions, type HeatmapSortKey } from './heatmap-sort.ts'
import { wireAbTestTabs } from './tab-nav.ts'

export async function renderHeatmap(
  container: HTMLElement,
  abTestUid: string,
  generation?: number,
): Promise<void> {
  container.style.cssText = 'flex:1;min-width:0'
  container.innerHTML = ''

  const range: DateRange = defaultRange()
  const [{ ab_test }, report, { heatmaps }, { folders }] = await Promise.all([
    api.abTest(abTestUid),
    api.report(abTestUid, toRangeQuery(range)),
    api.heatmaps(abTestUid),
    api.folders(),
  ])
  const folder = folders.find((f) => f.id === ab_test.folder_id) ?? null

  if (generation !== undefined && isStale(generation)) return

  const root = mountCapturedPage(container, substrate)
  wireCapturedLinks(root, substrate, abTestUid)
  wireAbTestTabs(root, abTestUid, folder?.uid ?? '')
  wireBackLink(root, folder?.uid ?? null)
  setTopBarNames(root, ab_test.title, folder?.name ?? '')
  wireThemeToggle(root)

  renderVersionList(root, report.rows)
  wireSortSelect(root, report.rows)
  wireHeightTypeTabs(root)
  wireSortModal(root)
  showRange(root, range)
  noteHeatmapArea(root, heatmaps.length)
}

/** 左のVersion一覧。採取済みの1件をテンプレートに、Version数だけ複製する */
function renderVersionList(root: HTMLElement, rows: readonly ReportVersionRow[]): void {
  const list = root.querySelector<HTMLElement>('[class*="_articleList_"] ul[class*="_body_"]')
  const template = list?.querySelector<HTMLElement>('li[class*="_content_"]') ?? null
  if (list === null || template === null) {
    console.warn('[heatmap] Version一覧のテンプレートが土台に見つかりませんでした')
    return
  }
  const activeToken = findClassToken(template, '_active_')
  const items = rows.map((row, index) => {
    const item = template.cloneNode(true) as HTMLElement
    for (const node of item.querySelectorAll<HTMLElement>('[class*="_memo_"], [class*="_fullContent_"]')) {
      node.textContent = row.name
    }
    const count = item.querySelector<HTMLElement>('[class*="_count_"] div')
    if (count !== null) count.textContent = `PV: ${row.pv.toLocaleString('ja-JP')}`
    if (activeToken !== null && index > 0) item.classList.remove(activeToken)
    wireOverlayTabs(item, activeToken)
    return item
  })
  list.replaceChildren(...items)
}

/**
 * 各Versionの「離脱 / CLICK / CV」タブ（実物はチェックボックス）。
 * 選択状態そのものは実物のUI状態なので配線する。
 * 表示するヒートマップのデータは無いので、右側は変わらない（注記で明示する）。
 */
function wireOverlayTabs(item: HTMLElement, activeToken: string | null): void {
  const tabs = [...item.querySelectorAll<HTMLElement>('[class*="_tab_"]')]
  for (const tab of tabs) {
    const box = tab.querySelector<HTMLInputElement>('input[type="checkbox"]')
    if (box === null) continue
    box.addEventListener('change', () => {
      if (activeToken === null) return
      tab.classList.toggle(activeToken, box.checked)
    })
  }
}

/** 並び替え（PV / CLICK / CTR / CV / CVR） */
function wireSortSelect(root: HTMLElement, rows: readonly ReportVersionRow[]): void {
  const selects = [...root.querySelectorAll<HTMLSelectElement>('[class*="_filters_"] select')]
  const sortSelect = selects[0]
  const filterSelect = selects[1]
  if (sortSelect !== undefined) {
    sortSelect.addEventListener('change', () => {
      const sorted = sortVersions(rows, sortSelect.value as HeatmapSortKey)
      if (sorted === null) {
        toast('CTR の計算式が採取物から確認できていません', 'error')
        return
      }
      renderVersionList(root, sorted)
    })
  }
  const filterHost = filterSelect?.parentElement ?? null
  if (filterHost !== null) {
    filterHost.append(
      cloneNote('「アーカイブ有り/無し」はVersionにアーカイブ状態を持たせていないため未配線。'),
    )
  }
}

/** 「スクロール表示 / 全ページ表示」の切替（実物のタブ状態） */
function wireHeightTypeTabs(root: HTMLElement): void {
  const group = root.querySelector<HTMLElement>('[class*="_selectHeightType_"]')
  if (group === null) return
  const items = [...group.querySelectorAll<HTMLElement>('[class*="_item_"]')]
  const activeToken = items.map((item) => findClassToken(item, '_active_')).find((t) => t !== null)
  if (activeToken === undefined || activeToken === null) return
  for (const item of items) {
    item.style.cursor = 'pointer'
    item.addEventListener('click', () => {
      for (const other of items) other.classList.remove(activeToken)
      item.classList.add(activeToken)
    })
  }
}

/** ソートモーダルのラジオ。実物は name が無いので、選択の排他はこちらで面倒を見る */
function wireSortModal(root: HTMLElement): void {
  const modal = root.querySelector<HTMLElement>('[class*="_sortModal_"]')
  if (modal === null) return
  const radios = [...modal.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
  for (const radio of radios) {
    radio.addEventListener('change', () => {
      for (const other of radios) other.checked = other === radio
    })
  }
  modal.append(
    cloneNote('並び順はヒートマップの表示順。表示できるヒートマップが無いので見た目は変わらない。'),
  )
}

/** 期間の表示（実物は読み取り専用でカレンダーをポータルに開く。採取物が無いので表示のみ） */
function showRange(root: HTMLElement, range: DateRange): void {
  const inputs = [...root.querySelectorAll<HTMLInputElement>('input[type="text"][readonly]')]
  const start = inputs[0]
  const end = inputs[1]
  if (start !== undefined) start.value = range.startDate
  if (end !== undefined) end.value = range.endDate
}

function noteHeatmapArea(root: HTMLElement, count: number): void {
  const host = root.querySelector<HTMLElement>('[class*="_heatmapList_"]')?.parentElement ?? null
  if (host === null) return
  const message =
    count === 0
      ? 'ヒートマップのデータがありません（新規アカウントの空状態）。実物も採取時は空だった。'
      : `ヒートマップ ${count} 件を受け取ったが、描画（クリック密度・スクロール到達）はこの画面では未実装。`
  host.append(cloneNote(message))
}

/** 要素の class から、指定の断片を含むトークンを1つ返す（Emotion/CSS Modules のハッシュ対策） */
function findClassToken(node: HTMLElement, fragment: string): string | null {
  return [...node.classList].find((token) => token.includes(fragment)) ?? null
}
