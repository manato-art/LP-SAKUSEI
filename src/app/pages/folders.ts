/**
 * 「ページ」画面（`/folders`）。企画書 §1-4 の基準状態＝**新規アカウントの空状態**から始まり、
 * フォルダ作成 → beyondページ作成 → エディタへ、という作成フローが実際に通る。
 *
 * ## 作り方（企画書 §11 capture-and-rehydrate・共通指示 §2）
 *
 * 見た目は**採取した実DOM**（`fragments/folders__empty-selection.html`）と実CSSが担う。
 * 以前この画面だけ `document.createElement` と手書きのインラインCSSで組んでいたが、
 * それは「手書きで似せない」という本案件の中核規律に反していたので土台へ差し替えた。
 * クラス名は Emotion / styled-components が振った実物のまま。CSSは1行も書き足していない
 * （`src/index.html` が `/clean/folders/empty-selection/cssom.css` を読み込み済み）。
 *
 * 配線は `folders-substrate.ts` の `FOLDERS_HOOK`（実在する `data-testid` と実クラス）だけを掴む。
 * 目印が採取物に在ることは `tests/folders.test.ts` が採取HTMLと突き合わせて機械証明している。
 *
 * ## 採取できていない範囲（作り足していない・正直に出す）
 *
 * 1. **フォルダ選択後の中央ペイン**。採取したのはフォルダ未選択の状態だけで、
 *    一覧の容器（`.efy50tl20`）は空。beyondページ行と「新規ページを作成」の実マークアップが無い。
 *    → ここだけクローン側の暫定表示（`ui.ts`）を容器の中に置き、画面上でもそう明記する。
 * 2. **選択中フォルダの行スタイル**。採取時にどの行も選択されていないため、
 *    Emotion が選択状態のクラスを出力していない。行のハイライトは推測で足さない。
 *    選択中がどれかは中央ペインの見出し（フォルダ名）で示す。
 * 3. **フォルダグループ行**。実物のツリーはグループ行とフォルダ行の2種類だが、
 *    クローンのモックにグループの概念が無いので、土台にするのはフォルダ行の方だけ。
 */
import substrate from '../fragments/folders__empty-selection.html?raw'
import { isStale } from '../main.ts'
import { api, type AbTest, type Folder } from '../api.ts'
import { T, button, el, emptyState, toast } from '../ui.ts'
import {
  FOLDERS_HOOK,
  FOLDER_UID_ATTRIBUTE,
  extractFolderRowTemplate,
} from './folders-substrate.ts'
import { openCreateFolder, openCreatePage } from './folders-create.ts'

/** 採取物から切り出したフォルダ1行ぶんのマークアップ（読み込み時に一度だけ） */
const FOLDER_ROW_TEMPLATE = extractFolderRowTemplate(substrate)

/** 配信ステータスの表示名（正本は `mock-server/store/types.ts`・2026-08-31 実機観測） */
const AD_STATUS_LABELS: Readonly<Record<string, string>> = {
  prepared: '準備中',
  delivered: '配信中',
  stopping: '停止中',
  finished: '終了',
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
  renderTree(body, context)
  renderPageList(body, context)
  wireUncapturedTreeControls(body)
  wireUncapturedMainControls(body)
}

// ── 左: フォルダツリー ─────────────────────────────────

/**
 * 採取物のフォルダ行を捨て、モックのフォルダで置き換える。
 * 行のマークアップは採取物そのまま（`FOLDER_ROW_TEMPLATE`）を複製して使う。
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
  for (const folder of context.folders) {
    const wrapper = document.createElement('div')
    wrapper.append(folderRow(prototypeRow, folder))
    rows.append(wrapper)
  }
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
  wireUncapturedRowActions(row)
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

// ── 右: beyondページ一覧（この容器の中だけクローン側の暫定表示）──────

/**
 * 中央ペインの一覧。**実マークアップは採取していない**（フォルダ未選択の状態しか採取していないため、
 * 採取物のこの容器は空）。CSSから形を推測して「それらしい表」を組むと実物と違うものを
 * 実物のふりで置くことになるので、クローン側の部品だと分かる見た目で置き、画面にもそう書く。
 */
function renderPageList(body: HTMLElement, context: PageContext): void {
  const area = body.querySelector<HTMLElement>(FOLDERS_HOOK.listArea)
  if (area === null) {
    console.warn('[folders]', FOLDERS_HOOK.listArea, 'が土台に見つかりませんでした')
    return
  }
  const own = el('div', {
    style: `flex:1;min-height:1%;overflow:auto;font-family:${T.font};display:flex;flex-direction:column`,
  })

  if (context.folder === null) {
    own.append(
      emptyState(
        context.folders.length === 0
          ? 'フォルダがまだありません。ツリー左上のフォルダ追加ボタンから作成します。'
          : 'ツリーからフォルダを選ぶと、そのフォルダのbeyondページが表示されます。',
      ),
    )
  } else {
    own.append(listHeader(context.folder), listBody(context.folder, context.abTests))
  }
  own.append(
    el('div', {
      text: '※ beyondページ一覧の実マークアップは未採取（フォルダ選択後の状態を採取していない）のため、この一覧はクローン側の暫定表示です。',
      style: `font-size:11px;color:${T.sub};line-height:1.8;padding:10px 16px;border-top:1px solid #E5E5E5`,
    }),
  )
  area.replaceChildren(own)
}

/** 媒体ロスターの取得で失敗しうるので、握りつぶさずトーストで出す */
function startCreatePage(folder: Folder): void {
  void openCreatePage(folder).catch((error: unknown) => {
    toast((error as Error).message, 'error')
  })
}

function listHeader(folder: Folder): HTMLElement {
  const create = button('新規ページを作成')
  create.addEventListener('click', () => startCreatePage(folder))
  return el(
    'div',
    {
      style: `display:flex;align-items:center;gap:12px;padding:12px 16px;background:${T.surface};
        border-bottom:1px solid #E5E5E5`,
    },
    [
      el('strong', {
        text: folder.name,
        style: 'font-size:14px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap',
      }),
      create,
    ],
  )
}

function listBody(folder: Folder, abTests: readonly AbTest[]): HTMLElement {
  if (abTests.length === 0) {
    const create = button('新規ページを作成')
    create.addEventListener('click', () => startCreatePage(folder))
    return emptyState('このフォルダにはまだbeyondページがありません。', create)
  }
  return el(
    'div',
    { style: 'flex:1;min-height:1%' },
    abTests.map((abTest) => pageRow(abTest)),
  )
}

function pageRow(abTest: AbTest): HTMLElement {
  const open = button('エディタを開く')
  open.addEventListener('click', () => {
    location.hash = `/ab_tests/${abTest.uid}/articles`
  })
  const editorLabel = abTest.editor_version === 2 ? 'beyondエディター' : 'HTMLエディター'
  const status = AD_STATUS_LABELS[abTest.ad_status] ?? abTest.ad_status
  return el(
    'div',
    {
      style: `background:${T.surface};border-bottom:1px solid #E5E5E5;padding:14px 16px;
        display:flex;align-items:center;gap:14px`,
    },
    [
      el('div', { style: 'flex:1;min-width:0' }, [
        el('div', { text: abTest.title, style: 'font-size:14px;font-weight:600;margin-bottom:5px' }),
        el('div', {
          text: `${status} · ${abTest.media?.name ?? '媒体なし'} · ${editorLabel}`,
          style: `font-size:11px;color:${T.sub}`,
        }),
      ]),
      open,
    ],
  )
}

// ── 採取物に在るが、挙動を採取できていないもの ────────────────

/** 押した後の画面を採取していない操作。それらしい画面を作らず、そう言う（§3-5）。 */
function wireNotCaptured(node: Element | null | undefined, label: string): void {
  node?.addEventListener('click', () => {
    toast(`「${label}」は採取していないため未実装です`, 'error')
  })
}

function wireUncapturedTreeControls(body: HTMLElement): void {
  const tree = body.querySelector<HTMLElement>(FOLDERS_HOOK.tree)
  if (tree === null) {
    console.warn('[folders]', FOLDERS_HOOK.tree, 'が土台に見つかりませんでした')
    return
  }
  // 新規フォルダ作成だけは起点のボタンが採取できている（作成フローの入口）
  const create = tree.querySelector(FOLDERS_HOOK.createFolderIcon)?.closest('button') ?? null
  if (create === null) console.warn('[folders] 新規フォルダ作成のボタンが土台に見つかりませんでした')
  else create.addEventListener('click', openCreateFolder)

  wireNotCaptured(tree.querySelector(FOLDERS_HOOK.treeSearchIcon)?.closest('button'), '検索')
  for (const tab of tree.querySelectorAll<HTMLElement>(FOLDERS_HOOK.treeTab)) {
    const label = (tab.textContent ?? '').trim()
    // 「すべて」は採取時点で選ばれている状態そのもの。切り替え先の2つだけ未採取。
    if (label === 'すべて' || label === '') continue
    wireNotCaptured(tab, label)
  }
}

function wireUncapturedMainControls(body: HTMLElement): void {
  const main = body.querySelector<HTMLElement>(FOLDERS_HOOK.mainPane)
  if (main === null) {
    console.warn('[folders]', FOLDERS_HOOK.mainPane, 'が土台に見つかりませんでした')
    return
  }
  wireNotCaptured(main.querySelector(FOLDERS_HOOK.folderSearchButton), 'フォルダ内検索')
  wireNotCaptured(main.querySelector(FOLDERS_HOOK.periodSelect), '集計期間')
  wireNotCaptured(main.querySelector(FOLDERS_HOOK.adStatusSelect), '配信ステータス')
}

/** 行のホバーで出るお気に入り・設定。押した後が採取できていない。 */
function wireUncapturedRowActions(row: HTMLElement): void {
  const actions = row.querySelector<HTMLElement>(FOLDERS_HOOK.folderRowActions)
  if (actions === null) return
  for (const action of actions.querySelectorAll<HTMLElement>('button')) {
    action.addEventListener('click', (event) => {
      // 行のクリック（フォルダ選択）まで飛ばさない
      event.stopPropagation()
      toast('フォルダの操作メニューは採取していないため未実装です', 'error')
    })
  }
}
