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
  applyLightTheme,
  cloneNote,
  mountCapturedPage,
  setTopBarNames,
  wireBackLink,
  wireCapturedLinks,
  wireThemeToggle,
} from './report-dom.ts'
import { defaultRange, toRangeQuery, type DateRange } from './report-period.ts'
import { sortVersions, type HeatmapSortKey } from './heatmap-sort.ts'
import { renderHeatmapColumns, type ColumnSpec, type HeatmapMetric } from './heatmap-columns.ts'
import { fetchHeatmapLpSources, type HeatmapLpSources } from './heatmap-lp-sources.ts'
import { wireAbTestTabs, setupHorizTabs, setupBreadcrumb } from './tab-nav.ts'

export async function renderHeatmap(
  container: HTMLElement,
  abTestUid: string,
  generation?: number,
): Promise<void> {
  container.style.cssText = 'flex:1;min-width:0'
  container.innerHTML = ''

  const range: DateRange = defaultRange()
  const [{ ab_test }, report, { heatmaps }, { folders }, stats, externalPage] = await Promise.all([
    api.abTest(abTestUid),
    api.report(abTestUid, toRangeQuery(range)),
    api.heatmaps(abTestUid),
    api.folders(),
    api.heatmapStats(abTestUid, toRangeQuery(range)),
    // 外部LPの実HTML。自前配信のLPや、まだ1度も計測タグが動いていないLPでは
    // 404 になるのが正常なので、失敗しても画面全体は止めない（背景がサンプルに戻るだけ）。
    api.externalPage(abTestUid).catch(() => null),
  ])
  const folder = folders.find((f) => f.id === ab_test.folder_id) ?? null

  if (generation !== undefined && isStale(generation)) return

  const root = mountCapturedPage(container, substrate)
  wireCapturedLinks(root, substrate, abTestUid)
  wireAbTestTabs(root, abTestUid, folder?.uid ?? '')
  setupHorizTabs(root, 'report', { abTestUid, folderUid: folder?.uid ?? '' })
  wireBackLink(root, folder?.uid ?? null)
  setTopBarNames(root, ab_test.title, folder?.name ?? '')
  setupBreadcrumb(root, folder?.name ?? '', ab_test.title, folder?.uid)
  applyLightTheme(root)
  wireThemeToggle(root)

  // 実物は「Version × 指標(離脱/CLICK/CV)」でチェックした数だけ右に列が増える。
  // 選択状態をここで持ち、変わるたびに列を組み直す。
  const selection = new Set<string>()
  /** LPの材料（本文・Version の CSS・記事設定）。最初にチェックされたときに取る */
  let lpSources: HeatmapLpSources | null = null
  const columnHost = ensureColumnHost(root)

  /**
   * 外部LPの計測はVersionに紐づかない（version_uid='')ので report.rows に現れず、
   * Version一覧からは選べない＝データがあるのに画面から永久に見えない。
   * 外部の集計があるときだけ、選択用の行を1本足す。
   */
  const externalRow: ReportVersionRow | null = stats.versions.some((v) => v.version_uid === '')
    ? {
        ...report.totals,
        scope: 'external',
        entity_uid: '',
        name: '外部LP（Version区別なし）',
        status: '',
        distribution_ratio: 0,
      }
    : null
  const listRows = externalRow === null ? report.rows : [...report.rows, externalRow]

  const rebuild = (): void => {
    const specs: ColumnSpec[] = []
    for (const key of selection) {
      const [versionUid, metric] = key.split('|') as [string, HeatmapMetric]
      const row = listRows.find((r) => r.entity_uid === versionUid)
      if (row === undefined) continue
      specs.push({
        versionUid,
        versionName: row.name,
        metric,
        html: lpSources?.versions.get(versionUid)?.html ?? '',
        css: lpSources?.versions.get(versionUid)?.css ?? '',
        pv: row.pv,
        ctr: row.ctr,
        cv: row.cv,
      })
    }
    renderHeatmapColumns(columnHost, specs, {
      stats: stats.versions,
      totals: { pv: report.totals.pv, ctr: report.totals.ctr, cv: report.totals.cv },
      externalHtml: externalPage?.html ?? null,
      styleCss: lpSources?.styleCss ?? '',
      range: { startDate: range.startDate, endDate: range.endDate },
      fullPage: root.querySelector('[class*="_selectHeightType_"] [class*="_active_"]') !== null,
    })
  }

  // LPの本文と見た目（Version の CSS・記事設定）はプレビューに要るので、チェックされたときに取りに行く
  const ensureLpSources = async (): Promise<void> => {
    if (lpSources !== null) return
    try {
      lpSources = await fetchHeatmapLpSources(abTestUid)
    } catch {
      /* 取れなければプレビュー無しで帯だけ出す */
    }
  }

  renderVersionList(root, listRows, (versionUid, metric, on) => {
    const key = `${versionUid}|${metric}`
    if (on) selection.add(key)
    else selection.delete(key)
    void ensureLpSources().then(rebuild)
  })
  // 開いた直後は何もチェックされておらず右側が空になる。ユーザーからは
  // 「反映されていない／壊れている」に見えるので、実測データが一番多い行を既定で開く。
  openDefaultRow(root, listRows, stats.versions)

  wireSortSelect(root, report.rows)
  wireHeightTypeTabs(root, rebuild)
  wireSortModal(root)
  showRange(root, range)
  noteHeatmapArea(root, heatmaps.length)
  rebuild()
}

/** 列を並べる場所（採取物のヒートマップ一覧の器を使う） */
function ensureColumnHost(root: HTMLElement): HTMLElement {
  const list = root.querySelector<HTMLElement>('[class*="_heatmapList_"]')
  const host = document.createElement('div')
  host.setAttribute('data-heatmap-columns', 'true')
  if (list !== null) {
    list.replaceChildren(host)
    return host
  }
  root.append(host)
  return host
}

/** 左のVersion一覧。採取済みの1件をテンプレートに、Version数だけ複製する */
type ToggleColumn = (versionUid: string, metric: HeatmapMetric, on: boolean) => void

function renderVersionList(
  root: HTMLElement,
  rows: readonly ReportVersionRow[],
  onToggle?: ToggleColumn,
): void {
  const list = root.querySelector<HTMLElement>('[class*="_articleList_"] ul[class*="_body_"]')
  const template = list?.querySelector<HTMLElement>('li[class*="_content_"]') ?? null
  if (list === null || template === null) {
    console.warn('[heatmap] Version一覧のテンプレートが土台に見つかりませんでした')
    return
  }
  const activeToken = findClassToken(template, '_active_')
  const items = rows.map((row) => {
    const item = template.cloneNode(true) as HTMLElement
    for (const node of item.querySelectorAll<HTMLElement>('[class*="_memo_"], [class*="_fullContent_"]')) {
      node.textContent = row.name
    }
    const count = item.querySelector<HTMLElement>('[class*="_count_"] div')
    if (count !== null) count.textContent = `PV: ${row.pv.toLocaleString('ja-JP')}`
    // 行の見た目は「何番目か」ではなく**チェックされているか**で決める。
    // 採取物は先頭行に active が付いた状態なので、まず全行から外す。
    // （付けたままだと、チェックを入れても2行目以降の色が変わらない）
    if (activeToken !== null) item.classList.remove(activeToken)
    wireOverlayTabs(item, activeToken, row.entity_uid, onToggle)
    return item
  })
  list.replaceChildren(...items)
}

/**
 * 各Versionの「離脱 / CLICK / CV」タブ（実物はチェックボックス）。
 * 選択状態そのものは実物のUI状態なので配線する。
 * 表示するヒートマップのデータは無いので、右側は変わらない（注記で明示する）。
 */
function wireOverlayTabs(
  item: HTMLElement,
  activeToken: string | null,
  versionUid: string,
  onToggle?: ToggleColumn,
): void {
  // 実物の並びは 離脱 / CLICK / CV の3つ。チェックした数だけ右に列が増える。
  const order: HeatmapMetric[] = ['exit', 'click', 'cv']
  const tabs = [...item.querySelectorAll<HTMLElement>('[class*="_tab_"]')]
  tabs.forEach((tab, i) => {
    const box = tab.querySelector<HTMLInputElement>('input[type="checkbox"]')
    if (box === null) return
    const metric = order[i]
    box.addEventListener('change', () => {
      if (activeToken !== null) {
        tab.classList.toggle(activeToken, box.checked)
        // 行そのものも、どれか1つでもチェックされていれば選択中の見た目にする
        const anyChecked = [...item.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].some(
          (b) => b.checked,
        )
        item.classList.toggle(activeToken, anyChecked)
      }
      if (metric !== undefined) onToggle?.(versionUid, metric, box.checked)
    })
  })
}

/**
 * 既定で1本開く。実測（ヒートマップ）のPVが一番多い行を選ぶ。
 * どれにもデータが無ければ先頭行。チェックボックスに change を投げて、
 * 通常の操作と同じ経路を通す（別経路を作ると片方だけ壊れる）。
 */
function openDefaultRow(
  root: HTMLElement,
  rows: readonly ReportVersionRow[],
  stats: readonly { version_uid: string; pv: number }[],
): void {
  if (rows.length === 0) return
  const pvOf = (uid: string): number =>
    stats.find((s) => s.version_uid === uid)?.pv ?? 0
  let bestIndex = 0
  let bestPv = -1
  rows.forEach((row, i) => {
    const pv = pvOf(row.entity_uid)
    if (pv > bestPv) {
      bestPv = pv
      bestIndex = i
    }
  })
  const items = [...root.querySelectorAll<HTMLElement>('[class*="_articleList_"] ul[class*="_body_"] > li')]
  const box = items[bestIndex]?.querySelector<HTMLInputElement>('input[type="checkbox"]')
  if (box === undefined || box === null || box.checked) return
  box.checked = true
  box.dispatchEvent(new Event('change', { bubbles: true }))
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
function wireHeightTypeTabs(root: HTMLElement, onChange?: () => void): void {
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
      onChange?.()
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
  // 実測が入るようになったので「データがありません」の固定注記は出さない。
  // 各列が自分でデータ有無を出すため、ここでは採取物由来の注記だけを掃除する。
  void count
  const host = root.querySelector<HTMLElement>('[class*="_heatmapList_"]')?.parentElement ?? null
  if (host === null) return
  for (const note of host.querySelectorAll('[data-clone-note]')) note.remove()
}

/** 要素の class から、指定の断片を含むトークンを1つ返す（Emotion/CSS Modules のハッシュ対策） */
function findClassToken(node: HTMLElement, fragment: string): string | null {
  return [...node.classList].find((token) => token.includes(fragment)) ?? null
}
