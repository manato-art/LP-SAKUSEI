/**
 * ページ一覧の上の操作（配信ステータスの絞り込み・並び替え・フォルダ内検索・集計期間）と、
 * それを行に当てる描き直し（2026-09-24・folders.ts から分離）。
 *
 * ラベル・メニュー・行・合計行は、どれも folders-list-state.ts の1つの状態から作る。
 * 以前は、ラベルが採取物の「終了以外」のまま・選んでもラベルが変わらない・フォルダを切り替えると
 * 行に効いていない・「更新順」は押しても何も起きない、とばらばらだった。
 */
import { T } from '../ui.ts'
import { openPeriodPicker } from '../panels/period-picker.ts'
import { FOLDERS_HOOK } from './folders-substrate.ts'
import type { PageContext } from './folders-shared.ts'
import { listState, updateListState } from './folders-list-state.ts'
import {
  SORT_OPTIONS,
  STATUS_FILTER_OPTIONS,
  isPageVisible,
  sortLabel,
  sortPages,
  statusFilterLabel,
} from './folders-list-view.ts'
import {
  applyListMetrics,
  applyTotalRow,
  getListRange,
  setListRange,
  setPeriodLabel,
} from './folders-list-metrics.ts'

/** 読めたページの PV/CV（PV順・CV順に使う）。描き直すたびに読み直す */
let loadedMetrics: ReadonlyMap<string, { pv: number; cv: number }> = new Map()

const SORT_BUTTON_MARK = 'data-clone-sort-button'

/** 行の器（`list-menu-item` を含む直下の要素）を uid で引けるようにする */
function rowWrappers(main: HTMLElement): HTMLElement[] {
  const container = main.querySelector<HTMLElement>(FOLDERS_HOOK.pageRowList)
  if (container === null) return []
  return [...container.children].filter(
    (child): child is HTMLElement => child instanceof HTMLElement && child.dataset['abTestUid'] !== undefined,
  )
}

/**
 * 並び替え・絞り込みを行に当て、ラベルと合計行を今の状態に合わせる。
 * 行そのものは作り直さない（順番と表示/非表示だけ変える）。
 */
export function refreshListView(main: HTMLElement, context: PageContext): void {
  const state = listState()
  const rows = rowWrappers(main)
  const byUid = new Map(rows.map((row) => [row.dataset['abTestUid'] ?? '', row]))
  const last = rows.at(-1)
  const tail = last?.nextSibling ?? null
  const parent = last?.parentElement ?? null
  const ordered = sortPages(context.abTests, state.sort, loadedMetrics)
  const visibleUids: string[] = []
  for (const page of ordered) {
    const row = byUid.get(page.uid)
    if (row === undefined || parent === null) continue
    parent.insertBefore(row, tail)
    const visible = isPageVisible(page, { status: state.status, query: state.pageQuery ?? '' })
    row.style.display = visible ? '' : 'none'
    if (visible) visibleUids.push(page.uid)
  }
  paintStatusLabel(main)
  paintSortLabel(main)
  if (context.folderUid !== null) void applyTotalRow(main, context.folderUid, visibleUids)
}

/** 行のKPIを読み直す。PV順・CV順のときは、読めたところで並べ直す */
export async function reloadListMetrics(main: HTMLElement, context: PageContext): Promise<void> {
  loadedMetrics = new Map()
  loadedMetrics = await applyListMetrics(main)
  refreshListView(main, context)
}

function paintStatusLabel(main: HTMLElement): void {
  const select = main.querySelector<HTMLElement>(FOLDERS_HOOK.adStatusSelect)
  const label = [...(select?.querySelectorAll<HTMLElement>('span') ?? [])].find((span) =>
    (span.textContent ?? '').startsWith('配信ステータス'),
  )
  if (label !== undefined) label.textContent = statusFilterLabel(listState().status)
}

function sortButton(main: HTMLElement): HTMLElement | null {
  const marked = main.querySelector<HTMLElement>(`[${SORT_BUTTON_MARK}]`)
  if (marked !== null) return marked
  const labels = new Set(SORT_OPTIONS.map((o) => o.label))
  const span = [...main.querySelectorAll<HTMLElement>('.en4zj403 span')].find((s) =>
    labels.has((s.textContent ?? '').trim()),
  )
  const button = span?.closest<HTMLElement>('button') ?? null
  button?.setAttribute(SORT_BUTTON_MARK, 'true')
  return button
}

function paintSortLabel(main: HTMLElement): void {
  const button = sortButton(main)
  const label = button?.querySelector<HTMLElement>('span')
  if (label !== null && label !== undefined) label.textContent = sortLabel(listState().sort)
}

// ── 小さなメニュー（配信ステータス・並び替えで共通）──────────────
let openMenu: HTMLElement | null = null

interface MenuItem {
  label: string
  selected: boolean
  disabled?: boolean
  hint?: string
  onSelect: () => void
}

function showMenu(anchor: HTMLElement, items: readonly MenuItem[]): void {
  if (openMenu !== null) {
    openMenu.remove()
    openMenu = null
    return
  }
  const menu = document.createElement('div')
  menu.setAttribute('role', 'menu')
  menu.style.cssText = [
    'position:fixed;z-index:9999',
    `background:${T.surface};border-radius:8px`,
    'box-shadow:0 4px 16px rgba(0,0,0,.15)',
    'min-width:160px;padding:4px 0',
    `font-family:${T.font};font-size:13px`,
  ].join(';')
  for (const item of items) {
    const row = document.createElement('div')
    row.setAttribute('role', 'menuitemradio')
    row.setAttribute('aria-checked', String(item.selected))
    row.textContent = item.label
    if (item.hint !== undefined) row.title = item.hint
    const color = item.disabled === true ? T.sub : T.text
    row.style.cssText = `padding:8px 16px;cursor:${item.disabled === true ? 'default' : 'pointer'};color:${color}${item.selected ? ';font-weight:700' : ''}`
    row.addEventListener('mouseenter', () => {
      if (item.disabled !== true) row.style.background = 'rgba(0,0,0,.04)'
    })
    row.addEventListener('mouseleave', () => {
      row.style.background = 'transparent'
    })
    row.addEventListener('click', (event) => {
      event.stopPropagation()
      if (item.disabled === true) return
      menu.remove()
      openMenu = null
      item.onSelect()
    })
    menu.append(row)
  }
  const rect = anchor.getBoundingClientRect()
  menu.style.top = `${rect.bottom + 4}px`
  menu.style.left = `${rect.left}px`
  document.body.append(menu)
  openMenu = menu
  requestAnimationFrame(() => {
    const close = (): void => {
      menu.remove()
      if (openMenu === menu) openMenu = null
      document.removeEventListener('click', close)
    }
    document.addEventListener('click', close)
  })
}

function openStatusMenu(anchor: HTMLElement, main: HTMLElement, context: PageContext): void {
  showMenu(
    anchor,
    STATUS_FILTER_OPTIONS.map((option) => ({
      label: option.label,
      selected: option.value === listState().status,
      onSelect: () => {
        updateListState({ status: option.value })
        refreshListView(main, context)
      },
    })),
  )
}

function openSortMenu(anchor: HTMLElement, main: HTMLElement, context: PageContext): void {
  const metricsReady = loadedMetrics.size > 0
  showMenu(
    anchor,
    SORT_OPTIONS.map((option) => ({
      label: option.label,
      selected: option.value === listState().sort,
      disabled: option.needsMetrics && !metricsReady,
      hint: option.needsMetrics ? '集計期間の数値の多い順（数値を読み込んでから選べます）' : undefined,
      onSelect: () => {
        updateListState({ sort: option.value })
        refreshListView(main, context)
      },
    })),
  )
}

// ── フォルダ内検索（ページ名）─────────────────────────
function searchInputStyle(): string {
  return `width:100%;box-sizing:border-box;padding:6px 10px;border:1px solid var(--sb-c-dddddd, #DDDDDD);border-radius:4px;font-size:12px;outline:none;font-family:${T.font}`
}

/** 検索欄を出す（開いていれば、いま効いている文字を入れて出す） */
function mountPageSearch(main: HTMLElement, context: PageContext, focus: boolean): void {
  const container = main.querySelector<HTMLElement>(FOLDERS_HOOK.pageRowList)
  if (container === null || main.querySelector('[data-clone-page-search]') !== null) return
  const bar = document.createElement('div')
  bar.dataset['clonePageSearch'] = 'true'
  bar.style.cssText = 'padding:4px 8px'
  const input = document.createElement('input')
  input.type = 'text'
  input.placeholder = 'ページを検索...'
  input.value = listState().pageQuery ?? ''
  input.style.cssText = searchInputStyle()
  input.addEventListener('input', () => {
    updateListState({ pageQuery: input.value.trim().toLowerCase() })
    refreshListView(main, context)
  })
  bar.append(input)
  container.before(bar)
  if (focus) requestAnimationFrame(() => input.focus())
}

function togglePageSearch(main: HTMLElement, context: PageContext): void {
  const open = main.querySelector<HTMLElement>('[data-clone-page-search]')
  if (open !== null) {
    open.remove()
    updateListState({ pageQuery: null })
    refreshListView(main, context)
    return
  }
  updateListState({ pageQuery: '' })
  mountPageSearch(main, context, true)
}

/** 一覧の上の操作を配線する。描き直しのあとも、効いている検索は欄ごと見せる */
export function wireListControls(main: HTMLElement, context: PageContext): void {
  const folderSearchBtn = main.querySelector<HTMLElement>(FOLDERS_HOOK.folderSearchButton)
  if (folderSearchBtn !== null) {
    folderSearchBtn.style.cursor = 'pointer'
    folderSearchBtn.addEventListener('click', () => togglePageSearch(main, context))
  }
  if (listState().pageQuery !== null) mountPageSearch(main, context, false)

  const statusSelect = main.querySelector<HTMLElement>(FOLDERS_HOOK.adStatusSelect)
  if (statusSelect !== null) {
    statusSelect.style.cursor = 'pointer'
    statusSelect.addEventListener('click', () => openStatusMenu(statusSelect, main, context))
  }

  const sort = sortButton(main)
  if (sort !== null) {
    sort.style.cursor = 'pointer'
    sort.addEventListener('click', () => openSortMenu(sort, main, context))
  }

  // 集計期間: 採取物にUIが無いためクローン独自のピッカーを出し、KPI列と合計行を実データで更新する。
  const periodSelect = main.querySelector<HTMLElement>(FOLDERS_HOOK.periodSelect)
  if (periodSelect !== null) {
    periodSelect.style.cursor = 'pointer'
    setPeriodLabel(periodSelect)
    periodSelect.addEventListener('click', () => {
      openPeriodPicker(periodSelect, getListRange(), (range) => {
        setListRange(range)
        setPeriodLabel(periodSelect)
        void reloadListMetrics(main, context)
      })
    })
  }
  paintStatusLabel(main)
  paintSortLabel(main)
}
