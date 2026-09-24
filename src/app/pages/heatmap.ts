/**
 * ヒートマップ比較（`/ab_tests/:uid/articles/htmls/heatmaps/comparisons`・企画書 §10-3）。
 * レポートタブのサブナビ「ヒートマップ」から来る画面で、レポートと同じダークテーマ。
 *
 * 見た目は採取した実DOM＋実CSS
 * （`capture/clean/ab_tests__UID__articles__htmls__heatmaps__comparisons/default/`）が担保する。
 * 左＝Version一覧（PV付き・並び替え）、右＝ヒートマップの並び（採取時も空）。
 */
import substrate from '../fragments/ab_tests__UID__articles__htmls__heatmaps__comparisons__default.html?raw'
import { api, type HeatmapParameter, type HeatmapVersionStat, type ReportVersionRow } from '../api.ts'
import { isStale } from '../main.ts'
import {
  applyLightTheme,
  cloneNote,
  mountCapturedPage,
  setTopBarNames,
  wireBackLink,
  wireCapturedLinks,
  wireThemeToggle,
  wireCapturedDropdowns,
} from './report-dom.ts'
import { defaultRange, toRangeQuery, type DateRange } from './report-period.ts'
import { sortVersions, type HeatmapSortKey } from './heatmap-sort.ts'
import {
  renderHeatmapColumns,
  type ColumnSpec,
  type HeatmapDeviceData,
  type HeatmapMetric,
} from './heatmap-columns.ts'
import { columnKeyOf, expandColumnKeys, paramsForVersion } from './heatmap-params.ts'
import { fetchHeatmapLpSources, type HeatmapLpSources } from './heatmap-lp-sources.ts'
import { wireAbTestTabs, setupHorizTabs, setupBreadcrumb } from './tab-nav.ts'

export async function renderHeatmap(
  container: HTMLElement,
  abTestUid: string,
  generation?: number,
  /** 期間を変えたときに、同じ画面をその期間で描き直すために受け取る（2026-09-15） */
  requestedRange?: DateRange,
): Promise<void> {
  container.style.cssText = 'flex:1;min-width:0'
  container.innerHTML = ''

  const range: DateRange = requestedRange ?? defaultRange()
  const [{ ab_test }, report, { heatmaps }, { folders }, stats, externalPage] = await Promise.all([
    api.abTest(abTestUid),
    // 左の一覧の「アーカイブ有り／無し」はこの画面で絞る。サーバーの既定（アーカイブ済みを除く）のままだと
    // アーカイブ済みの行が最初から届かず、「アーカイブ有り」にしても何も増えなかった（2026-09-24）
    api.report(abTestUid, `${toRangeQuery(range)}&archive=all`),
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
  // 「広告データ取得日時」「パラメーター設定」の小さな面を押して開けるようにする。
  // 設定（ヒートマップに出す広告）を変えて閉じたら、その設定で描き直す（2026-09-24）
  wireCapturedDropdowns(root, abTestUid, () => {
    void renderHeatmap(container, abTestUid, generation, range)
  })

  // 実物は「Version × 指標(離脱/CLICK/CV)」でチェックした数だけ右に列が増える。
  // 選択状態をここで持ち、変わるたびに列を組み直す。
  const selection = new Set<string>()
  /** 広告パラメータのチェック（`versionUid|utm_source=fb`）。選ぶとそのVersionの列が広告ごとに分かれる */
  const paramSelection = new Set<string>()
  /** 広告パラメータごとの集計。空文字＝合算（最初の1回で取れている） */
  const statsByParam = new Map<string, readonly HeatmapVersionStat[]>([['', stats.versions]])
  /** カードの「複製」を押した回数（列の鍵 → 回数） */
  const duplicates = new Map<string, number>()
  /** 左のチェックボックス。カードの「非表示にする」から外すために覚えておく */
  const metricBoxes = new Map<string, HTMLInputElement>()
  const paramBoxes = new Map<string, HTMLInputElement>()
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

  /** ソートモーダルで選ばれた並び順（採取物の9択の文字） */
  let columnOrder = ''

  /**
   * SP / PC ぶんの記録（2026-09-24・点検29）。列の SP / PC を押したときに1回だけ取りに行き、列どうしで使い回す。
   * 失敗したら覚えずに捨てる（次に押したときに取り直す）。
   */
  const deviceCache = new Map<'sp' | 'pc', Promise<HeatmapDeviceData>>()
  const loadDevice = (device: 'sp' | 'pc'): Promise<HeatmapDeviceData> => {
    const hit = deviceCache.get(device)
    if (hit !== undefined) return hit
    const query = `${toRangeQuery(range)}&device=${device}`
    const loading = Promise.all([
      api.heatmapStats(abTestUid, query),
      api.report(abTestUid, `${query}&archive=all`),
    ]).then(([deviceStats, deviceReport]) => ({
      versions: deviceStats.versions,
      coverage: deviceStats.device_coverage ?? [],
      since: deviceStats.device_since ?? null,
      rows: deviceReport.rows,
      totals: { pv: deviceReport.totals.pv, ctr: deviceReport.totals.ctr, cv: deviceReport.totals.cv },
    }))
    deviceCache.set(device, loading)
    loading.catch(() => deviceCache.delete(device))
    return loading
  }

  const rebuild = (): void => {
    const specs: ColumnSpec[] = []
    for (const key of expandColumnKeys(selection, paramSelection, duplicates)) {
      const row = listRows.find((r) => r.entity_uid === key.versionUid)
      if (row === undefined) continue
      specs.push({
        versionUid: key.versionUid,
        versionName: row.name,
        metric: key.metric,
        param: key.param,
        html: lpSources?.versions.get(key.versionUid)?.html ?? '',
        css: lpSources?.versions.get(key.versionUid)?.css ?? '',
        pv: row.pv,
        ctr: row.ctr,
        cv: row.cv,
      })
    }
    renderHeatmapColumns(columnHost, sortColumnSpecs(specs, columnOrder), {
      stats: stats.versions,
      statsByParam,
      totals: { pv: report.totals.pv, ctr: report.totals.ctr, cv: report.totals.cv },
      externalHtml: externalPage?.html ?? null,
      styleCss: lpSources?.styleCss ?? '',
      range: { startDate: range.startDate, endDate: range.endDate },
      fullPage: isFullPageSelected(root),
      loadDevice,
      onDuplicate: (target) => {
        const key = columnKeyOf({
          versionUid: target.versionUid,
          metric: target.metric,
          param: target.param ?? '',
        })
        duplicates.set(key, (duplicates.get(key) ?? 0) + 1)
        rebuild()
      },
      onHide: (target) => {
        const param = target.param ?? ''
        const key = columnKeyOf({ versionUid: target.versionUid, metric: target.metric, param })
        const copies = duplicates.get(key) ?? 0
        // 複製したぶんが残っていれば、まず1枚だけ閉じる
        if (copies > 0) {
          duplicates.set(key, copies - 1)
          rebuild()
          return
        }
        // 最後の1枚は、左のチェックを外して閉じる（画面と一覧の状態を揃える）。
        // 広告で絞っている列はその広告だけ、絞っていない列は指標そのものを外す。
        const box =
          param === ''
            ? metricBoxes.get(`${target.versionUid}|${target.metric}`)
            : paramBoxes.get(`${target.versionUid}|${param}`)
        if (box === undefined) return
        box.checked = false
        box.dispatchEvent(new Event('change'))
      },
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

  // 並び替えのあとも同じ配線を使う（以前は渡し忘れていて、並び替えるとチェックが死んでいた）
  const onToggle = (versionUid: string, metric: HeatmapMetric, on: boolean): void => {
    const key = `${versionUid}|${metric}`
    if (on) selection.add(key)
    else selection.delete(key)
    void ensureLpSources().then(rebuild)
  }
  /**
   * 広告パラメータのチェック。絞り込んだ集計はまだ手元に無いので、必要になってから取りに行く。
   * 先に全部取ると、広告が多いページで無駄に重くなる。
   */
  const onParamToggle = (versionUid: string, param: string, on: boolean): void => {
    const key = `${versionUid}|${param}`
    if (on) paramSelection.add(key)
    else paramSelection.delete(key)
    if (!on || statsByParam.has(param)) {
      rebuild()
      return
    }
    void api
      .heatmapStats(abTestUid, `${toRangeQuery(range)}&param=${encodeURIComponent(param)}`)
      .then((filtered) => {
        statsByParam.set(param, filtered.versions)
        rebuild()
      })
      .catch(() => {
        // 取れなければ合算のまま出す（列が消えるより、数字が合算であるほうが分かる）
        rebuild()
      })
  }

  /**
   * 左の一覧を描く。並び替え・絞り込みでも同じ道を通す。
   * 描き直すとチェックボックスの実体が入れ替わるので、覚え直す。
   */
  const drawList = (rowsToDraw: readonly ReportVersionRow[]): void => {
    // 先に空にする。描いたあとに空にすると、描くときに預かったものまで捨ててしまう。
    metricBoxes.clear()
    paramBoxes.clear()
    renderVersionList(root, rowsToDraw, onToggle, selection, {
      parameters: stats.parameters,
      selected: paramSelection,
      onToggle: onParamToggle,
      register: (key, box) => paramBoxes.set(key, box),
    })
    registerMetricBoxes(root, rowsToDraw, metricBoxes)
  }

  drawList(listRows)
  // 開いた直後は何もチェックされておらず右側が空になる。ユーザーからは
  // 「反映されていない／壊れている」に見えるので、実測データが一番多い行を既定で開く。
  openDefaultRow(root, listRows, stats.versions)

  // 並び替え・絞り込みでも外部LPの行を残す（report.rows を渡すと消えていた）
  wireSortSelect(root, listRows, drawList)
  wireHeightTypeTabs(root, rebuild)
  wireSortModal(root, (label) => {
    columnOrder = label
    rebuild()
  })
  wireRangeInputs(root, range, (next) => {
    // 期間を変えたら、その期間で取り直す（ハッシュは同じなので自前で描き直す）
    void renderHeatmap(container, abTestUid, generation, next)
  })
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

/** 左の行に並べる広告パラメータの配線 */
interface ParamListDeps {
  parameters: readonly HeatmapParameter[]
  /** 今チェックされている `versionUid|utm_source=fb` */
  selected: ReadonlySet<string>
  onToggle: (versionUid: string, param: string, on: boolean) => void
  /** カードの「非表示にする」から外せるように、作ったチェックボックスを預ける */
  register?: (key: string, box: HTMLInputElement) => void
}

function renderVersionList(
  root: HTMLElement,
  rows: readonly ReportVersionRow[],
  onToggle?: ToggleColumn,
  /** 今チェックされている `versionUid|metric`。並び替えても選択を保つために渡す */
  selection?: ReadonlySet<string>,
  params?: ParamListDeps,
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
    wireOverlayTabs(item, activeToken, row.entity_uid, onToggle, selection)
    if (params !== undefined) renderParamOptions(item, row.entity_uid, params)
    return item
  })
  list.replaceChildren(...items)
}

/**
 * 各Versionの「離脱 / CLICK / CV」タブ（実物はチェックボックス）。
 * 選択状態そのものは実物のUI状態なので配線する。
 * 表示するヒートマップのデータは無いので、右側は変わらない（注記で明示する）。
 */
/**
 * 行の下に「来た広告パラメータ」を並べる（実物の `_paramsOption_` と `_viewMore_`）。
 *
 * 採取物の器（`_params_`）には「パラメーターなし」しか入っていない。
 * 実際に広告パラメータが来ているVersionでは、実物と同じ形の
 * `<label><input type="checkbox"><span>utm_source=fb</span></label>` を並べ、
 * 末尾に「元に戻す」（全部外して合算に戻す）を置く。
 */
function renderParamOptions(item: HTMLElement, versionUid: string, deps: ParamListDeps): void {
  const host = item.querySelector<HTMLElement>('[class*="_params_"]')
  if (host === null) return
  const list = paramsForVersion(deps.parameters, versionUid)
  // 1件も来ていないVersionは採取物のまま（「パラメーターなし」）
  if (list.length === 0) return

  const optionClass = findClassToken(host, '_paramsOption_') ?? '_paramsOption_1vzzn_199'
  const viewMoreClass = findClassToken(host, '_viewMore_') ?? '_viewMore_1vzzn_219'
  const ul = document.createElement('ul')
  ul.className = '_unstyled_1ahjy_1'
  for (const entry of list) {
    const li = document.createElement('li')
    li.className = optionClass
    const label = document.createElement('label')
    const box = document.createElement('input')
    box.type = 'checkbox'
    box.checked = deps.selected.has(`${versionUid}|${entry.param}`)
    const text = document.createElement('span')
    text.textContent = entry.param
    // 実物と同じく、長い値は枠の中で横に流れる（採取CSS: `white-space:nowrap; overflow:scroll`）。
    // 全部読むのに横スクロールが要るので、PVと一緒に title で添えておく。
    const hint = `${entry.param}（PV: ${entry.pv.toLocaleString('ja-JP')}）`
    label.title = hint
    text.title = hint
    box.addEventListener('change', () => deps.onToggle(versionUid, entry.param, box.checked))
    deps.register?.(`${versionUid}|${entry.param}`, box)
    label.append(box, text)
    li.append(label)
    ul.append(li)
  }
  const reset = document.createElement('div')
  reset.className = viewMoreClass
  const resetText = document.createElement('span')
  resetText.textContent = '元に戻す'
  reset.append(resetText)
  reset.addEventListener('click', () => {
    for (const box of ul.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')) {
      if (!box.checked) continue
      box.checked = false
      box.dispatchEvent(new Event('change'))
    }
  })
  host.replaceChildren(ul, reset)
}

/**
 * 左の「離脱 / CLICK / CV」チェックを覚えておく。
 * カードの「非表示にする」を押したときに、ここから外して画面と一覧を揃える。
 * 行の並びは listRows と同じ順なので、添字で結びつけられる。
 */
function registerMetricBoxes(
  root: HTMLElement,
  rows: readonly ReportVersionRow[],
  into: Map<string, HTMLInputElement>,
): void {
  const order: HeatmapMetric[] = ['exit', 'click', 'cv']
  const items = [...root.querySelectorAll<HTMLElement>('[class*="_articleList_"] ul[class*="_body_"] > li')]
  items.forEach((item, index) => {
    const row = rows[index]
    if (row === undefined) return
    const boxes = [...item.querySelectorAll<HTMLInputElement>('[class*="_tab_"] input[type="checkbox"]')]
    boxes.forEach((box, i) => {
      const metric = order[i]
      if (metric !== undefined) into.set(`${row.entity_uid}|${metric}`, box)
    })
  })
}

/** 採取CSSにある「選んだ」状態のクラス（DOM側は未チェックの初期状態しか採れていない） */
const CHECKED_CLASS = '_checked_1vzzn_155'

function wireOverlayTabs(
  item: HTMLElement,
  activeToken: string | null,
  versionUid: string,
  onToggle?: ToggleColumn,
  selection?: ReadonlySet<string>,
): void {
  // 実物の並びは 離脱 / CLICK / CV の3つ。チェックした数だけ右に列が増える。
  const order: HeatmapMetric[] = ['exit', 'click', 'cv']
  const tabs = [...item.querySelectorAll<HTMLElement>('[class*="_tab_"]')]
  tabs.forEach((tab, i) => {
    const box = tab.querySelector<HTMLInputElement>('input[type="checkbox"]')
    if (box === null) return
    const metric = order[i]
    // 並び替え・絞り込みで作り直したときに、選んでいた状態を戻す
    // 採取DOMは未チェックの初期状態なので、DOMからは拾えない。採取CSSにある実クラス名を使う
    // （`capture/clean/ab_tests__UID__articles__htmls__heatmaps__comparisons/default/cssom.css` の
    //  `._tab_1vzzn_144._checked_1vzzn_155{border-top:3px solid rgb(208,83,83)}` ほか）
    const checkedToken = findClassToken(tab, '_checked_') ?? CHECKED_CLASS
    if (metric !== undefined && selection?.has(`${versionUid}|${metric}`) === true) {
      box.checked = true
      if (activeToken !== null) {
        tab.classList.add(activeToken)
        item.classList.add(activeToken)
      }
      tab.classList.add(checkedToken)
    }
    box.addEventListener('change', () => {
      // 採取物は「選んだ（_checked_）」と「今見ている（_active_）」を別の状態として持つ
      tab.classList.toggle(checkedToken, box.checked)
      if (activeToken !== null) {
        tab.classList.toggle(activeToken, box.checked)
        // 行そのものも、どれか1つでもチェックされていれば選択中の見た目にする。
        // 数えるのは指標のタブだけ（下に広告パラメータのチェックが並ぶので、
        // 行全体から拾うと「広告を選んだだけ」で行が選択中に見えてしまう）。
        const anyChecked = [
          ...item.querySelectorAll<HTMLInputElement>('[class*="_tab_"] input[type="checkbox"]'),
        ].some((b) => b.checked)
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
  // 開くのは指標のタブ（広告パラメータのチェックではない）
  const box = items[bestIndex]?.querySelector<HTMLInputElement>('[class*="_tab_"] input[type="checkbox"]')
  if (box === undefined || box === null || box.checked) return
  box.checked = true
  box.dispatchEvent(new Event('change', { bubbles: true }))
}

/** 並び替え（PV / CLICK / CTR / CV / CVR） */
function wireSortSelect(
  root: HTMLElement,
  rows: readonly ReportVersionRow[],
  draw: (rows: readonly ReportVersionRow[]) => void,
): void {
  const selects = [...root.querySelectorAll<HTMLSelectElement>('[class*="_filters_"] select')]
  const sortSelect = selects[0]
  const filterSelect = selects[1]

  /** 並び替えと絞り込みを両方かけて描き直す（どちらを触っても同じ道を通す） */
  const apply = (): void => {
    // 実物の既定は「アーカイブ無し」＝アーカイブ済みを除く（採取物の option の並び順）
    const showArchived = filterSelect?.value === 'true'
    const visible = showArchived ? rows : rows.filter((row) => row.archived !== true)
    const sorted = sortVersions(visible, (sortSelect?.value ?? '') as HeatmapSortKey) ?? visible
    draw(sorted)
  }

  sortSelect?.addEventListener('change', apply)
  filterSelect?.addEventListener('change', apply)
  apply()
}

/** 「スクロール表示 / 全ページ表示」のどちらが選ばれているか（文字で判定する） */
function isFullPageSelected(root: HTMLElement): boolean {
  const group = root.querySelector<HTMLElement>('[class*="_selectHeightType_"]')
  if (group === null) return false
  const full = [...group.querySelectorAll<HTMLElement>('[class*="_item_"]')].find(
    (item) => (item.textContent ?? '').trim() === '全ページ表示',
  )
  if (full === undefined) return false
  return [...full.classList].some((name) => name.includes('_active_'))
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

/**
 * ソートモーダルのラジオ（実物の9択）。実物は name が無いので排他はこちらで面倒を見る。
 * 2026-09-15: 選んだ順を実際に列の並びへ反映するようにした（以前は排他だけで何も起きなかった）。
 */
function wireSortModal(root: HTMLElement, onChange: (label: string) => void): void {
  const modal = root.querySelector<HTMLElement>('[class*="_sortModal_"]')
  if (modal === null) return
  const radios = [...modal.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
  for (const radio of radios) {
    radio.addEventListener('change', () => {
      for (const other of radios) other.checked = other === radio
      // ラベルは採取物の文字（「PVの多い順」など）。親のテキストから読む
      const label = (radio.closest('label')?.textContent ?? radio.parentElement?.textContent ?? '')
        .trim()
      onChange(label)
    })
  }
  modal.append(
    cloneNote('「手動」（ドラッグで並べ替え）はまだできません。他の並び順は列に効きます。'),
  )
}

/**
 * ソートモーダルで選んだ順に列を並べ替える（採取物の9択の文字で判断する）。
 * 「手動」と、判断できない文字はそのままの順で返す。
 */
export function sortColumnSpecs<T extends { versionName: string; pv: number; cv: number; ctr: number | null }>(
  specs: readonly T[],
  label: string,
): readonly T[] {
  const by = (pick: (s: T) => number, asc: boolean): T[] =>
    [...specs].sort((a, b) => (asc ? pick(a) - pick(b) : pick(b) - pick(a)))
  if (label.includes('PVの多い順')) return by((s) => s.pv, false)
  if (label.includes('PVの少ない順')) return by((s) => s.pv, true)
  if (label.includes('CVの多い順')) return by((s) => s.cv, false)
  if (label.includes('CVの少ない順')) return by((s) => s.cv, true)
  if (label.includes('CTRの高い順')) return by((s) => s.ctr ?? -1, false)
  if (label.includes('CTRの低い順')) return by((s) => s.ctr ?? -1, true)
  if (label.includes('Versionの新しい順')) return [...specs].reverse()
  if (label.includes('Versionの古い順')) return [...specs]
  return specs
}

/**
 * 期間の入力。実物はカレンダー（litepicker）をポータルに開くが、その状態は採取していない。
 * 発明せずに、同じ2つの入力をブラウザ標準の日付入力にして変えられるようにする（2026-09-15）。
 */
function wireRangeInputs(
  root: HTMLElement,
  range: DateRange,
  onChange: (next: DateRange) => void,
): void {
  const inputs = [...root.querySelectorAll<HTMLInputElement>('input[type="text"][readonly]')]
  const start = inputs[0]
  const end = inputs[1]
  if (start === undefined || end === undefined) return
  for (const [input, value] of [[start, range.startDate], [end, range.endDate]] as const) {
    input.type = 'date'
    input.readOnly = false
    input.value = value
    input.style.cursor = 'pointer'
    input.addEventListener('change', () => {
      const a = start.value
      const b = end.value
      if (a === '' || b === '') return
      onChange(a <= b ? { startDate: a, endDate: b } : { startDate: b, endDate: a })
    })
  }
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
