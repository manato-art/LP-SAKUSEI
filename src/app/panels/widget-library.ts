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
import { applyCodeSelectionStyle } from './code-selection.ts'
import type Quill from 'quill'
import rawLibrary from '../fragments/ab_tests__UID__articles__widget-library.portals.html?raw'
import { toast } from '../ui.ts'
import { ensureWhiteBase } from '../white-base.ts'
import { bindBackdropClose, findByExactText, openPortal } from './portal.ts'
import { highlight } from './syntax-highlight.ts'
import { stripLeakedEditorImgBorder } from './widget-css-sanitize.ts'

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

/** 「お気に入り」カテゴリーのインデックス（採取物の2番目のボタン）。指示157で localStorage 連動に。 */
const FAVORITE_CAT = 1

/** 採取していないカテゴリー（現状なし。お気に入りは指示157で localStorage 連動にした）。 */
const UNCAPTURED_CATEGORIES = new Set<number>([])

/** 「作成したWidget」カテゴリーのセンチネル値（localStorage の自作Widgetを出す）。 */
const CREATED_CAT = -2

/** 「作成したWidget」の空メッセージ。 */
const CREATED_EMPTY_MSG = '作成したWidgetはまだありません。「＋ Widgetを作成」から作成できます。'

/** 自作Widget（「＋ Widgetを作成」で作ったもの）を保存する localStorage キー。 */
const CREATED_WIDGETS_KEY = 'lp-sakusei:created-widgets'

interface CreatedWidget {
  id: string
  name: string
  html: string
  ts: number
}

/** localStorage から自作Widget一覧を読む（壊れていれば空）。 */
function loadCreatedWidgets(): CreatedWidget[] {
  try {
    const raw = localStorage.getItem(CREATED_WIDGETS_KEY)
    if (raw === null || raw === '') return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as CreatedWidget[]) : []
  } catch {
    return []
  }
}

/** 自作Widgetを1件保存する（先頭に追加・最大100件）。 */
function saveCreatedWidget(name: string, html: string): void {
  try {
    const list = loadCreatedWidgets()
    list.unshift({ id: `cw_${Date.now().toString(36)}`, name, html, ts: Date.now() })
    localStorage.setItem(CREATED_WIDGETS_KEY, JSON.stringify(list.slice(0, 100)))
  } catch {
    /* localStorage 不可でも作成自体は続行 */
  }
}

/** 自作Widgetを1件削除する。 */
function deleteCreatedWidget(id: string): void {
  try {
    const list = loadCreatedWidgets().filter((w) => w.id !== id)
    localStorage.setItem(CREATED_WIDGETS_KEY, JSON.stringify(list))
  } catch {
    /* no-op */
  }
}

/* ── お気に入り（指示157）──────────────────────────────────
 * カード左下の★でWidgetをお気に入り登録し、「お気に入り」カテゴリーで再利用できる。
 * 同一Widgetは「すべて」でもカテゴリー別でも同じ名前なので、名前をキーにして状態を共有する。 */
const FAVORITE_WIDGETS_KEY = 'lp-sakusei:favorite-widgets'
const FAVORITE_EMPTY_MSG = 'お気に入りに登録したWidgetはありません。各カード左下の★で登録できます。'

interface FavoriteWidget {
  key: string
  name: string
  html: string
  ts: number
}

function loadFavorites(): FavoriteWidget[] {
  try {
    const raw = localStorage.getItem(FAVORITE_WIDGETS_KEY)
    if (raw === null || raw === '') return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as FavoriteWidget[]) : []
  } catch {
    return []
  }
}

function isFavorite(key: string): boolean {
  return loadFavorites().some((f) => f.key === key)
}

/** お気に入りを切り替える。登録したら true、解除したら false を返す。 */
function toggleFavorite(key: string, name: string, html: string): boolean {
  try {
    const list = loadFavorites()
    const idx = list.findIndex((f) => f.key === key)
    if (idx >= 0) {
      list.splice(idx, 1)
      localStorage.setItem(FAVORITE_WIDGETS_KEY, JSON.stringify(list))
      return false
    }
    list.unshift({ key, name, html, ts: Date.now() })
    localStorage.setItem(FAVORITE_WIDGETS_KEY, JSON.stringify(list.slice(0, 200)))
    return true
  } catch {
    return isFavorite(key)
  }
}

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
  ensureWhiteBase()
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

  const closeButton = findByExactText(portal.root, HOOK.button, HOOK.close)
  if (closeButton !== null) {
    closeButton.addEventListener('click', () => portal.close())
    // 指示147: 閉じるボタンを白基調に（背景に同化させない）。採取物の暗色ピルを上書きする。
    closeButton.style.cssText =
      'background:#fff;color:#333;border:1px solid #d5d5d5;border-radius:6px;' +
      'padding:6px 16px;font:600 13px/1.4 "Hiragino Sans",sans-serif;cursor:pointer;' +
      'box-shadow:0 1px 3px rgba(0,0,0,.12)'
  }

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

/**
 * カード一覧（`.css-ojejk4`）を3列にする（要望: 3つ横並び）。
 * カテゴリー切替で innerHTML が差し替わるため、インラインではなく1回だけ <style> で当てる。
 *
 * 方式は **flex（採取のまま）+ 各カード幅を1/3**。
 * grid 化は不可: 採取CSSが `grid-template-rows: 2px …` を持ち、grid では行サイズ計算が
 * カード高さ(297px)を拾えず行が2pxに潰れてカードが重なった（実測で確認）。
 * 一方 flex は `align-items:stretch` が採取カードの `height:0` を中身の高さまで伸ばすので、
 * 幅だけ 1/3 に絞れば高さも正しく3列で並ぶ（元の2列が成立していたのと同じ仕組み）。
 * gap 32px(=16px×2) を3カードで割るため 1枚 = calc(33.333% - 11px)。
 */
function injectWidgetGridCss(): void {
  if (document.getElementById('sb-widget-grid-3col') !== null) return
  const style = document.createElement('style')
  style.id = 'sb-widget-grid-3col'
  style.textContent =
    '.css-ojejk4{display:flex !important;flex-wrap:wrap !important;gap:16px !important;align-content:flex-start !important}' +
    '.css-ojejk4>.MuiCard-root{box-sizing:border-box !important;flex:0 0 calc(33.333% - 11px) !important;max-width:calc(33.333% - 11px) !important;min-width:0 !important;margin:0 !important}'
  document.head.append(style)
}

function patchPortalLayout(root: HTMLElement, quill: Quill, close: () => void): void {
  /* ---- 0. カード一覧を3列表示にする（要望: 3つ横並び。実物は2列） ---- */
  injectWidgetGridCss()

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

  /* ---- 4. 「作成したWidget」カテゴリーを お気に入り(index=1) の後ろに挿入 ----
   * 指示147: 「最近利用 / チームで追加・作成 / 最近追加」は削除し「作成したWidget」を追加。 */
  const categoryContainer = root.querySelector<HTMLElement>('.css-1qli419')
  if (categoryContainer !== null && categories.length >= 2) {
    const createdBtn = createCategoryButton('作成したWidget')
    createdBtn.dataset['catIndex'] = String(CREATED_CAT)
    categories[1]!.after(createdBtn) // お気に入りの直後

    /* ---- 5. 「カテゴリーから探す」セクションヘッダー挿入 ---- */
    const sectionHeader = document.createElement('h6')
    sectionHeader.textContent = 'カテゴリーから探す'
    sectionHeader.style.cssText =
      'font:600 13px/1.4 "Hiragino Sans",sans-serif;color:#333;' +
      'margin:16px 0 4px;padding:0 8px'
    createdBtn.after(sectionHeader)
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
      if (catIndex === CREATED_CAT) {
        // 作成したWidget: localStorage の自作Widgetをカードで表示
        renderCreatedWidgets(root, quill, close)
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
  if (index === FAVORITE_CAT) {
    // 指示157: お気に入りカテゴリーは localStorage のお気に入りWidgetを表示する。
    renderFavoriteWidgets(root, quill, close)
    return
  }
  if (UNCAPTURED_CATEGORIES.has(index)) {
    grid.innerHTML = ''
    grid.append(gridMessage('このカテゴリーは各ユーザー個別のため、クローンでは空です。'))
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
 *  作成したWidget（localStorage）の一覧描画
 * ================================================================ */

/** 「作成したWidget」カテゴリー: localStorage の自作Widgetをカードで描画する。 */
function renderCreatedWidgets(root: HTMLElement, quill: Quill, close: () => void): void {
  const grid = root.querySelector<HTMLElement>(HOOK.grid)
  if (grid === null) return
  const list = loadCreatedWidgets()
  grid.innerHTML = ''
  if (list.length === 0) {
    grid.append(gridMessage(CREATED_EMPTY_MSG))
    return
  }
  for (const w of list) {
    const card = document.createElement('div')
    card.className = 'MuiCard-root' // グリッドの3列CSS(.css-ojejk4>.MuiCard-root)を再利用
    card.style.cssText =
      'box-sizing:border-box;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;' +
      'display:flex;flex-direction:column;background:#fff'

    const frame = document.createElement('iframe')
    frame.setAttribute(
      'srcdoc',
      `<!doctype html><meta charset="utf-8"><body style="margin:0;font-family:Hiragino Sans,sans-serif">${w.html}</body>`,
    )
    frame.style.cssText = 'width:100%;height:140px;border:none;pointer-events:none;background:#fff'
    frame.setAttribute('sandbox', 'allow-same-origin')

    const titleEl = document.createElement('div')
    titleEl.textContent = w.name
    titleEl.style.cssText =
      'padding:8px 12px;font:600 13px "Hiragino Sans",sans-serif;color:#333;border-top:1px solid #eee;' +
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis'

    const actions = document.createElement('div')
    actions.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 12px;border-top:1px solid #eee'

    const del = document.createElement('button')
    del.type = 'button'
    del.textContent = '削除'
    del.style.cssText =
      'border:1px solid #E5573F;background:#fff;color:#E5573F;border-radius:6px;padding:6px 10px;' +
      'cursor:pointer;font:12px "Hiragino Sans",sans-serif'
    del.addEventListener('click', (e) => {
      e.stopPropagation()
      deleteCreatedWidget(w.id)
      renderCreatedWidgets(root, quill, close)
    })

    const add = document.createElement('button')
    add.type = 'button'
    add.textContent = '追加'
    add.style.cssText =
      'margin-left:auto;border:none;background:#0091ff;color:#fff;border-radius:6px;padding:6px 14px;' +
      'cursor:pointer;font:12px "Hiragino Sans",sans-serif'
    add.addEventListener('click', (e) => {
      e.stopPropagation()
      close()
      requestAnimationFrame(() => {
        insertWidget(quill, w.html, w.name)
        toast(`「${w.name}」を追加しました`)
      })
    })

    actions.append(del, add)
    card.append(frame, titleEl, actions)
    grid.append(card)
  }
}

/** 「お気に入り」カテゴリー: localStorage のお気に入りWidgetをカードで描画する（指示157）。 */
function renderFavoriteWidgets(root: HTMLElement, quill: Quill, close: () => void): void {
  const grid = root.querySelector<HTMLElement>(HOOK.grid)
  if (grid === null) return
  const list = loadFavorites()
  grid.innerHTML = ''
  if (list.length === 0) {
    grid.append(gridMessage(FAVORITE_EMPTY_MSG))
    return
  }
  for (const w of list) {
    const card = document.createElement('div')
    card.className = 'MuiCard-root'
    card.style.cssText =
      'box-sizing:border-box;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;' +
      'display:flex;flex-direction:column;background:#fff'

    const frame = document.createElement('iframe')
    frame.setAttribute(
      'srcdoc',
      `<!doctype html><meta charset="utf-8"><body style="margin:0;font-family:Hiragino Sans,sans-serif">${w.html}</body>`,
    )
    frame.style.cssText = 'width:100%;height:140px;border:none;pointer-events:none;background:#fff'
    frame.setAttribute('sandbox', 'allow-same-origin')

    const titleEl = document.createElement('div')
    titleEl.textContent = w.name
    titleEl.style.cssText =
      'padding:8px 12px;font:600 13px "Hiragino Sans",sans-serif;color:#333;border-top:1px solid #eee;' +
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis'

    const actions = document.createElement('div')
    actions.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 12px;border-top:1px solid #eee'

    const unfav = document.createElement('button')
    unfav.type = 'button'
    unfav.textContent = '★ 解除'
    unfav.style.cssText =
      'border:1px solid #ffa400;background:#fff;color:#c47f00;border-radius:6px;padding:6px 10px;' +
      'cursor:pointer;font:12px "Hiragino Sans",sans-serif'
    unfav.addEventListener('click', (e) => {
      e.stopPropagation()
      toggleFavorite(w.key, w.name, w.html)
      renderFavoriteWidgets(root, quill, close)
    })

    const add = document.createElement('button')
    add.type = 'button'
    add.textContent = '追加'
    add.style.cssText =
      'margin-left:auto;border:none;background:#0091ff;color:#fff;border-radius:6px;padding:6px 14px;' +
      'cursor:pointer;font:12px "Hiragino Sans",sans-serif'
    add.addEventListener('click', (e) => {
      e.stopPropagation()
      close()
      requestAnimationFrame(() => {
        insertWidget(quill, w.html, w.name)
        toast(`「${w.name}」を追加しました`)
      })
    })

    actions.append(unfav, add)
    card.append(frame, titleEl, actions)
    grid.append(card)
  }
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
    // 指示157: カード左下の★（採取物のブックマークSVG）をお気に入りトグルに配線する。
    wireFavoriteToggle(card, title)
  }
}

/** カードのブックマークSVGをお気に入りトグルにする。登録状態で色/不透明度を切り替える。 */
function wireFavoriteToggle(card: HTMLElement, title: string): void {
  const svg = card.querySelector<SVGElement>('.MuiCardActions-root > svg')
  if (svg === null) return
  const paint = (): void => {
    const on = isFavorite(title)
    svg.style.opacity = on ? '1' : '0.3'
    svg.setAttribute('aria-label', on ? 'お気に入り解除' : 'お気に入りに登録')
  }
  svg.style.cursor = 'pointer'
  paint()
  svg.addEventListener('click', (event) => {
    event.stopPropagation()
    toggleFavorite(title, title, widgetBodyHtml(card) ?? '')
    paint()
  })
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
  // ウィジェットの <style>（見た目）と <script>（動作）はそのまま保持する。
  // 実SBのウィジェットは自己完結したJS（アンケートの設問送り・カルーセル・カウントダウン等）を
  // 内蔵しており、それを配信LP/プレビューでそのまま実行することで実SBと同じ動きを再現する。
  // 赤枠警告(.ql-editor img{border:2px solid red})だけは除去（他画像への漏れ防止）。
  const cleaned = stripLeakedEditorImgBorder(doc.head.innerHTML + doc.body.innerHTML)
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

    // 作成したWidgetは localStorage に保存し、「作成したWidget」カテゴリーから再利用できるようにする（指示147）。
    saveCreatedWidget(widgetName, finalHtml)

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
  const lang = title.toLowerCase().includes('css') ? 'css' : 'html'
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

  // overlay パターン: pre(ハイライト) + textarea(入力)
  const editorBox = document.createElement('div')
  editorBox.style.cssText =
    'flex:1;position:relative;overflow:hidden;min-height:100px;background:#151515'

  const pre = document.createElement('pre')
  pre.style.cssText =
    // 指示177: inset:0 + overflow:hidden だと内容がコンテナ高さで切れ、スクロール先が空になる
    'position:absolute;top:0;left:0;min-width:100%;margin:0;padding:10px 12px;' +
    'font:13px/1.5 "SF Mono",Menlo,monospace;white-space:pre;pointer-events:none;' +
    'overflow:visible;tab-size:2;word-wrap:normal'
  pre.innerHTML = highlight(placeholder, lang)

  const textarea = document.createElement('textarea')
  textarea.value = placeholder
  textarea.spellcheck = false
  textarea.style.cssText =
    'position:relative;z-index:1;width:100%;height:100%;border:none;resize:none;padding:10px 12px;' +
    'font:13px/1.5 "SF Mono",Menlo,monospace;color:transparent;caret-color:#eeffff;' +
    'background:transparent;outline:none;white-space:pre;tab-size:2;box-sizing:border-box'
  // 指示177: 選択範囲が不透明だと下の色付きコードが隠れて読めなくなる
  applyCodeSelectionStyle(textarea)

  textarea.addEventListener('input', () => {
    pre.innerHTML = highlight(textarea.value, lang)
  })
  textarea.addEventListener('scroll', () => {
    pre.style.transform = `translate(-${textarea.scrollLeft}px,-${textarea.scrollTop}px)`
  })

  editorBox.append(pre, textarea)
  panel.append(header, editorBox)
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
