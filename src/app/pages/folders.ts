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
import { api, type AbTest, type Folder } from '../api.ts'
import { T, emptyState, toast } from '../ui.ts'
import {
  FOLDERS_HOOK,
  FOLDER_UID_ATTRIBUTE,
  TAB_CLASS,
  extractFolderRowTemplate,
} from './folders-substrate.ts'
import { openCreateFolder, openCreatePage } from './folders-create.ts'
import { openParamUrlModal } from '../panels/param-url-modal.ts'
import { openFolderMenu } from '../panels/folder-menu.ts'

/** 採取物から切り出したフォルダ1行ぶんのマークアップ（読み込み時に一度だけ） */
const FOLDER_ROW_TEMPLATE = extractFolderRowTemplate(substrate)

/** 現在選ばれているタブ（画面描画をまたいで保持する）。 */
type TreeTab = 'すべて' | 'お気に入り' | '履歴'
let activeTreeTab: TreeTab = 'すべて'

/** 最近アクセスしたフォルダUIDを新しい順に保持（最大20件）。 */
const folderHistory: string[] = []

/** フォルダ閲覧を履歴に記録する（先頭に挿入・重複は古い方を除去）。 */
function recordHistory(uid: string): void {
  const idx = folderHistory.indexOf(uid)
  if (idx !== -1) folderHistory.splice(idx, 1)
  folderHistory.unshift(uid)
  if (folderHistory.length > 20) folderHistory.length = 20
}

interface PageContext {
  folders: readonly Folder[]
  folder: Folder | null
  abTests: readonly AbTest[]
}

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

  const root = document.createElement('div')
  root.innerHTML = substrate
  // 断片は `#root` の中身そのままなので**グローバルサイドバーを含む**。
  // シェルが同じものを出しているため、ここでは本体側だけを残す（マークアップは書き換えていない）。
  const body = root.querySelector<HTMLElement>(FOLDERS_HOOK.body)
  if (body === null) {
    container.append(emptyState('ページ画面の土台が壊れています（本体が見つかりません）'))
    return
  }
  root.replaceChildren(body)
  container.append(root)

  const context: PageContext = {
    folders,
    folder: detail?.folder ?? null,
    abTests: detail?.ab_tests ?? [],
  }

  // 選択したフォルダを履歴に記録
  if (selectedUid !== null) recordHistory(selectedUid)

  renderTree(body, context)
  renderRealList(body, context)
  wireTreeTabs(body, context)
  wireTreeControls(body, context)
  wireMainControls(body, context)
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

  // タブに応じてフォルダをフィルタリング
  const filtered = filterFoldersByTab(context.folders)

  if (filtered.length === 0) {
    const msg = document.createElement('div')
    msg.style.cssText = 'padding:24px 16px;color:#999;font-size:13px;text-align:center'
    msg.textContent =
      activeTreeTab === 'お気に入り'
        ? 'お気に入りのフォルダがありません'
        : '最近アクセスしたフォルダがありません'
    rows.append(msg)
    return
  }

  for (const folder of filtered) {
    const wrapper = document.createElement('div')
    wrapper.append(folderRow(prototypeRow, folder))
    rows.append(wrapper)
  }
}

/** アクティブタブに応じてフォルダをフィルタリングする。検索クエリがあればさらに絞る。 */
function filterFoldersByTab(folders: readonly Folder[]): readonly Folder[] {
  let result: readonly Folder[]
  if (activeTreeTab === 'お気に入り') {
    result = folders.filter((f) => f.is_favorite)
  } else if (activeTreeTab === '履歴') {
    result = folderHistory
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

function folderRow(prototypeRow: HTMLElement, folder: Folder): HTMLElement {
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
  wireRowActions(row, folder)
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

// ── 中央: beyondページ一覧（採取した実KPI一覧をモックの現実に束ねる）──────

/**
 * 採取した実一覧（KPI列つきの行＋右の詳細パネル）を土台に、モックのbeyondページへ配線する。
 *
 * - 実の行マークアップ（KPI列・アイコン・配信ステータス）はそのまま見せる（見た目は実物どおり）。
 * - 行のクリック → その行に割り当てたモックのbeyondページのエディタへ。モック件数より
 *   採取の行が多いぶんは round-robin で割り当て、0件なら実の行を隠して空状態を出す。
 * - 右パネルの「パラメータ付きURL」→ クローンのURL発行モーダル、「コピー」→ クリップボード。
 */
function renderRealList(body: HTMLElement, context: PageContext): void {
  const area = body.querySelector<HTMLElement>(FOLDERS_HOOK.listArea)
  if (area === null) {
    console.warn('[folders]', FOLDERS_HOOK.listArea, 'が土台に見つかりませんでした')
    return
  }
  wireRealPageRows(area, context)
  wireRealDetailPanel(body, context)
}

/** 配信ステータスの表示名（正本は `mock-server/store/types.ts`） */
const AD_STATUS_LABELS: Readonly<Record<string, string>> = {
  prepared: '準備中',
  delivered: '配信中',
  stopping: '停止中',
  finished: '終了',
}

/**
 * 一覧の実マークアップ（KPI列つきの行）を雛形に、**モックのbeyondページを1件ずつ描き直す**。
 *
 * 以前は採取物の行（サンプルの匿名データ）をそのまま見せてクリックだけ配線していたが、
 * それだとユーザーが実際に作ったページ（例: めぐり）が一覧に出ず消えたように見えた。
 * ここでは実の行を雛形として複製し、名前・ステータス・媒体をモックの値へ差し替え、
 * 行クリックでそのページのエディタへ飛ばす。KPI値は採取の「準備中・¥0」がそのまま残る
 * （モックの準備中ページは実績0なので、これは正しい表示）。
 */
function wireRealPageRows(area: HTMLElement, context: PageContext): void {
  const container = area.querySelector<HTMLElement>(FOLDERS_HOOK.pageRowList)
  if (container === null) {
    console.warn('[folders]', FOLDERS_HOOK.pageRowList, 'が土台に見つかりませんでした')
    return
  }
  // 実の行ラッパー（`list-menu-item` を内包する直下要素）を集める。ヘッダやグループ行は残す。
  const rowWrappers = Array.from(container.children).filter(
    (child): child is HTMLElement =>
      child.querySelector('[data-testid="list-menu-item"]') !== null,
  )
  const anchor = rowWrappers[0]
  if (anchor === undefined) return

  // 配線前のクリーンな1枚を雛形として控える
  const template = anchor.cloneNode(true) as HTMLElement

  // フォルダ見出しをモックのフォルダ名に合わせる
  if (context.folder !== null) {
    const groupName = area.querySelector<HTMLElement>(FOLDERS_HOOK.groupName)
    if (groupName !== null) groupName.textContent = context.folder.name
  }

  const fragment = document.createDocumentFragment()
  for (const abTest of context.abTests) {
    fragment.append(buildPageRow(template, abTest))
  }
  // モックが0件のときは雛形を1枚だけ残さず、行を空にして正直に（採取の空状態は未採取）
  anchor.before(fragment)
  for (const wrapper of rowWrappers) wrapper.remove()

  // 採取物に残る無限スクロールのローディング（`role="progressbar"`）は、
  // クローンの一覧が全件そろっているので永遠に回り続ける。畳んで消す。
  for (const spinner of container.querySelectorAll<HTMLElement>('[role="progressbar"]')) {
    const wrapper = spinner.closest<HTMLElement>(`${FOLDERS_HOOK.pageRowList} > div`)
    ;(wrapper ?? spinner).style.display = 'none'
  }
}

/** 雛形の実行を複製し、名前・ステータス・媒体をモック値へ差し替えてクリックを配線する。 */
function buildPageRow(template: HTMLElement, abTest: AbTest): HTMLElement {
  const row = template.cloneNode(true) as HTMLElement
  const status = AD_STATUS_LABELS[abTest.ad_status] ?? abTest.ad_status

  const title = row.querySelector<HTMLElement>(FOLDERS_HOOK.pageTitle)
  if (title !== null) title.textContent = abTest.title
  for (const node of row.querySelectorAll<HTMLElement>(
    `${FOLDERS_HOOK.pageStatusInline}, ${FOLDERS_HOOK.pageStatusKpi}`,
  )) {
    node.textContent = status
  }
  const media = row.querySelector<HTMLElement>(FOLDERS_HOOK.pageMedia)
  if (media !== null) media.textContent = abTest.media?.name ?? '媒体未設定'

  const item = row.querySelector<HTMLElement>('[data-testid="list-menu-item"]')
  if (item !== null) item.style.cursor = 'pointer'
  row.addEventListener('click', (event) => {
    // 行内のホバー操作アイコン（設定など）を押したときはエディタへ飛ばさない
    if ((event.target as HTMLElement).closest('button') !== null) return
    location.hash = `/ab_tests/${abTest.uid}/articles`
  })
  return row
}

/**
 * 右の詳細パネル（採取した実マークアップ）の操作を配線する。
 * - 「パラメータ付きURLの発行」→ クローンのURL発行モーダル（実物と同じ入力項目）。
 * - 「コピー」→ 配信URLをクリップボードへ。
 * パネルの各値は採取物のまま（見た目は実物どおり）。
 */
function wireRealDetailPanel(body: HTMLElement, context: PageContext): void {
  const panel = body.querySelector<HTMLElement>(FOLDERS_HOOK.detailPanel)
  if (panel === null) return

  const baseUrl = paramUrlBase(panel, context)
  const paramButton = findByText(panel, 'パラメータ付きURLの発行')
  if (paramButton !== null) {
    paramButton.style.cursor = 'pointer'
    paramButton.addEventListener('click', () => openParamUrlModal(baseUrl))
  }

  for (const copy of panel.querySelectorAll<HTMLElement>('[aria-label="コピー"]')) {
    copy.addEventListener('click', (event) => {
      event.stopPropagation()
      void navigator.clipboard?.writeText(baseUrl).then(
        () => toast('配信URLをコピーしました'),
        () => toast('コピーできませんでした', 'error'),
      )
    })
  }
}

/** URL発行/コピーの元になる配信URL。モックのbeyondページがあればそれを、無ければパネル表示値を使う。 */
function paramUrlBase(panel: HTMLElement, context: PageContext): string {
  const first = context.abTests[0]
  if (first !== undefined) return `${location.origin}/#/ab/${first.uid}`
  const shown = Array.from(panel.querySelectorAll<HTMLElement>('a, div')).find((node) =>
    /^\/ab\//.test((node.textContent ?? '').trim()),
  )
  const path = (shown?.textContent ?? '/ab/UID').trim()
  return `${location.origin}/#${path}`
}

/** 子孫から、指定文字列と完全一致するテキストだけを持つ最小要素を探す（アイコン等を巻き込まない）。 */
function findByText(root: HTMLElement, text: string): HTMLElement | null {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>('div, button, span, a'))
  return (
    nodes.find(
      (node) => (node.textContent ?? '').trim() === text && node.children.length <= 1,
    ) ?? null
  )
}

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

/** 押した後の画面を採取していない操作。それらしい画面を作らず、そう言う（§3-5）。 */
function wireNotCaptured(node: Element | null | undefined, label: string): void {
  node?.addEventListener('click', () => {
    toast(`「${label}」は採取していないため未実装です`, 'error')
  })
}

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
  input.style.cssText = `width:100%;box-sizing:border-box;padding:6px 10px;border:1px solid #DDD;border-radius:4px;font-size:12px;outline:none;font-family:${T.font}`
  input.addEventListener('input', () => {
    searchQuery = input.value.trim().toLowerCase()
    const bodyEl = tree.closest(FOLDERS_HOOK.body) as HTMLElement
    if (bodyEl !== null) renderTree(bodyEl, context)
  })
  input.addEventListener('focus', () => {
    input.style.borderColor = '#0091FF'
  })
  input.addEventListener('blur', () => {
    input.style.borderColor = '#DDD'
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

  // 集計期間: トーストを残す（モック側に日次メトリクスの期間フィルタリングUIは採取物に無い）
  wireNotCaptured(main.querySelector(FOLDERS_HOOK.periodSelect), '集計期間')
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
  input.style.cssText = `width:100%;box-sizing:border-box;padding:6px 10px;border:1px solid #DDD;border-radius:4px;font-size:12px;outline:none;font-family:${T.font}`
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
function wireRowActions(row: HTMLElement, folder: Folder): void {
  const actions = row.querySelector<HTMLElement>(FOLDERS_HOOK.folderRowActions)
  if (actions === null) return
  const buttons = actions.querySelectorAll<HTMLElement>('button')
  const starBtn = buttons[0] ?? null
  const gearBtn = buttons[1] ?? null

  // 星アイコン: お気に入りトグル
  if (starBtn !== null) {
    let isFav = folder.is_favorite
    updateStarAppearance(starBtn, isFav)

    starBtn.addEventListener('click', (event) => {
      event.stopPropagation()
      const newValue = !isFav
      isFav = newValue
      updateStarAppearance(starBtn, newValue)
      void api.toggleFavorite(folder.uid, newValue).catch(() => {
        // 失敗したら戻す
        isFav = !newValue
        updateStarAppearance(starBtn, !newValue)
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

/** 星アイコンの見た目をお気に入り状態に合わせて変える。 */
function updateStarAppearance(starBtn: HTMLElement, isFavorite: boolean): void {
  const svg = starBtn.querySelector('svg')
  if (svg === null) return
  const path = svg.querySelector('path')
  if (path === null) return
  if (isFavorite) {
    // 塗りつぶし（ブランド色）
    path.setAttribute('fill', '#0091FF')
    path.setAttribute('stroke', '#0091FF')
  } else {
    // 線だけ（既定）
    path.setAttribute('fill', 'none')
    path.removeAttribute('stroke')
  }
}
