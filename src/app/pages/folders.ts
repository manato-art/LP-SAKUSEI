/**
 * 「ページ」画面（`/folders`）。企画書 §1-4 の基準状態から、
 * フォルダ作成 → beyondページ作成 → エディタへ、という作成フローが実際に通る。
 *
 * ## 作り方（企画書 §11 capture-and-rehydrate・共通指示 §2）
 *
 * 見た目は**採取した実DOM**（`fragments/folders__detail.html`＝フォルダ選択後の状態。
 * KPI列つきのページ一覧＋右の詳細パネルまで入っている）と実CSSが担う。手書きで似せていない。
 * クラス名は Emotion / styled-components が振った実物のまま。CSSは1行も書き足していない。
 * レイアウトの実体は Emotion の `css-*` ルールで、`tools/rehydrate/merge-cssom.mjs` が
 * 採取済みの全 cssom を union して `/clean/_merged/cssom.css` に束ね、`src/index.html` が読む。
 * （この一覧・パネルの `css-*` は他画面に無いので、detail を採取するまで無地に崩れていた。）
 *
 * 配線は `folders-substrate.ts` の `FOLDERS_HOOK`（実在する `data-testid` と実クラス）だけを掴む：
 *   - 左ツリーの行はモックのフォルダで置き換える（`FOLDER_ROW_TEMPLATE` を複製）。
 *   - 中央のページ行（`list-menu-item`）はクリックでモックのbeyondページのエディタへ。
 *   - 右パネルの「パラメータ付きURLの発行」→ URL発行モーダル、「コピー」→ 配信URLコピー。
 * 目印が採取物に在ることは `tests/folders.test.ts` が採取HTMLと突き合わせて機械証明している。
 *
 * ## 実物どおりに出しているが、値は採取物のまま（作り足していない・正直に出す）
 *
 * KPI列の数値・アイコン件数・右パネルの各フィールドは**採取した実データ（匿名化済み）**を
 * そのまま見せている。モックの1件ごとに全KPIセルを差し替える配線は入れていない
 * （見た目の忠実さを優先し、推測で数値を作らない）。ページ行のクリック先だけモックへ束ねる。
 */
import substrate from '../fragments/folders__detail.html?raw'
import { isStale } from '../main.ts'
import { api, type Folder, type RelationCounts } from '../api.ts'
import { T, emptyState, toast } from '../ui.ts'
import {
  FOLDERS_HOOK,
  FOLDER_UID_ATTRIBUTE,
  TAB_CLASS,
  extractFolderRowTemplate,
} from './folders-substrate.ts'
import { openCreateFolder, openCreatePage } from './folders-create.ts'
import { openPeriodPicker } from '../panels/period-picker.ts'
import { openFolderMenu } from '../panels/folder-menu.ts'
import { AD_STATUS_LABELS, type PageContext } from './folders-shared.ts'
import {
  applyListMetrics,
  getListRange,
  setListRange,
  setPeriodLabel,
} from './folders-list-metrics.ts'
import { renderRealList } from './folders-page-list.ts'
import { folderHistoryUids, recordHistory, renderHistoryList } from './folders-history.ts'
import { updateStarAppearance } from './folders-detail-panel.ts'

/** 採取物から切り出したフォルダ1行ぶんのマークアップ（読み込み時に一度だけ） */
const FOLDER_ROW_TEMPLATE = extractFolderRowTemplate(substrate)

/** 現在選ばれているタブ（画面描画をまたいで保持する）。 */
type TreeTab = 'すべて' | 'お気に入り' | '履歴'
let activeTreeTab: TreeTab = 'すべて'






export async function renderFolders(
  container: HTMLElement,
  params: URLSearchParams,
  generation: number,
): Promise<void> {
  container.innerHTML = ''
  // エディタが `height:100vh;overflow:hidden` を残していくので、シェルの既定へ戻す
  container.style.cssText = 'flex:1;min-width:0'

  const selectedUid = params.get('uid')
  const { folders } = await api.folders()
  // 取得を待つ間に別の描画が始まっていたら、ここで捨てる。
  // これが無いと2本の描画が並走し、レイアウトが2枚積まれる。
  if (isStale(generation)) return

  const detail = selectedUid === null ? null : await api.folderDetail(selectedUid)
  // 2本目のAPIのあとにも同じ確認が要る（フォルダを続けて切り替えると並走する）
  if (isStale(generation)) return

  // Version数/ポップアップ数/中間ページ数を取得
  let relationCounts: RelationCounts[] = []
  if (detail !== null && detail.ab_tests.length > 0) {
    const ids = detail.ab_tests.map((t) => t.id)
    try {
      const rc = await api.relationCounts(selectedUid as string, ids)
      relationCounts = rc.relation_counts
    } catch { /* 取得失敗でも画面は出す */ }
    if (isStale(generation)) return
  }

  const root = document.createElement('div')
  root.innerHTML = substrate
  // 断片は `#root` の中身そのままなので**グローバルサイドバーを含む**。
  // シェルが同じものを出しているため、ここでは本体側だけを残す（マークアップは書き換えていない）。
  const body = root.querySelector<HTMLElement>(FOLDERS_HOOK.body)
  if (body === null) {
    container.append(emptyState('ページ画面の土台が壊れています（本体が見つかりません）'))
    return
  }
  // 指示66: 採取CSSの `.css-4qo2ft` はサイドバー幅（60px）の左パディングを持つが、
  // シェルが同じサイドバーを既に描いているため、空白の帯になってしまう。
  // エディタ（キャンバス）で同様の修正を行ったのと同じ手法で除去する。
  body.style.paddingLeft = '0'
  root.replaceChildren(body)
  container.append(root)

  const context: PageContext = {
    folders,
    folder: detail?.folder ?? null,
    abTests: detail?.ab_tests ?? [],
    relationCounts,
  }

  // 選択したフォルダを履歴に記録
  if (selectedUid !== null) {
    const folderName = context.folder?.name ?? selectedUid
    recordHistory(selectedUid, folderName, 'folder', '閲覧')
  }

  renderTree(body, context)

  // 指示㊳: フォルダ未選択時はページ一覧・詳細パネルを表示しない（空状態）
  if (selectedUid === null) {
    hidePageListAndDetail(body)
  } else if (context.abTests.length === 0) {
    // 指示㊿再修正: 空状態メッセージは不要（そのまま何も出さない）
    hidePageListAndDetail(body)
  } else {
    renderRealList(body, context)
  }

  wireTreeTabs(body, context)
  wireTreeControls(body, context)
  wireMainControls(body, context)
  // 指示㊲: リサイズハンドルのドラッグで一覧と詳細パネルの幅を変える
  wireResizeHandle(body)
}

// ── 左: フォルダツリー ─────────────────────────────────

/**
 * 採取物のフォルダ行を捨て、モックのフォルダで置き換える。
 * 行のマークアップは採取物そのまま（`FOLDER_ROW_TEMPLATE`）を複製して使う。
 * アクティブタブ（すべて / お気に入り / 履歴）に応じてフィルタリングする。
 */
function renderTree(body: HTMLElement, context: PageContext): void {
  const list = body.querySelector<HTMLElement>(FOLDERS_HOOK.treeList)
  if (list === null) {
    console.warn('[folders]', FOLDERS_HOOK.treeList, 'が土台に見つかりませんでした')
    return
  }
  // 実物は `リスト容器 > div > (行ごとのdiv)` の入れ子。内側の器は残して中身だけ入れ替える。
  const rows = list.firstElementChild ?? list
  rows.replaceChildren()

  const prototypeRow = folderRowPrototype()
  if (prototypeRow === null) {
    console.warn('[folders] 採取物からフォルダ行のマークアップを取り出せませんでした')
    return
  }

  // 履歴タブは操作ログを表示
  if (activeTreeTab === '履歴') {
    renderHistoryList(rows)
    return
  }

  // タブに応じてフォルダをフィルタリング
  const filtered = filterFoldersByTab(context.folders)

  if (filtered.length === 0) {
    const msg = document.createElement('div')
    msg.style.cssText = 'padding:24px 16px;color:#999999;font-size:13px;text-align:center'
    msg.textContent =
      activeTreeTab === 'お気に入り'
        ? 'お気に入りのフォルダがありません'
        : 'フォルダがありません'
    rows.append(msg)
    return
  }

  const rerender = (): void => renderTree(body, context)
  for (const folder of filtered) {
    const wrapper = document.createElement('div')
    wrapper.append(folderRow(prototypeRow, folder, rerender))
    rows.append(wrapper)
  }
}

/** アクティブタブに応じてフォルダをフィルタリングする。検索クエリがあればさらに絞る。 */
function filterFoldersByTab(folders: readonly Folder[]): readonly Folder[] {
  let result: readonly Folder[]
  if (activeTreeTab === 'お気に入り') {
    result = folders.filter((f) => f.is_favorite)
  } else if (activeTreeTab === '履歴') {
    result = folderHistoryUids()
      .map((uid) => folders.find((f) => f.uid === uid))
      .filter((f): f is Folder => f !== undefined)
  } else {
    result = folders
  }
  // 検索クエリで絞り込み
  if (searchQuery !== '') {
    result = result.filter((f) => f.name.toLowerCase().includes(searchQuery))
  }
  return result
}



function folderRowPrototype(): HTMLElement | null {
  if (FOLDER_ROW_TEMPLATE === null) return null
  const holder = document.createElement('div')
  holder.innerHTML = FOLDER_ROW_TEMPLATE
  return holder.firstElementChild as HTMLElement | null
}

function folderRow(prototypeRow: HTMLElement, folder: Folder, rerender: () => void): HTMLElement {
  const row = prototypeRow.cloneNode(true) as HTMLElement
  row.setAttribute(FOLDER_UID_ATTRIBUTE, folder.uid)
  const name = row.querySelector<HTMLElement>(FOLDERS_HOOK.folderRowName)
  if (name === null) console.warn('[folders] フォルダ名の差し込み先が行に見つかりませんでした')
  else name.textContent = folder.name

  row.addEventListener('click', () => {
    const next = `#/folders?uid=${folder.uid}`
    if (location.hash !== next) location.hash = next
  })
  wireRowHover(row)
  wireRowActions(row, folder, rerender)
  return row
}

/**
 * ホバーで操作アイコン（お気に入り / 設定）が出る。
 * 実物は各アイコンに `style="opacity: 0"` をJSで当てており、その値が採取物に残っている。
 * 同じことをする（CSSは書き足さない）。
 */
function wireRowHover(row: HTMLElement): void {
  const hidden = Array.from(
    row.querySelectorAll<HTMLElement>(`${FOLDERS_HOOK.folderRowActions} [style]`),
  ).filter((node) => node.style.opacity === '0')
  if (hidden.length === 0) return
  row.addEventListener('mouseenter', () => {
    for (const node of hidden) node.style.opacity = '1'
  })
  row.addEventListener('mouseleave', () => {
    for (const node of hidden) node.style.opacity = '0'
  })
}

/**
 * 指示㊳: フォルダ未選択時、ページ一覧エリアと右詳細パネルの中身を空にする。
 * 採取した枠は残すが、データ行・詳細情報は表示しない。
 */
function hidePageListAndDetail(body: HTMLElement): void {
  // 一覧エリアの行を消す
  const listArea = body.querySelector<HTMLElement>(FOLDERS_HOOK.listArea)
  if (listArea !== null) {
    const container = listArea.querySelector<HTMLElement>(FOLDERS_HOOK.pageRowList)
    if (container !== null) {
      // 行ラッパーを全削除（ヘッダは残す）
      const rowWrappers = Array.from(container.children).filter(
        (child): child is HTMLElement =>
          child.querySelector('[data-testid="list-menu-item"]') !== null,
      )
      for (const wrapper of rowWrappers) wrapper.remove()
      // スピナーも消す
      for (const spinner of container.querySelectorAll<HTMLElement>('[role="progressbar"]')) {
        const wrapper = spinner.closest<HTMLElement>(`${FOLDERS_HOOK.pageRowList} > div`)
        ;(wrapper ?? spinner).style.display = 'none'
      }
    }
    // グループ名を消す
    const groupName = listArea.querySelector<HTMLElement>(FOLDERS_HOOK.groupName)
    if (groupName !== null) groupName.textContent = ''
    // 指示141: 何も選択していない時に残る採取由来のモックを消す。
    //   - 列ラベル行（配信ステータス/配信金額/PV/Click…）= `.efy50tl8`
    //   - 合計KPI行（¥0/1,031/141… の採取フェイク値＋並び替え）= `.en4zj406`
    // どちらも実データではないので、未選択時は帯ごと隠す（「まだ何も表示しない」）。
    for (const mock of listArea.querySelectorAll<HTMLElement>('.efy50tl8, .en4zj406')) {
      mock.style.display = 'none'
    }
  }
  // 右詳細パネルを非表示にする
  const panel = body.querySelector<HTMLElement>(FOLDERS_HOOK.detailPanel)
  if (panel !== null) panel.style.display = 'none'
  // 指示141: 詳細パネルの「見出し」（"サンプル施策466" 等）はパネル本体(.efy50tl16)の
  // 外側にあるため上の display:none では消えない。見出し行 `.efy50tl4` も隠す。
  const panelHeader = body.querySelector<HTMLElement>('.efy50tl4')
  if (panelHeader !== null) panelHeader.style.display = 'none'
}

// ── 中央: beyondページ一覧（採取した実KPI一覧をモックの現実に束ねる）──────




















/** URL発行/コピーの元になる配信URL。モックのbeyondページがあればそれを、無ければパネル表示値を使う。 */



// ── タブ切り替え（すべて / お気に入り / 履歴）────────────────

/**
 * タブのクリックでフォルダツリーを切り替える。
 * 実物は css-7nmmet がアクティブ、css-aifqgm が非アクティブ。
 * クリック時にクラスを入れ替え、ツリーを描き直す。
 */
function wireTreeTabs(body: HTMLElement, context: PageContext): void {
  const tabs = body.querySelectorAll<HTMLElement>(FOLDERS_HOOK.treeTab)
  if (tabs.length === 0) return

  // 初期状態をアクティブタブに合わせる
  for (const tab of tabs) {
    const label = (tab.textContent ?? '').trim()
    applyTabStyle(tab, label === activeTreeTab)
  }

  for (const tab of tabs) {
    const rawLabel = (tab.textContent ?? '').trim()
    if (rawLabel === '') continue
    const label = rawLabel as TreeTab
    tab.style.cursor = 'pointer'
    tab.addEventListener('click', () => {
      if (activeTreeTab === label) return
      activeTreeTab = label
      // 全タブのスタイルを更新
      for (const t of tabs) {
        const tLabel = (t.textContent ?? '').trim()
        applyTabStyle(t, tLabel === label)
      }
      // ツリーを描き直し
      renderTree(body, context)
    })
  }
}

/** タブ要素のアクティブ/非アクティブ切り替え。クラスを入れ替えるだけでCSSが効く。 */
function applyTabStyle(tab: HTMLElement, isActive: boolean): void {
  if (isActive) {
    tab.classList.remove(TAB_CLASS.inactive)
    tab.classList.add(TAB_CLASS.active)
  } else {
    tab.classList.remove(TAB_CLASS.active)
    tab.classList.add(TAB_CLASS.inactive)
  }
}

// ── 採取物に在るが、挙動を採取できていないもの ────────────────

// ── 集計期間 と 一覧のKPI列 ───────────────────────────





/** フォルダツリーの検索バーを表示/非表示する */
let searchInput: HTMLInputElement | null = null
let searchQuery = ''

function wireTreeControls(body: HTMLElement, context: PageContext): void {
  const tree = body.querySelector<HTMLElement>(FOLDERS_HOOK.tree)
  if (tree === null) {
    console.warn('[folders]', FOLDERS_HOOK.tree, 'が土台に見つかりませんでした')
    return
  }
  // 新規フォルダ作成ボタン
  const create = tree.querySelector(FOLDERS_HOOK.createFolderIcon)?.closest('button') ?? null
  if (create === null) console.warn('[folders] 新規フォルダ作成のボタンが土台に見つかりませんでした')
  else create.addEventListener('click', openCreateFolder)

  // 検索ボタン: クリックで検索バーをトグル
  const searchBtn = tree.querySelector(FOLDERS_HOOK.treeSearchIcon)?.closest('button') ?? null
  if (searchBtn !== null) {
    searchBtn.addEventListener('click', () => {
      toggleTreeSearch(tree, context)
    })
  }
}

function toggleTreeSearch(tree: HTMLElement, context: PageContext): void {
  if (searchInput !== null) {
    // 閉じる
    searchInput.parentElement?.remove()
    searchInput = null
    searchQuery = ''
    renderTree(tree.closest(FOLDERS_HOOK.body) as HTMLElement, context)
    return
  }
  // 検索バーを挿入（ツリーのリスト容器の直前）
  const list = tree.querySelector<HTMLElement>(FOLDERS_HOOK.treeList)
  if (list === null) return

  const bar = document.createElement('div')
  bar.style.cssText = 'padding:4px 8px'

  const input = document.createElement('input')
  input.type = 'text'
  input.placeholder = 'フォルダを検索...'
  input.value = searchQuery
  input.style.cssText = `width:100%;box-sizing:border-box;padding:6px 10px;border:1px solid var(--sb-c-dddddd, #DDDDDD);border-radius:4px;font-size:12px;outline:none;font-family:${T.font}`
  input.addEventListener('input', () => {
    searchQuery = input.value.trim().toLowerCase()
    const bodyEl = tree.closest(FOLDERS_HOOK.body) as HTMLElement
    if (bodyEl !== null) renderTree(bodyEl, context)
  })
  input.addEventListener('focus', () => {
    input.style.borderColor = 'var(--sb-accent, #0091FF)'
  })
  input.addEventListener('blur', () => {
    input.style.borderColor = 'var(--sb-c-dddddd, #DDDDDD)'
  })

  bar.append(input)
  list.before(bar)
  searchInput = input
  requestAnimationFrame(() => input.focus())
}

function wireMainControls(body: HTMLElement, context: PageContext): void {
  const main = body.querySelector<HTMLElement>(FOLDERS_HOOK.mainPane)
  if (main === null) {
    console.warn('[folders]', FOLDERS_HOOK.mainPane, 'が土台に見つかりませんでした')
    return
  }

  // 「+ 新規ページを作成」ボタン
  const createPageBtn =
    main.querySelector(FOLDERS_HOOK.createPageIcon)?.closest('button') ?? null
  if (createPageBtn !== null) {
    createPageBtn.style.cursor = 'pointer'
    createPageBtn.addEventListener('click', () => {
      if (context.folder === null) {
        toast('フォルダを選択してからページを作成してください', 'error')
        return
      }
      void openCreatePage(context.folder)
    })
  }

  // フォルダ内検索: ページタイトルでフィルタ
  const folderSearchBtn = main.querySelector<HTMLElement>(FOLDERS_HOOK.folderSearchButton)
  if (folderSearchBtn !== null) {
    folderSearchBtn.style.cursor = 'pointer'
    folderSearchBtn.addEventListener('click', () => {
      togglePageSearch(main, context)
    })
  }

  // 配信ステータスフィルタ
  const statusSelect = main.querySelector<HTMLElement>(FOLDERS_HOOK.adStatusSelect)
  if (statusSelect !== null) {
    statusSelect.style.cursor = 'pointer'
    statusSelect.addEventListener('click', () => {
      openStatusFilter(statusSelect, main, context)
    })
  }

  // 集計期間: 採取物にUIが無いためクローン独自のピッカーを出し、KPI列を実データで更新する。
  const periodSelect = main.querySelector<HTMLElement>(FOLDERS_HOOK.periodSelect)
  if (periodSelect !== null) {
    periodSelect.style.cursor = 'pointer'
    setPeriodLabel(periodSelect)
    periodSelect.addEventListener('click', () => {
      openPeriodPicker(periodSelect, getListRange(), (range) => {
        setListRange(range)
        setPeriodLabel(periodSelect)
        void applyListMetrics(main)
      })
    })
  }
}

// ── ページ検索（フォルダ内検索）──────────────────────
let pageSearchInput: HTMLInputElement | null = null
let pageSearchQuery = ''

function togglePageSearch(main: HTMLElement, context: PageContext): void {
  if (pageSearchInput !== null) {
    pageSearchInput.parentElement?.remove()
    pageSearchInput = null
    pageSearchQuery = ''
    refilterPageRows(main, context)
    return
  }
  const container = main.querySelector<HTMLElement>(FOLDERS_HOOK.pageRowList)
  if (container === null) return

  const bar = document.createElement('div')
  bar.style.cssText = 'padding:4px 8px'

  const input = document.createElement('input')
  input.type = 'text'
  input.placeholder = 'ページを検索...'
  input.style.cssText = `width:100%;box-sizing:border-box;padding:6px 10px;border:1px solid var(--sb-c-dddddd, #DDDDDD);border-radius:4px;font-size:12px;outline:none;font-family:${T.font}`
  input.addEventListener('input', () => {
    pageSearchQuery = input.value.trim().toLowerCase()
    refilterPageRows(main, context)
  })

  bar.append(input)
  container.before(bar)
  pageSearchInput = input
  requestAnimationFrame(() => input.focus())
}

/** ページ行をフィルタ（検索クエリ + ステータスフィルタ） */
function refilterPageRows(main: HTMLElement, _context: PageContext): void {
  const container = main.querySelector<HTMLElement>(FOLDERS_HOOK.pageRowList)
  if (container === null) return
  const rowWrappers = Array.from(container.children).filter(
    (child): child is HTMLElement =>
      child.querySelector('[data-testid="list-menu-item"]') !== null,
  )
  for (const wrapper of rowWrappers) {
    const title = wrapper.querySelector<HTMLElement>(FOLDERS_HOOK.pageTitle)
    const titleText = (title?.textContent ?? '').toLowerCase()
    const matchesSearch = pageSearchQuery === '' || titleText.includes(pageSearchQuery)

    // ステータスフィルタ
    let matchesStatus = true
    if (activeStatusFilter !== 'all') {
      const statusEl = wrapper.querySelector<HTMLElement>(FOLDERS_HOOK.pageStatusInline)
      const statusText = (statusEl?.textContent ?? '').trim()
      matchesStatus = statusText === AD_STATUS_LABELS[activeStatusFilter]
    }

    ;(wrapper as HTMLElement).style.display = matchesSearch && matchesStatus ? '' : 'none'
  }
}

// ── 配信ステータスフィルタ ──────────────────────
let activeStatusFilter: string = 'all'
let statusMenuEl: HTMLElement | null = null

function openStatusFilter(anchor: HTMLElement, main: HTMLElement, context: PageContext): void {
  if (statusMenuEl !== null) {
    statusMenuEl.remove()
    statusMenuEl = null
    return
  }

  const menu = document.createElement('div')
  menu.style.cssText = [
    'position:fixed;z-index:9999',
    `background:${T.surface};border-radius:8px`,
    'box-shadow:0 4px 16px rgba(0,0,0,.15)',
    'min-width:140px;padding:4px 0',
    `font-family:${T.font};font-size:13px`,
  ].join(';')

  const options: { label: string; value: string }[] = [
    { label: 'すべて', value: 'all' },
    { label: '準備中', value: 'prepared' },
    { label: '配信中', value: 'delivered' },
    { label: '停止中', value: 'stopping' },
    { label: '終了', value: 'finished' },
  ]

  for (const opt of options) {
    const row = document.createElement('div')
    row.textContent = opt.label
    row.style.cssText = `padding:8px 16px;cursor:pointer;color:${T.text}${opt.value === activeStatusFilter ? ';font-weight:700' : ''}`
    row.addEventListener('mouseenter', () => {
      row.style.background = 'rgba(0,0,0,.04)'
    })
    row.addEventListener('mouseleave', () => {
      row.style.background = 'transparent'
    })
    row.addEventListener('click', (e) => {
      e.stopPropagation()
      activeStatusFilter = opt.value
      menu.remove()
      statusMenuEl = null
      refilterPageRows(main, context)
    })
    menu.append(row)
  }

  const rect = anchor.getBoundingClientRect()
  menu.style.top = `${rect.bottom + 4}px`
  menu.style.left = `${rect.left}px`
  document.body.append(menu)
  statusMenuEl = menu

  requestAnimationFrame(() => {
    const close = (): void => {
      menu.remove()
      statusMenuEl = null
      document.removeEventListener('click', close)
    }
    document.addEventListener('click', close)
  })
}

/**
 * 行のホバーで出るアクション。1つ目（星アイコン）はお気に入りトグル、
 * 2つ目（歯車）はフォルダ操作メニュー。
 */
function wireRowActions(row: HTMLElement, folder: Folder, rerender: () => void): void {
  const actions = row.querySelector<HTMLElement>(FOLDERS_HOOK.folderRowActions)
  if (actions === null) return
  const buttons = actions.querySelectorAll<HTMLElement>('button')
  const starBtn = buttons[0] ?? null
  const gearBtn = buttons[1] ?? null

  // 星アイコン: お気に入りトグル（指示㉝: 押しても「お気に入り」タブに反映されない不具合を修正）。
  // 以前は API 呼び出しと星の見た目だけ更新し、手元の folder とツリーを更新していなかったため、
  // 「お気に入り」タブ（context.folders を is_favorite で絞る）に出てこなかった。
  // トグル時に folder.is_favorite を更新し、ツリーを描き直して即座に反映する。
  if (starBtn !== null) {
    updateStarAppearance(starBtn, folder.is_favorite)

    starBtn.addEventListener('click', (event) => {
      event.stopPropagation()
      const newValue = !folder.is_favorite
      folder.is_favorite = newValue
      rerender() // 楽観的に即反映（「お気に入り」タブにも出る/消える）
      void api.toggleFavorite(folder.uid, newValue).catch(() => {
        folder.is_favorite = !newValue
        rerender()
        toast('お気に入りの切り替えに失敗しました', 'error')
      })
    })
  }

  // 歯車: フォルダ操作メニュー（リネーム・削除）
  if (gearBtn !== null) {
    gearBtn.addEventListener('click', (event) => {
      event.stopPropagation()
      openFolderMenu(gearBtn, folder)
    })
  }
}

// ── 指示㊲→指示67: リサイズハンドル（フォルダサイドバーの幅変更）──────────
/**
 * 採取DOMに在るリサイズ用のグリップ（`.css-1tixm3t`）をドラッグ可能にする。
 * 実物と同じく `col-resize` カーソルは CSS で当たっている。
 *
 * 指示67: リサイズハンドルのドラッグで**左のフォルダサイドバー**（`.e1krw8ps3`：
 * 検索・すべて/お気に入り/履歴 タブ・フォルダ一覧を含むエリア）の幅を変える。
 * ハンドルはサイドバーコンテナ内の右端に位置し、隣の mainPane が残りを埋める。
 */
function wireResizeHandle(body: HTMLElement): void {
  const handle = body.querySelector<HTMLElement>('.css-1tixm3t')
  if (handle === null) return

  // ハンドルの親＝フォルダサイドバーコンテナ（.e1krw8ps3）
  const treeContainer = handle.parentElement
  if (treeContainer === null) return
  // サイドバーと mainPane を並べる flex 親（.e11hwzd01）
  const flexParent = treeContainer.parentElement
  if (flexParent === null) return
  // mainPane（.e11hwzd00）＝ページ一覧＋詳細パネル
  const mainPane = body.querySelector<HTMLElement>(FOLDERS_HOOK.mainPane)
  if (mainPane === null) return

  // ── 実物と同じ hover スタイル（青い縦線 + ←→ アイコン）──
  injectResizeHandleStyles()

  let isDragging = false
  let startX = 0
  let startWidth = 0

  handle.addEventListener('mousedown', (e: MouseEvent) => {
    e.preventDefault()
    isDragging = true
    startX = e.clientX
    startWidth = treeContainer.getBoundingClientRect().width
    handle.style.zIndex = '100'
    handle.classList.add('sb-handle-active')
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  })

  document.addEventListener('mousemove', (e: MouseEvent) => {
    if (!isDragging) return
    const delta = e.clientX - startX
    const parentWidth = flexParent.getBoundingClientRect().width
    const newWidth = Math.max(160, Math.min(parentWidth - 300, startWidth + delta))
    treeContainer.style.flex = 'none'
    treeContainer.style.width = `${newWidth}px`
    mainPane.style.flex = '1'
    mainPane.style.minWidth = '300px'
  })

  document.addEventListener('mouseup', () => {
    if (!isDragging) return
    isDragging = false
    handle.style.zIndex = ''
    handle.classList.remove('sb-handle-active')
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  })
}

/** リサイズハンドルの hover / active スタイルを1回だけ注入 */
function injectResizeHandleStyles(): void {
  if (document.getElementById('sb-resize-handle-css') !== null) return
  const style = document.createElement('style')
  style.id = 'sb-resize-handle-css'
  style.textContent = `
    /* hover で青い縦線 */
    .css-1tixm3t:hover,
    .css-1tixm3t.sb-handle-active {
      background: #4A90D9 !important;
    }
    /* 左右矢印アイコン：hover/active で表示。
       絵文字・記号グリフではなくSVG（共通指示「UIは絵文字をやめSVGアイコンに」）。 */
    .css-1tixm3t::after {
      content: "";
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23fff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M8 8 4 12l4 4'/%3E%3Cpath d='M16 8l4 4-4 4'/%3E%3Cpath d='M4 12h16'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: center;
      background-size: 16px 16px;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 24px;
      height: 24px;
      border-radius: 4px;
      background: #4A90D9;
      color: #FFFFFF;
      font-size: 14px;
      line-height: 24px;
      text-align: center;
      opacity: 0;
      transition: opacity 0.2s;
      pointer-events: none;
    }
    .css-1tixm3t:hover::after,
    .css-1tixm3t.sb-handle-active::after {
      opacity: 1;
    }
  `
  document.head.append(style)
}

/**
 * 指示㊾: 詳細パネルの各値をカーソルが当たっているページ(abTest)の情報で更新する。
 * 採取物のDOMから「サンプル施策NNN」の文言やURL・ステータスを探して差し替える。
 */






