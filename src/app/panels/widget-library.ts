/**
 * Widgetライブラリ（右レール「Widget」ボタンから開く）。
 *
 * 採取した実DOM＋実CSS（`widget-library.portals.html`）を土台に、
 * 本番UIとの差分をJS側で補正（タイトル・カテゴリー構造・Widgetを作成ボタン等）。
 *
 * 挙動:
 *   - 閉じる／背景クリックで閉じる
 *   - カテゴリー選択の見た目切替
 *   - Widget検索（カード名での絞り込み）
 *   - 追加（本文へ挿入）／プレビュー
 *   - Widgetを作成（Widget名・カテゴリー・説明文・HTML/CSSエディタ）
 */
import type Quill from 'quill'
import rawLibrary from '../fragments/ab_tests__UID__articles__widget-library.portals.html?raw'
import { toast } from '../ui.ts'
import { bindBackdropClose, findByExactText, openPortal } from './portal.ts'

const HOOK = {
  trigger: '[aria-label="Widget管理"]',
  dialog: '.MuiDialog-root',
  backdrop: '.MuiBackdrop-root',
  close: '閉じる',
  button: 'button',
  search: 'input[placeholder="検索"]',
  category: '.MuiButton-fullWidth',
  /** カード一覧の器（このカテゴリーぶんのカードだけを入れ替える）。 */
  grid: '.css-ojejk4',
  card: '.MuiCard-root',
  cardTitle: '.MuiCardHeader-title p',
} as const

/** カテゴリー資産（採取＋匿名化＋gzip 済み）の場所。ボタンの並び順＝cat番号。 */
const CATEGORY_ASSET = (index: number): string =>
  `/clean/widget-library/cat${index}/grid.html.gz`

/** 採取していないカテゴリー（お気に入り＝ユーザー個別のため空で扱う）。 */
const UNCAPTURED_CATEGORIES = new Set<number>([1])

/** 仮想カテゴリーのセンチネル値。gz 資産が無い = 空メッセージを出す。 */
const VIRTUAL_CAT = -1

/** 本番で追加された仮想カテゴリー（採取時には無かったもの）。 */
const VIRTUAL_CATEGORY_LABELS: readonly { label: string; emptyMsg: string }[] = [
  { label: '最近利用', emptyMsg: '最近利用したウィジェットはありません。' },
  { label: 'チームで追加・作成', emptyMsg: 'チームで追加・作成されたウィジェットはありません。' },
  { label: '最近追加', emptyMsg: '最近追加されたウィジェットはありません。' },
]

/** 取得済みカテゴリーのカードHTMLをセッション内でキャッシュ（再取得しない）。 */
const gridCache = new Map<number, string>()

let isOpen = false

export function mountWidgetLibrary(root: HTMLElement, quill: Quill): void {
  const trigger = root.querySelector<HTMLElement>(HOOK.trigger)
  if (trigger === null) {
    console.warn('[widget-library] パズルピース（Widget管理）が土台に見つからないので配線しない')
    return
  }
  if (trigger.dataset['widgetLibraryWired'] === 'true') return
  trigger.dataset['widgetLibraryWired'] = 'true'
  trigger.style.cursor = 'pointer'
  trigger.addEventListener('click', (event) => {
    event.stopPropagation()
    open(quill)
  })
}

function open(quill: Quill): void {
  if (isOpen) return
  const portal = openPortal(rawLibrary, HOOK.dialog, () => {
    isOpen = false
  })
  if (portal === null) {
    toast('Widgetライブラリのマークアップが壊れています', 'error')
    return
  }
  isOpen = true

  const backdrop = portal.root.querySelector<HTMLElement>(HOOK.backdrop)
  if (backdrop !== null) bindBackdropClose(backdrop, portal.close)

  findByExactText(portal.root, HOOK.button, HOOK.close)?.addEventListener('click', () => portal.close())

  /* ── 本番 UI との差分を DOM 補正 ── */
  patchPortalLayout(portal.root, quill, portal.close)

  wireCategories(portal.root, quill, portal.close)
  wireSearch(portal.root)
  wireCards(portal.root, quill, portal.close)
  // 開いた直後に「すべて」の全件へ差し替える。
  void loadCategory(portal.root, quill, portal.close, 0)
}

/* ================================================================
 *  本番 UI との差分を DOM 側で補正する
 * ================================================================ */

function patchPortalLayout(root: HTMLElement, quill: Quill, close: () => void): void {
  /* ---- 1. タイトル「Widgetライブラリ」→「Widget」 ---- */
  const titleEl = root.querySelector<HTMLElement>('.css-kzzyvh')
  if (titleEl !== null) titleEl.textContent = 'Widget'

  /* ---- 2. 最初のカテゴリー名を「すべて」に変更 ---- */
  const categories = [...root.querySelectorAll<HTMLElement>(HOOK.category)]
  if (categories.length > 0) {
    const firstBtn = categories[0]!
    // テキストノードだけ差し替え（MuiTouchRipple は残す）
    const span = firstBtn.querySelector<HTMLElement>('.MuiTouchRipple-root')
    if (span !== null) {
      firstBtn.childNodes.forEach((n) => {
        if (n !== span && n.nodeType === Node.TEXT_NODE) n.textContent = ''
      })
      firstBtn.insertBefore(document.createTextNode('すべて'), span)
    } else {
      firstBtn.textContent = 'すべて'
    }
  }

  /* ---- 3. data-cat-index を既存ボタンに付与（gz 連番のまま） ---- */
  for (const [i, cat] of categories.entries()) {
    cat.dataset['catIndex'] = String(i)
  }

  /* ---- 4. 仮想カテゴリー挿入 (お気に入り(index=1)の後ろに) ---- */
  const categoryContainer = root.querySelector<HTMLElement>('.css-1qli419')
  if (categoryContainer !== null && categories.length >= 2) {
    const insertAfter = categories[1]! // お気に入り
    for (const vc of VIRTUAL_CATEGORY_LABELS) {
      const btn = createCategoryButton(vc.label)
      btn.dataset['catIndex'] = String(VIRTUAL_CAT)
      btn.dataset['emptyMsg'] = vc.emptyMsg
      insertAfter.parentNode?.insertBefore(btn, insertAfter.nextSibling)
      // insertAfter を更新して順序を保つ
    }
    // 逆順に挿入されるので正しい順序にするためもう一度取り出す
    // → 実は insertBefore の参照先が変わらないので、全部 insertAfter.nextSibling に入る
    // → 結果的に逆順。修正: 1つずつ anchor を更新する
  }
  // 正しい順序で挿入し直す
  if (categoryContainer !== null && categories.length >= 2) {
    // 一旦仮想ボタンを全部除去して再挿入
    for (const el of categoryContainer.querySelectorAll<HTMLElement>('[data-cat-index="-1"]')) {
      el.remove()
    }
    let anchor = categories[1]! // お気に入り
    for (const vc of VIRTUAL_CATEGORY_LABELS) {
      const btn = createCategoryButton(vc.label)
      btn.dataset['catIndex'] = String(VIRTUAL_CAT)
      btn.dataset['emptyMsg'] = vc.emptyMsg
      anchor.after(btn)
      anchor = btn
    }

    /* ---- 5. 「カテゴリーから探す」セクションヘッダー挿入 ---- */
    const sectionHeader = document.createElement('h6')
    sectionHeader.textContent = 'カテゴリーから探す'
    sectionHeader.style.cssText =
      'font:600 13px/1.4 "Hiragino Sans",sans-serif;color:#333;' +
      'margin:16px 0 4px;padding:0 8px'
    anchor.after(sectionHeader)
  }

  /* ---- 6. 「+ Widgetを作成」ボタン挿入 ---- */
  const sidebar = root.querySelector<HTMLElement>('.css-xnrh4c')
  if (sidebar !== null) {
    const createBtn = document.createElement('button')
    createBtn.type = 'button'
    createBtn.textContent = '+ Widgetを作成'
    createBtn.style.cssText =
      'display:block;width:100%;padding:8px 16px;margin-bottom:12px;' +
      'border:1px solid #1976d2;border-radius:4px;background:#fff;' +
      'color:#1976d2;font:600 14px/1.4 "Hiragino Sans",sans-serif;' +
      'cursor:pointer;text-align:center;transition:background .15s'
    createBtn.addEventListener('mouseenter', () => {
      createBtn.style.background = '#e3f2fd'
    })
    createBtn.addEventListener('mouseleave', () => {
      createBtn.style.background = '#fff'
    })
    createBtn.addEventListener('click', () => {
      openWidgetCreator(root, quill, close)
    })
    // ヘッダー（「カテゴリー」見出し）の前に挿入
    const catHeader = sidebar.querySelector<HTMLElement>('.css-iorjen')
    if (catHeader !== null) {
      sidebar.insertBefore(createBtn, catHeader)
    } else {
      sidebar.prepend(createBtn)
    }
  }

  /* ---- 7. 検索をサイドバーに移動 ---- */
  const searchForm = root.querySelector<HTMLElement>('form.css-1bvc4cc')
  if (searchForm !== null && sidebar !== null) {
    const catHeader = sidebar.querySelector<HTMLElement>('.css-iorjen')
    // 「+ Widgetを作成」ボタンの後ろ、カテゴリーヘッダーの前
    if (catHeader !== null) {
      sidebar.insertBefore(searchForm, catHeader)
    }
    searchForm.style.marginBottom = '12px'
  }

  /* ---- 8. ヘッダーの検索跡地を非表示 ---- */
  // 検索を移動した後、ヘッダー右側の空コンテナを隠す
  const headerRight = root.querySelector<HTMLElement>('.css-155j396 > .css-i9gxme:last-child')
  if (headerRight !== null && headerRight.querySelector('form') === null) {
    headerRight.style.display = 'none'
  }
}

/** カテゴリーボタンを1つ生成（既存ボタンと同じ MUI クラス構成）。 */
function createCategoryButton(label: string): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className =
    'MuiButtonBase-root MuiButton-root MuiButton-text MuiButton-textPrimary ' +
    'MuiButton-sizeMedium MuiButton-textSizeMedium MuiButton-fullWidth ' +
    'MuiButton-root MuiButton-text MuiButton-textPrimary ' +
    'MuiButton-sizeMedium MuiButton-textSizeMedium MuiButton-fullWidth css-1ukmx5'
  btn.tabIndex = 0
  btn.textContent = label
  const ripple = document.createElement('span')
  ripple.className = 'MuiTouchRipple-root css-w0pj6f'
  btn.append(ripple)
  return btn
}

/* ================================================================
 *  カテゴリー選択
 * ================================================================ */

function wireCategories(root: HTMLElement, quill: Quill, close: () => void): void {
  const categories = [...root.querySelectorAll<HTMLElement>(HOOK.category)]
  for (const cat of categories) {
    cat.addEventListener('click', () => {
      activateCategory(categories, cat)
      const catIndex = Number(cat.dataset['catIndex'] ?? '0')
      if (catIndex === VIRTUAL_CAT) {
        // 仮想カテゴリー: 空メッセージ
        const grid = root.querySelector<HTMLElement>(HOOK.grid)
        if (grid !== null) {
          grid.innerHTML = ''
          grid.append(gridMessage(cat.dataset['emptyMsg'] ?? 'ウィジェットはありません。'))
        }
      } else {
        void loadCategory(root, quill, close, catIndex)
      }
    })
  }
}

/**
 * 選択中カテゴリーの塗り（オレンジ）を移す。実物の選択色は Emotion クラス
 * `css-148uesp`（選択・オレンジ）／`css-1ukmx5`（非選択）。
 */
function activateCategory(categories: readonly HTMLElement[], target: HTMLElement): void {
  for (const cat of categories) {
    const on = cat === target
    cat.classList.toggle('css-148uesp', on)
    cat.classList.toggle('css-1ukmx5', !on)
    cat.classList.toggle('MuiButton-containedSizeMedium', on)
    cat.classList.toggle('MuiButton-textSizeMedium', !on)
    cat.classList.toggle('MuiButton-contained', on)
    cat.classList.toggle('MuiButton-containedPrimary', on)
    cat.classList.toggle('MuiButton-text', !on)
    cat.classList.toggle('MuiButton-textPrimary', !on)
  }
}

/* ================================================================
 *  カテゴリー読み込み
 * ================================================================ */

async function loadCategory(
  root: HTMLElement,
  quill: Quill,
  close: () => void,
  index: number,
): Promise<void> {
  const grid = root.querySelector<HTMLElement>(HOOK.grid)
  if (grid === null) return
  if (UNCAPTURED_CATEGORIES.has(index)) {
    grid.innerHTML = ''
    grid.append(gridMessage('このカテゴリー（お気に入り）は各ユーザー個別のため、クローンでは空です。'))
    return
  }
  grid.innerHTML = ''
  grid.append(gridMessage('読み込み中…'))
  try {
    const html = await fetchCategoryGrid(index)
    if (html === null) {
      grid.innerHTML = ''
      grid.append(gridMessage('このカテゴリーの読み込みに失敗しました。'))
      return
    }
    grid.innerHTML = html
    wireCards(root, quill, close)
    applySearchFilter(root)
  } catch {
    grid.innerHTML = ''
    grid.append(gridMessage('このカテゴリーの読み込みに失敗しました。'))
  }
}

async function fetchCategoryGrid(index: number): Promise<string | null> {
  const cached = gridCache.get(index)
  if (cached !== undefined) return cached
  const res = await fetch(CATEGORY_ASSET(index))
  if (!res.ok) return null
  const buffer = await res.arrayBuffer()
  const html = await gunzipToText(buffer)
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const grid = doc.querySelector<HTMLElement>(HOOK.grid)
  const inner = grid === null ? null : grid.innerHTML
  if (inner !== null) gridCache.set(index, inner)
  return inner
}

async function gunzipToText(buffer: ArrayBuffer): Promise<string> {
  try {
    const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))
    return await new Response(stream).text()
  } catch {
    return new TextDecoder().decode(buffer)
  }
}

function gridMessage(text: string): HTMLElement {
  const box = document.createElement('div')
  box.textContent = text
  box.style.cssText =
    'grid-column:1/-1;padding:40px 16px;text-align:center;color:#bbb;font:14px "Hiragino Sans",sans-serif'
  return box
}

/* ================================================================
 *  検索
 * ================================================================ */

function wireSearch(root: HTMLElement): void {
  const input = root.querySelector<HTMLInputElement>(HOOK.search)
  if (input === null) return
  input.addEventListener('input', () => applySearchFilter(root))
}

function applySearchFilter(root: HTMLElement): void {
  const input = root.querySelector<HTMLInputElement>(HOOK.search)
  if (input === null) return
  const query = input.value.trim().toLowerCase()
  for (const card of root.querySelectorAll<HTMLElement>(HOOK.card)) {
    const title = (card.querySelector(HOOK.cardTitle)?.textContent ?? '').toLowerCase()
    card.style.display = query === '' || title.includes(query) ? '' : 'none'
  }
}

/* ================================================================
 *  カード操作（プレビュー / 追加）
 * ================================================================ */

function wireCards(root: HTMLElement, quill: Quill, close: () => void): void {
  for (const card of root.querySelectorAll<HTMLElement>(HOOK.card)) {
    const title = (card.querySelector(HOOK.cardTitle)?.textContent ?? 'Widget').trim()
    const buttons = [...card.querySelectorAll<HTMLElement>('.MuiCardActions-root button')]
    const preview = buttons.find((b) => b.textContent?.trim() === 'プレビュー')
    const add = buttons.find((b) => b.textContent?.trim() === '追加')
    preview?.addEventListener('click', (event) => {
      event.stopPropagation()
      openLargePreview(card, title)
    })
    add?.addEventListener('click', (event) => {
      event.stopPropagation()
      const bodyHtml = widgetBodyHtml(card)
      close()
      requestAnimationFrame(() => {
        insertWidget(quill, bodyHtml, title)
        toast(`「${title}」を追加しました`)
      })
    })
  }
}

function widgetBodyHtml(card: HTMLElement): string | null {
  const srcdoc = card.querySelector('iframe')?.getAttribute('srcdoc')
  if (srcdoc === null || srcdoc === undefined || srcdoc === '') return null
  const doc = new DOMParser().parseFromString(srcdoc, 'text/html')
  if (doc.body.innerHTML.trim() === '') return null
  const headStyles = [...doc.head.querySelectorAll('style')]
    .map((s) => s.outerHTML)
    .join('')
  return headStyles + doc.body.innerHTML
}

/* ================================================================
 *  プレビュー（原寸 iframe）
 * ================================================================ */

function openLargePreview(card: HTMLElement, title: string): void {
  const srcdoc = card.querySelector('iframe')?.getAttribute('srcdoc')
  if (srcdoc === null || srcdoc === undefined || srcdoc === '') {
    toast(`「${title}」のプレビューを表示できません`, 'error')
    return
  }
  const overlay = document.createElement('div')
  overlay.setAttribute('data-clone-widget-preview', 'true')
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,.6);display:flex;' +
    'align-items:center;justify-content:center;padding:24px'
  const panel = document.createElement('div')
  panel.style.cssText =
    'background:#fff;border-radius:10px;width:min(680px,92vw);height:min(80vh,760px);' +
    'display:flex;flex-direction:column;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.4)'
  const bar = document.createElement('div')
  bar.style.cssText =
    'display:flex;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid #eee;font:600 13px "Hiragino Sans",sans-serif'
  const name = document.createElement('div')
  name.textContent = title
  name.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'
  const closeBtn = document.createElement('button')
  closeBtn.textContent = '閉じる'
  closeBtn.style.cssText =
    'border:none;background:#F0F0F0;border-radius:6px;padding:6px 12px;cursor:pointer;font:inherit'
  const frame = document.createElement('iframe')
  frame.setAttribute('srcdoc', srcdoc)
  frame.style.cssText = 'flex:1;border:none;width:100%;background:#fff'
  bar.append(name, closeBtn)
  panel.append(bar, frame)
  overlay.append(panel)
  const dismiss = (): void => overlay.remove()
  closeBtn.addEventListener('click', dismiss)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) dismiss()
  })
  document.body.append(overlay)
}

/* ================================================================
 *  Widget挿入（SbWidgetBlot 経由）
 * ================================================================ */

function insertWidget(quill: Quill, bodyHtml: string | null, title: string): void {
  if (bodyHtml === null) {
    const range = quill.getSelection(true)
    const index = range?.index ?? quill.getLength()
    const placeholder =
      `<div style="border:1px dashed #B0B0B0;border-radius:6px;padding:16px;margin:8px 0;` +
      `background:#FAFAFA;color:#555;text-align:center;font-size:14px">【Widget】${escapeHtml(title)}</div>`
    quill.clipboard.dangerouslyPasteHTML(index, placeholder, 'user')
    return
  }
  const doc = new DOMParser().parseFromString(bodyHtml, 'text/html')
  for (const style of doc.querySelectorAll('style')) {
    const css = style.textContent ?? ''
    if (css.trim() !== '') {
      const existing = [...document.head.querySelectorAll('style[data-widget-css]')]
      const alreadyHas = existing.some((s) => s.textContent === css)
      if (!alreadyHas) {
        const moved = document.createElement('style')
        moved.setAttribute('data-widget-css', 'true')
        moved.textContent = css
        document.head.append(moved)
      }
    }
    style.remove()
  }
  for (const script of doc.querySelectorAll('script')) script.remove()

  const cleaned = doc.body.innerHTML
  const range = quill.getSelection(true)
  const index = range?.index ?? quill.getLength()
  quill.insertEmbed(index, 'sbwidget', cleaned, 'user')
}

/* ================================================================
 *  Widget作成フォーム（本番「+ Widgetを作成」の再現）
 * ================================================================ */

/**
 * 本番 SquadBeyond の「Widget追加」フォームを再現する。
 * - Widget名（テキスト）
 * - カテゴリー（ドロップダウン）
 * - 説明文（テキスト）
 * - サムネイル（+アイコンの枠）
 * - エディタ領域（textarea で代替）
 * - HTML(カスタム) / CSS(カスタム) コードエディタ
 * - 「追加する」ボタン
 */
function openWidgetCreator(
  libraryRoot: HTMLElement,
  quill: Quill,
  libraryClose: () => void,
): void {
  // ライブラリの本体エリアに重ねて表示（サイドバーはそのまま）
  const contentArea = libraryRoot.querySelector<HTMLElement>('.css-5v5pzb')
  if (contentArea === null) return

  const creator = document.createElement('div')
  creator.dataset['widgetCreator'] = 'true'
  creator.style.cssText =
    'position:absolute;inset:0;z-index:10;background:#fff;display:flex;flex-direction:column;overflow-y:auto'

  /* ── ヘッダー ── */
  const header = document.createElement('div')
  header.style.cssText =
    'display:flex;align-items:center;padding:16px 24px;border-bottom:1px solid #eee;flex-shrink:0'
  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.textContent = '閉じる'
  closeBtn.style.cssText =
    'border:none;background:none;color:#555;font:14px "Hiragino Sans",sans-serif;cursor:pointer;padding:4px 8px'
  const headerTitle = document.createElement('h6')
  headerTitle.textContent = 'Widget追加'
  headerTitle.style.cssText =
    'flex:1;text-align:center;font:600 15px/1.4 "Hiragino Sans",sans-serif;margin:0;color:#333'
  const submitBtn = document.createElement('button')
  submitBtn.type = 'button'
  submitBtn.textContent = '追加する'
  submitBtn.style.cssText =
    'border:none;background:#1976d2;color:#fff;border-radius:4px;padding:6px 20px;' +
    'font:600 13px/1.4 "Hiragino Sans",sans-serif;cursor:pointer'
  header.append(closeBtn, headerTitle, submitBtn)

  /* ── メタ情報行 ── */
  const metaRow = document.createElement('div')
  metaRow.style.cssText =
    'display:flex;align-items:flex-start;gap:16px;padding:20px 24px;flex-shrink:0'

  // サムネイル枠
  const thumbWrap = document.createElement('div')
  thumbWrap.style.cssText =
    'width:80px;height:80px;border:2px dashed #ccc;border-radius:8px;' +
    'display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;color:#aaa'
  const thumbIcon = document.createElement('span')
  thumbIcon.style.cssText = 'font-size:28px;line-height:1'
  thumbIcon.textContent = '+'
  thumbWrap.append(thumbIcon)
  thumbWrap.addEventListener('click', () => {
    toast('サムネイルのアップロードはクローンでは未対応です')
  })

  // Widget名
  const nameGroup = createFormGroup('Widget名', 'text', '入力してください')

  // カテゴリー
  const catGroup = document.createElement('div')
  catGroup.style.cssText = 'flex:1;min-width:0'
  const catLabel = document.createElement('label')
  catLabel.textContent = 'カテゴリー'
  catLabel.style.cssText = 'display:block;font:12px "Hiragino Sans",sans-serif;color:#777;margin-bottom:4px'
  const catSelect = document.createElement('select')
  catSelect.style.cssText =
    'width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:4px;' +
    'font:14px "Hiragino Sans",sans-serif;color:#333;background:#fff'
  const catOptions = [
    '選択してください', '見出し', '囲み枠', '吹き出し', '文字', '画像',
    'クチコミ', 'フッター', 'アクション', 'ボタン', '表', '埋め込み',
    '自動表示', 'アンケート', 'テンプレート記事', 'オリジナル', '区切り線',
  ]
  for (const opt of catOptions) {
    const o = document.createElement('option')
    o.value = opt
    o.textContent = opt
    catSelect.append(o)
  }
  catGroup.append(catLabel, catSelect)

  // 説明文
  const descGroup = createFormGroup('説明文', 'text', '入力してください')

  metaRow.append(thumbWrap, nameGroup, catGroup, descGroup)

  /* ── エディタ領域 ── */
  const editorArea = document.createElement('div')
  editorArea.style.cssText =
    'flex:1;display:flex;gap:0;padding:0 24px 20px;min-height:300px'

  // 左: Quill風エディタ (textarea)
  const editorLeft = document.createElement('div')
  editorLeft.style.cssText = 'flex:1;display:flex;flex-direction:column;border:1px solid #ddd;border-radius:4px;overflow:hidden'

  const toolbar = createEditorToolbar()
  const editorBody = document.createElement('textarea')
  editorBody.placeholder = 'WidgetのHTMLを入力してください'
  editorBody.style.cssText =
    'flex:1;border:none;resize:none;padding:16px;font:14px/1.6 "Hiragino Sans",monospace;' +
    'outline:none;background:#fff;min-height:200px'
  editorLeft.append(toolbar, editorBody)

  // 右: HTML(カスタム) / CSS(カスタム)
  const editorRight = document.createElement('div')
  editorRight.style.cssText = 'width:280px;display:flex;flex-direction:column;gap:0;flex-shrink:0;margin-left:-1px'

  const htmlPanel = createCodePanel('HTML(カスタム)', '<div class="my-widget">\n  \n</div>')
  const cssPanel = createCodePanel('CSS(カスタム)', '.my-widget {\n  \n}')
  editorRight.append(htmlPanel, cssPanel)

  editorArea.append(editorLeft, editorRight)

  /* ── 組み立て ── */
  creator.append(header, metaRow, editorArea)

  // dialog の paper にポジション relative が必要
  const paper = libraryRoot.querySelector<HTMLElement>('.MuiDialog-paper')
  if (paper !== null) paper.style.position = 'relative'
  ;(paper ?? contentArea).append(creator)

  /* ── イベント ── */
  closeBtn.addEventListener('click', () => creator.remove())

  submitBtn.addEventListener('click', () => {
    const nameInput = nameGroup.querySelector('input') as HTMLInputElement | null
    const widgetName = nameInput?.value.trim() ?? ''
    if (widgetName === '') {
      toast('Widget名を入力してください', 'error')
      return
    }

    // HTML/CSS パネルの内容、またはエディタ本文を使う
    const htmlTextarea = htmlPanel.querySelector('textarea') as HTMLTextAreaElement | null
    const cssTextarea = cssPanel.querySelector('textarea') as HTMLTextAreaElement | null
    const htmlCode = htmlTextarea?.value.trim() ?? ''
    const cssCode = cssTextarea?.value.trim() ?? ''
    const editorContent = editorBody.value.trim()

    // コード入力があればそちらを優先、無ければエディタ本文
    const finalHtml = htmlCode !== '' || cssCode !== ''
      ? (cssCode !== '' ? `<style>${cssCode}</style>` : '') + htmlCode
      : editorContent

    if (finalHtml === '') {
      toast('HTMLまたはエディタの内容を入力してください', 'error')
      return
    }

    creator.remove()
    libraryClose()
    requestAnimationFrame(() => {
      insertWidget(quill, finalHtml, widgetName)
      toast(`「${widgetName}」を追加しました`)
    })
  })
}

function createFormGroup(label: string, type: string, placeholder: string): HTMLDivElement {
  const group = document.createElement('div')
  group.style.cssText = 'flex:1;min-width:0'
  const lbl = document.createElement('label')
  lbl.textContent = label
  lbl.style.cssText = 'display:block;font:12px "Hiragino Sans",sans-serif;color:#777;margin-bottom:4px'
  const input = document.createElement('input')
  input.type = type
  input.placeholder = placeholder
  input.style.cssText =
    'width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:4px;' +
    'font:14px "Hiragino Sans",sans-serif;color:#333;box-sizing:border-box'
  group.append(lbl, input)
  return group
}

function createEditorToolbar(): HTMLDivElement {
  const toolbar = document.createElement('div')
  toolbar.style.cssText =
    'display:flex;flex-wrap:wrap;gap:2px;padding:6px 8px;border-bottom:1px solid #ddd;background:#fafafa'
  const tools = [
    '↩', '↪', 'sans-serif ▾', '−', '16', '+',
    'B', 'U', 'S', '≡ ▾', 'A ▾', '■ ▾',
    '🖼', '💡', '⏎', '🔗', 'T̸',
  ]
  for (const t of tools) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = t
    btn.style.cssText =
      'border:1px solid #e0e0e0;background:#fff;border-radius:3px;padding:3px 6px;' +
      'font:12px "Hiragino Sans",sans-serif;color:#555;cursor:pointer;min-width:24px'
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      toast('ツールバー機能はクローンでは利用できません')
    })
    toolbar.append(btn)
  }
  return toolbar
}

function createCodePanel(title: string, placeholder: string): HTMLDivElement {
  const panel = document.createElement('div')
  panel.style.cssText =
    'flex:1;display:flex;flex-direction:column;border:1px solid #333;overflow:hidden'

  const header = document.createElement('div')
  header.style.cssText =
    'background:#151515;color:#fff;padding:8px 12px;font:12px/1.4 monospace;' +
    'display:flex;align-items:center;justify-content:space-between;flex-shrink:0'
  header.textContent = title

  // プレビュー / コード切替ボタン（見た目のみ）
  const btnGroup = document.createElement('span')
  btnGroup.style.cssText = 'display:flex;gap:4px'
  for (const icon of ['👁', '{ }']) {
    const b = document.createElement('button')
    b.type = 'button'
    b.textContent = icon
    b.style.cssText =
      'border:1px solid #555;background:#2B2B2B;color:#ccc;border-radius:3px;' +
      'padding:2px 6px;font:11px monospace;cursor:pointer'
    btnGroup.append(b)
  }
  header.append(btnGroup)

  const textarea = document.createElement('textarea')
  textarea.value = placeholder
  textarea.spellcheck = false
  textarea.style.cssText =
    'flex:1;border:none;resize:none;padding:10px 12px;' +
    'font:13px/1.5 "SF Mono",Menlo,monospace;color:#eeffff;' +
    'background:#151515;outline:none;min-height:100px'

  panel.append(header, textarea)
  return panel
}

/* ================================================================
 *  ユーティリティ
 * ================================================================ */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
