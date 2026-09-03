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
import { T, button, el, emptyState, toast } from '../ui.ts'
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

/** 履歴エントリ。何をいつ触ったか記録する。 */
interface HistoryEntry {
  uid: string
  name: string
  type: 'folder' | 'ab_test'
  action: string
  timestamp: number
}

/** 最近の操作を新しい順に保持（最大30件）。 */
const activityHistory: HistoryEntry[] = []

/** 操作を履歴に記録する（先頭に挿入・同一UIDの直近エントリは更新）。 */
export function recordHistory(uid: string, name?: string, type: 'folder' | 'ab_test' = 'folder', action = '閲覧'): void {
  // 同一UIDの直近操作が同じアクションなら更新だけ
  const existing = activityHistory.findIndex((e) => e.uid === uid && e.action === action)
  if (existing !== -1) activityHistory.splice(existing, 1)
  activityHistory.unshift({
    uid,
    name: name ?? uid,
    type,
    action,
    timestamp: Date.now(),
  })
  if (activityHistory.length > 30) activityHistory.length = 30
}

/** 後方互換: フォルダUIDだけのアクセス順リストを返す（filterFoldersByTab用） */
function folderHistoryUids(): readonly string[] {
  return activityHistory
    .filter((e) => e.type === 'folder')
    .map((e) => e.uid)
    .filter((uid, i, arr) => arr.indexOf(uid) === i) // 重複除去
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
  if (selectedUid !== null) {
    const folderName = context.folder?.name ?? selectedUid
    recordHistory(selectedUid, folderName, 'folder', '閲覧')
  }

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

  // 履歴タブは操作ログを表示
  if (activeTreeTab === '履歴') {
    renderHistoryList(rows)
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

/** 履歴タブ: 操作ログ（何をいつ触ったか）を表示する。 */
function renderHistoryList(container: Element): void {
  if (activityHistory.length === 0) {
    const msg = document.createElement('div')
    msg.style.cssText = 'padding:24px 16px;color:#999;font-size:13px;text-align:center'
    msg.textContent = '最近の操作はありません'
    container.append(msg)
    return
  }

  for (const entry of activityHistory) {
    const row = el('div', {
      style: [
        'display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer',
        `border-bottom:1px solid #F0F0F0;font-family:${T.font}`,
      ].join(';'),
    })

    // アイコン（フォルダ/ページ）
    const icon = el('div', {
      style: 'width:28px;height:28px;display:flex;align-items:center;justify-content:center;flex-shrink:0;border-radius:6px;background:#F5F5F5',
    })
    icon.innerHTML = entry.type === 'folder'
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="#666"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="#666"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>'

    // 名前 + アクション
    const info = el('div', { style: 'flex:1;min-width:0' })
    const nameLine = el('div', {
      text: entry.name,
      style: `font-size:13px;color:${T.text};white-space:nowrap;overflow:hidden;text-overflow:ellipsis`,
    })
    const actionLine = el('div', {
      text: `${entry.action} · ${formatTimestamp(entry.timestamp)}`,
      style: `font-size:11px;color:${T.sub};margin-top:2px`,
    })
    info.append(nameLine, actionLine)
    row.append(icon, info)

    // クリック → 該当ページへ遷移
    row.addEventListener('click', () => {
      if (entry.type === 'folder') {
        location.hash = `/folders?uid=${entry.uid}`
      } else {
        // beyondページ → エディタへ
        location.hash = `/ab_tests/${entry.uid}/articles`
      }
    })

    // ホバー
    row.addEventListener('mouseenter', () => { row.style.background = '#F8F8F8' })
    row.addEventListener('mouseleave', () => { row.style.background = '' })

    container.append(row)
  }
}

/** タイムスタンプを相対時間で表示（「3分前」「2時間前」「昨日」等） */
function formatTimestamp(ts: number): string {
  const diff = Date.now() - ts
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'たった今'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}分前`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour}時間前`
  const day = Math.floor(hour / 24)
  if (day === 1) return '昨日'
  if (day < 7) return `${day}日前`
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
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
  // 指示㉞: 行同士の境界が薄くて分かりづらいので、はっきりした仕切り線を足す。
  row.style.borderBottom = '1px solid #E3E6EA'
  const status = AD_STATUS_LABELS[abTest.ad_status] ?? abTest.ad_status

  const title = row.querySelector<HTMLElement>(FOLDERS_HOOK.pageTitle)
  if (title !== null) {
    title.textContent = abTest.title
    wireInlineRename(title, abTest)
  }
  for (const node of row.querySelectorAll<HTMLElement>(
    `${FOLDERS_HOOK.pageStatusInline}, ${FOLDERS_HOOK.pageStatusKpi}`,
  )) {
    node.textContent = status
  }
  const media = row.querySelector<HTMLElement>(FOLDERS_HOOK.pageMedia)
  if (media !== null) media.textContent = abTest.media?.name ?? '媒体未設定'

  const item = row.querySelector<HTMLElement>('[data-testid="list-menu-item"]')
  if (item !== null) item.style.cursor = 'pointer'

  // ページ行ホバーアクション（分析/ヒートマップ/レポート/バージョン/…メニュー）
  wirePageRowActions(row, abTest)

  row.addEventListener('click', (event) => {
    // 行内のインライン操作（ボタン・入力・アクションバー）を押したときはエディタへ飛ばさない
    const target = event.target as HTMLElement
    if (target.closest('button') !== null || target.closest('input') !== null || target.closest('.sb-page-actions') !== null) return
    location.hash = `/ab_tests/${abTest.uid}/articles`
  })
  return row
}

/**
 * ページ名（タイトル）をクリックでインライン編集する（指示㉓）。
 * クリック → テキストが input に変わる（黄色背景・青ボーダー）→ Enter/blur で確定 → API更新。
 */
function wireInlineRename(titleEl: HTMLElement, abTest: AbTest): void {
  const el$ = titleEl  // eslint-safe alias（no-param-reassign 回避）
  el$.style.cursor = 'text'
  el$.addEventListener('click', (e) => {
    e.stopPropagation()
    // 既に編集中なら何もしない
    if (el$.querySelector('input') !== null) return

    const currentName = (el$.textContent ?? '').trim()
    const input = document.createElement('input')
    input.type = 'text'
    input.value = currentName
    input.style.cssText = [
      'width:100%;box-sizing:border-box;padding:4px 8px',
      'border:2px solid #0091FF;border-radius:4px',
      'background:#FFFDE7',
      `font-size:inherit;font-family:${T.font}`,
      'outline:none',
    ].join(';')

    el$.replaceChildren(input)
    input.focus()
    input.select()

    const commit = (): void => {
      const newName = input.value.trim()
      if (newName === '' || newName === currentName) {
        el$.replaceChildren(document.createTextNode(currentName))
        return
      }
      el$.replaceChildren(document.createTextNode(newName))
      void api.updateAbTest(abTest.uid, { title: newName }).then(
        () => toast('ページ名を更新しました'),
        () => {
          el$.replaceChildren(document.createTextNode(currentName))
          toast('ページ名の更新に失敗しました', 'error')
        },
      )
    }

    input.addEventListener('blur', commit)
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !ev.isComposing) {
        ev.preventDefault()
        input.blur()
      }
      if (ev.key === 'Escape') {
        el$.replaceChildren(document.createTextNode(currentName))
      }
    })
  })
}

/**
 * ページ行のホバーアクションバー（指示㉒）。
 * 実物は行ホバー時に「分析 / ヒートマップ / レポート / バージョン / ... / 歯車」が出る。
 * 採取物にはこのバーが無い（ホバー時だけ描画されるため）ので、自前で追加する。
 */
function wirePageRowActions(row: HTMLElement, abTest: AbTest): void {
  const item = row.querySelector<HTMLElement>('[data-testid="list-menu-item"]')
  if (item === null) return

  const bar = el('div', {
    style: [
      'position:absolute;top:8px;right:8px',
      'display:flex;gap:4px;opacity:0;transition:opacity 0.15s',
      'pointer-events:none;z-index:10',
    ].join(';'),
  })
  bar.classList.add('sb-page-actions')

  // 行をposition:relativeにしてバーをabsoluteで配置
  ;(item.style as CSSStyleDeclaration).position = 'relative'

  const navButtons: { label: string; hash: string; bg: string; color: string }[] = [
    { label: '分析', hash: `/ab_tests/${abTest.uid}/reports`, bg: '#6C63FF', color: '#FFF' },
    { label: 'ヒートマップ', hash: `/ab_tests/${abTest.uid}/reports`, bg: '#444', color: '#FFF' },
    { label: 'レポート', hash: `/ab_tests/${abTest.uid}/reports`, bg: '#0091FF', color: '#FFF' },
    { label: 'バージョン', hash: `/ab_tests/${abTest.uid}/articles`, bg: '#7B61FF', color: '#FFF' },
  ]

  for (const nav of navButtons) {
    const btn = el('button', {
      text: nav.label,
      style: [
        `background:${nav.bg};color:${nav.color}`,
        'border:none;border-radius:4px;padding:4px 10px',
        `font-size:11px;cursor:pointer;font-family:${T.font}`,
        'white-space:nowrap',
      ].join(';'),
    })
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      location.hash = nav.hash
    })
    bar.append(btn)
  }

  // 三点メニュー（…）
  const moreBtn = el('button', {
    text: '···',
    style: [
      `background:${T.surface};color:${T.text}`,
      'border:1px solid #DDD;border-radius:4px;padding:4px 8px',
      `font-size:13px;cursor:pointer;font-family:${T.font}`,
      'font-weight:700',
    ].join(';'),
  })
  moreBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    openPageMoreMenu(moreBtn, abTest)
  })
  bar.append(moreBtn)

  // 歯車アイコン
  const gearBtn = el('button', {
    style: [
      `background:${T.surface};color:${T.sub}`,
      'border:1px solid #DDD;border-radius:4px;padding:4px 6px',
      'cursor:pointer;display:flex;align-items:center',
    ].join(';'),
  })
  gearBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 00-.48-.41h-3.84a.48.48 0 00-.48.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 00-.59.22L2.74 8.87a.48.48 0 00.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1115.6 12 3.6 3.6 0 0112 15.6z"/></svg>'
  gearBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    // 基本情報ページへ
    location.hash = `/ab_tests/${abTest.uid}/basic_info`
  })
  bar.append(gearBtn)

  item.append(bar)

  // ホバーで表示/非表示
  row.addEventListener('mouseenter', () => {
    bar.style.opacity = '1'
    bar.style.pointerEvents = 'auto'
  })
  row.addEventListener('mouseleave', () => {
    bar.style.opacity = '0'
    bar.style.pointerEvents = 'none'
  })
}

/** ページ行の三点メニュー（…）の中身（指示㉒） */
let pageMoreMenuEl: HTMLElement | null = null

function openPageMoreMenu(anchor: HTMLElement, abTest: AbTest): void {
  if (pageMoreMenuEl !== null) {
    pageMoreMenuEl.remove()
    pageMoreMenuEl = null
    return
  }

  const menu = el('div', {
    style: [
      'position:fixed;z-index:9999',
      `background:${T.surface};border-radius:8px`,
      'box-shadow:0 4px 16px rgba(0,0,0,.15)',
      'min-width:180px;padding:4px 0',
      `font-family:${T.font};font-size:13px`,
    ].join(';'),
  })

  const items: { label: string; action: () => void }[] = [
    {
      label: 'お気に入りに追加',
      action: () => toast('お気に入り機能はフォルダ単位です'),
    },
    {
      label: 'フォルダ移動',
      action: () => toast('フォルダ移動は未実装です（採取物なし）', 'error'),
    },
    {
      label: '別フォルダへ複製',
      action: () => toast('別フォルダへ複製は未実装です（採取物なし）', 'error'),
    },
    {
      label: 'beyondページ複製',
      action: () => toast('beyondページ複製は未実装です（採取物なし）', 'error'),
    },
    {
      label: 'ステータスを終了にする',
      action: () => {
        void api.updateAbTest(abTest.uid, { ad_status: 'finished' }).then(
          () => {
            toast('ステータスを終了に変更しました')
            dispatchEvent(new HashChangeEvent('hashchange'))
          },
          () => toast('ステータスの変更に失敗しました', 'error'),
        )
      },
    },
  ]

  for (const item of items) {
    const row = el('div', {
      text: item.label,
      style: `padding:10px 16px;cursor:pointer;color:${T.text};white-space:nowrap`,
    })
    row.addEventListener('mouseenter', () => { row.style.background = 'rgba(0,0,0,.04)' })
    row.addEventListener('mouseleave', () => { row.style.background = 'transparent' })
    row.addEventListener('click', (e) => {
      e.stopPropagation()
      menu.remove()
      pageMoreMenuEl = null
      item.action()
    })
    menu.append(row)
  }

  const rect = anchor.getBoundingClientRect()
  menu.style.top = `${rect.bottom + 4}px`
  menu.style.right = `${window.innerWidth - rect.right}px`
  document.body.append(menu)
  pageMoreMenuEl = menu

  requestAnimationFrame(() => {
    const close = (): void => {
      menu.remove()
      pageMoreMenuEl = null
      document.removeEventListener('click', close)
    }
    document.addEventListener('click', close)
  })
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

  // 鉛筆アイコン（data-testid="pencil-icon"）→ インライン編集
  wirePencilIcons(panel, context)

  // ヘッダーのページ名鉛筆（パネル外にある）を配線
  wireHeaderPencil(body, context)

  // 折りたたみセクション（URL情報・beyondページ情報・配信情報）のアコーディオン開閉
  wireAccordionSections(panel)
}

/**
 * ヘッダーのページ名鉛筆（パネル外にある `.efy50tl4` 内の pencil-icon）を配線する。
 * クリック → ページ名のテキストが input に変わり、Enter/blur で API 更新。
 */
function wireHeaderPencil(body: HTMLElement, context: PageContext): void {
  const abTest = context.abTests[0]
  if (abTest === undefined) return

  // パネル外のすべての鉛筆を探し、パネル内に無いものを対象にする
  const panel = body.querySelector<HTMLElement>(FOLDERS_HOOK.detailPanel)
  const allPencils = body.querySelectorAll<SVGElement>('[data-testid="pencil-icon"]')
  for (const pencilSvg of allPencils) {
    if (panel !== null && panel.contains(pencilSvg)) continue
    // ヘッダーの鉛筆 → ページ名の編集
    const clickTarget = pencilSvg.closest<HTMLElement>('.css-fbr94v') ?? (pencilSvg.parentElement as HTMLElement)
    clickTarget.style.cursor = 'pointer'
    clickTarget.addEventListener('click', (e) => {
      e.stopPropagation()
      openInlineEdit(pencilSvg, { key: 'title', type: 'text' }, abTest.uid)
    })
  }
}

/**
 * 詳細パネルの折りたたみセクション（ej6u9q12）を配線する。
 * ヘッダー（ej6u9q11）をクリックでコンテンツ（ej6u9q10）をトグルし、
 * 矢印アイコン（arrow-down-icon）を回転させる。
 */
function wireAccordionSections(panel: HTMLElement): void {
  const sections = panel.querySelectorAll<HTMLElement>('.ej6u9q12')
  for (const section of sections) {
    const header = section.querySelector<HTMLElement>('.ej6u9q11')
    const content = section.querySelector<HTMLElement>('.ej6u9q10')
    if (header === null || content === null) continue

    const arrow = header.querySelector<SVGElement>('[data-testid="arrow-down-icon"]')
    let isOpen = true  // 初期状態は開いている（採取物のまま）

    header.style.cursor = 'pointer'
    header.addEventListener('click', () => {
      isOpen = !isOpen
      content.style.display = isOpen ? '' : 'none'
      if (arrow !== null) {
        arrow.style.transition = 'transform 0.2s ease'
        arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(-90deg)'
      }
    })
  }
}

/**
 * 詳細パネルの鉛筆アイコン（7個）をインライン編集に配線する。
 * 実物: ページ名 / 配信ステータス / 配信タイプ / 広告媒体 / コンバージョンポイント / コンバージョン単価 / 計測方法
 *
 * 鉛筆をクリック → 値テキストが input/select に変わる → 確定で PUT /ab_tests/:uid → DOM更新。
 */
function wirePencilIcons(panel: HTMLElement, context: PageContext): void {
  const abTest = context.abTests[0]
  if (abTest === undefined) return

  const pencils = [...panel.querySelectorAll<SVGElement>('[data-testid="pencil-icon"]')]

  /**
   * 配信情報セクション内の鉛筆の順番（パネル内のみ。ヘッダーのページ名鉛筆は
   * パネル外なのでここには含まない — 含めると全フィールドが1つずれる）。
   */
  const fields: PencilField[] = [
    { key: 'ad_status', type: 'select', options: ['準備中', '配信中', '停止中', '終了'] },
    { key: 'delivery_type', type: 'select', options: ['同一URL配信', '異なるURL配信'] },
    { key: 'media_id', type: 'text', readonly: true },
    { key: 'conversion_condition', type: 'select', options: ['クリック', 'アクセス'] },
    { key: 'conversion_unit_price', type: 'text', inputType: 'number' },
    { key: 'affiliate_service_provider', type: 'text', readonly: true },
  ]

  for (let i = 0; i < pencils.length && i < fields.length; i++) {
    const pencilSvg = pencils[i] as SVGElement
    const field = fields[i] as PencilField
    const clickTarget = pencilSvg.closest<HTMLElement>('.css-fbr94v') ?? (pencilSvg as unknown as HTMLElement)
    clickTarget.style.cursor = 'pointer'
    clickTarget.addEventListener('click', (e) => {
      e.stopPropagation()
      openInlineEdit(pencilSvg, field, abTest.uid)
    })
  }
}

interface PencilField {
  key: string
  type: 'text' | 'select'
  options?: readonly string[]
  inputType?: string
  readonly?: boolean
}

/**
 * 鉛筆アイコンの横に小さなポップオーバーを出してインライン編集する。
 * テキスト → input, セレクト → select を表示。保存で API 呼び出し → DOM 更新。
 */
function openInlineEdit(
  pencilSvg: SVGElement,
  field: PencilField,
  abTestUid: string,
): void {
  // 既存のポップオーバーがあれば閉じる
  document.querySelector('.sb-inline-edit')?.remove()

  // 現在の表示値を取得（鉛筆の隣のテキスト）
  const valueContainer = findValueContainer(pencilSvg)
  const currentText = valueContainer !== null ? (valueContainer.textContent ?? '').trim() : ''

  // 読み取り専用のフィールドは基本情報ページへ遷移
  if (field.readonly === true) {
    toast('この項目は基本情報ページで編集できます')
    return
  }

  // ポップオーバーを作成
  const popover = el('div', {
    style: [
      'z-index:1200',
      `background:${T.surface};border:1px solid #DDD;border-radius:8px`,
      'box-shadow:0 4px 16px rgba(0,0,0,.12);padding:12px 16px',
      `min-width:220px;font-family:${T.font}`,
    ].join(';'),
  })
  popover.classList.add('sb-inline-edit')

  let inputEl: HTMLInputElement | HTMLSelectElement

  if (field.type === 'select' && field.options !== undefined) {
    const sel = document.createElement('select')
    sel.style.cssText = `width:100%;padding:6px 8px;font-size:13px;border:1px solid #CCC;border-radius:4px;font-family:${T.font}`
    for (const opt of field.options) {
      const o = document.createElement('option')
      o.value = opt
      o.textContent = opt
      if (opt === currentText) o.selected = true
      sel.append(o)
    }
    inputEl = sel
  } else {
    const inp = document.createElement('input')
    inp.type = field.inputType ?? 'text'
    inp.value = currentText === '-' ? '' : currentText
    inp.style.cssText = `width:100%;padding:6px 8px;font-size:13px;border:1px solid #CCC;border-radius:4px;font-family:${T.font};box-sizing:border-box`
    inputEl = inp
  }

  const btnRow = el('div', { style: 'display:flex;gap:8px;margin-top:8px;justify-content:flex-end' })
  const cancelBtn = button('キャンセル')
  cancelBtn.style.cssText += ';padding:4px 12px;font-size:12px;background:#F5F5F5;color:#333'
  const saveBtn = button('保存')
  saveBtn.style.cssText += ';padding:4px 12px;font-size:12px'

  cancelBtn.addEventListener('click', () => popover.remove())
  saveBtn.addEventListener('click', () => {
    const newValue = inputEl.value.trim()
    if (newValue === '') {
      toast('値を入力してください', 'error')
      return
    }
    saveBtn.textContent = '保存中…'
    saveBtn.setAttribute('disabled', '')

    const body = buildPatchBody(field.key, newValue)
    void api.updateAbTest(abTestUid, body).then(
      () => {
        popover.remove()
        // DOM上の表示テキストを更新
        if (valueContainer !== null) {
          valueContainer.textContent = newValue
        }
        toast('更新しました')
      },
      (err: Error) => {
        saveBtn.textContent = '保存'
        saveBtn.removeAttribute('disabled')
        toast(`更新に失敗しました: ${err.message}`, 'error')
      },
    )
  })

  // Enter で保存
  inputEl.addEventListener('keydown', ((e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault()
      saveBtn.click()
    }
    if (e.key === 'Escape') popover.remove()
  }) as EventListener)

  btnRow.append(cancelBtn, saveBtn)
  popover.append(inputEl, btnRow)

  // 鉛筆の位置に fixed ポップオーバーで表示
  const anchor = pencilSvg.closest<HTMLElement>('.css-fbr94v') ?? (pencilSvg as unknown as HTMLElement)
  const rect = anchor.getBoundingClientRect()
  popover.style.position = 'fixed'
  popover.style.top = `${rect.bottom + 4}px`
  popover.style.right = `${window.innerWidth - rect.right}px`
  document.body.append(popover)

  // フォーカス
  inputEl.focus()
  if (inputEl instanceof HTMLInputElement) inputEl.select()

  // 外側クリックで閉じる
  const onOutsideClick = (ev: MouseEvent): void => {
    if (!popover.contains(ev.target as Node)) {
      popover.remove()
      document.removeEventListener('mousedown', onOutsideClick)
    }
  }
  setTimeout(() => document.addEventListener('mousedown', onOutsideClick), 0)
}

/** 鉛筆SVGの隣にある値テキストの要素を探す */
function findValueContainer(pencilSvg: SVGElement): HTMLElement | null {
  // パターン1: 鉛筆が <dd> 内にある → <dd> の中で SVG/div.css-fbr94v 以外のテキストノード
  const dd = pencilSvg.closest('dd')
  if (dd !== null) {
    // dd内の直接テキストか、pencilの前にあるspan/div
    for (const child of dd.childNodes) {
      if (child.nodeType === Node.TEXT_NODE && (child.textContent ?? '').trim() !== '') {
        // テキストノードをspanで囲んで返す
        const span = document.createElement('span')
        span.textContent = (child.textContent ?? '').trim()
        child.replaceWith(span)
        return span
      }
      if (child instanceof HTMLElement && !child.classList.contains('css-fbr94v') && child.tagName !== 'svg') {
        return child
      }
    }
  }
  // パターン2: ページ名 → 鉛筆の前の兄弟要素
  const parent = (pencilSvg.closest('.css-fbr94v') ?? pencilSvg).parentElement
  if (parent !== null) {
    for (const child of parent.children) {
      if (child !== pencilSvg.closest('.css-fbr94v') && child !== pencilSvg && child instanceof HTMLElement) {
        const text = (child.textContent ?? '').trim()
        if (text !== '') return child
      }
    }
  }
  return null
}

/** フィールドキーに応じて、PUT /ab_tests/:uid に送る部分更新ボディを作る */
function buildPatchBody(key: string, value: string): Record<string, unknown> {
  switch (key) {
    case 'title': return { title: value }
    case 'ad_status': {
      const map: Record<string, string> = { '準備中': 'prepared', '配信中': 'delivered', '停止中': 'stopping', '終了': 'finished' }
      return { ad_status: map[value] ?? value }
    }
    case 'delivery_type': return { delivery_type: value }
    case 'conversion_condition': return { conversion_condition: value.toLowerCase() === 'アクセス' ? 'access' : 'click' }
    case 'conversion_unit_price': return { conversion_unit_price: Number(value) || 0 }
    default: return { [key]: value }
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
    // 線だけ（既定）— stroke を残さないと星が透明になる
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke', '#999')
    path.setAttribute('stroke-width', '1')
  }
}
