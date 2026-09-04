/**
 * Widgetライブラリ（右レール3番目「パズルピース」＝Widget管理ボタンから開く・企画書 §9-1 / §11）。
 *
 * 実物では、このパズルピースを押すと **Widgetライブラリのモーダル**（カテゴリー一覧＋
 * Widgetカードのグリッド）が開く（実機で確認）。以前のクローンは同じボタンに「Widget管理」の
 * 小さなドロップダウン（HTML編集など）を割り当てていたが、これは役割違いだったので差し替える。
 *
 * モーダルの見た目は採取した実DOM＋実CSS（`widget-library.portals.html`）がそのまま担う。
 * ここで足すのは挙動だけ:
 *   - 閉じる／背景クリックで閉じる
 *   - カテゴリー選択の見た目切替
 *   - Widget検索（カード名での絞り込み）
 *   - 追加（本文へ挿入）／プレビュー
 *
 * ## Widgetの中身（実プレビュー）
 * 各カードの中身は実物ではプレビュー iframe に動的描画される（outerHTML には残らない）。
 * そこで実アプリで各 iframe の `contentDocument` を `srcdoc` に焼き込んでから採取し直し、
 * 25枚ぶんの実プレビューを**土台（`widget-library.portals.html`）に inline** した（匿名化済み）。
 * よってカードは実物どおりプレビューを表示する。「プレビュー」= 原寸の iframe で拡大表示、
 * 「追加」= その Widget の実 body HTML を本文へ挿入する（srcdoc から取り出す）。
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

  wireCategories(portal.root, quill, portal.close)
  wireSearch(portal.root)
  wireCards(portal.root, quill, portal.close)
  // 開いた直後に「最近追加」の全件（さらに読み込む込み）へ差し替える。
  void loadCategory(portal.root, quill, portal.close, 0)
}

/** カテゴリー選択の見た目切替＋そのカテゴリーのカードを取得して差し替える。 */
function wireCategories(root: HTMLElement, quill: Quill, close: () => void): void {
  const categories = [...root.querySelectorAll<HTMLElement>(HOOK.category)]
  for (const [index, cat] of categories.entries()) {
    cat.addEventListener('click', () => {
      activateCategory(categories, cat)
      void loadCategory(root, quill, close, index)
    })
  }
}

/**
 * 選択中カテゴリーの塗り（オレンジ）を移す。実物の選択色は Emotion クラス
 * `css-148uesp`（選択・オレンジ）／`css-1ukmx5`（非選択）で、MUIの contained/text も併せて切替える。
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

/**
 * そのカテゴリーのカード一覧（採取＋匿名化＋gzip 済み）を取得して器へ差し込み、配線し直す。
 * 取得中はローディング、失敗は正直に出す。お気に入りは未採取なので空状態。
 */
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

/** gzip 資産を取得して展開し、カード一覧（器の中身）だけを返す。 */
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

/** gzip のバイト列をテキストへ。既に展開済み（サーバーが自動解凍）なら素通し。 */
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

/** Widget検索（カード名での絞り込み・クライアント側）。差し替え後も効くよう毎回引き直す。 */
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

/** 各カードの「プレビュー」「追加」を配線する。 */
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
      // 指示88: モーダルを閉じる前にWidgetのHTMLを取り出す
      // （close() でポータルがDOMから外れた後も参照は残るが、念のため先に取得）
      const bodyHtml = widgetBodyHtml(card)
      close()
      // フォーカスを戻すために1フレーム待つ
      requestAnimationFrame(() => {
        insertWidget(quill, bodyHtml, title)
        toast(`「${title}」を追加しました`)
      })
    })
  }
}

/** カードのプレビュー iframe（srcdoc に実Widgetの中身が入っている）から本文HTMLを取り出す。 */
function widgetBodyHtml(card: HTMLElement): string | null {
  const srcdoc = card.querySelector('iframe')?.getAttribute('srcdoc')
  if (srcdoc === null || srcdoc === undefined || srcdoc === '') return null
  const doc = new DOMParser().parseFromString(srcdoc, 'text/html')
  return doc.body.innerHTML.trim() === '' ? null : doc.body.innerHTML
}

/** 「プレビュー」= そのWidgetの中身を大きな iframe で開く（採取した実プレビューを原寸で見せる）。 */
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

/**
 * 「追加」= そのWidgetの実HTMLを本文へ挿入する（採取物が無ければ名前プレースホルダに退避）。
 *
 * 指示㊹修正: Widget の srcdoc には `<style>` が含まれるが、Quill は `<style>` をテキスト
 * ノードとして描画してしまう（CSSコードがキャンバスに文字として出る）。
 * → `<style>` を除去し、必要ならエディタ外に移す。Widget の見た目は採取CSSが担保するか、
 *   inline style がすでに付いている。
 *
 * 指示88修正: 以前の DOM 直接挿入 + quill.insertText() は、Quill の
 * MutationObserver/reconcile が blot 不在のノードを消してしまうのが根本原因だった。
 * → SbWidgetBlot（BlockEmbed・media-blots.ts）を登録し、quill.insertEmbed() で
 *   正規ブロットとして挿入する。text-change も自動発火し autosave が正常に動く。
 */
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
  // <style> タグを本文から除去し、<head> 側へ退避（同じ style が既にあれば足さない）
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
  // <script> も除去（Quill内で実行されると壊れる）
  for (const script of doc.querySelectorAll('script')) script.remove()

  // ── quill.insertEmbed で SbWidgetBlot（BlockEmbed）として挿入する。
  //    Quill が正規のブロットとして管理するため reconcile で消されず、
  //    text-change イベントも自動発火して autosave が正常に動く。
  const cleaned = doc.body.innerHTML
  const range = quill.getSelection(true)
  const index = range?.index ?? quill.getLength()
  quill.insertEmbed(index, 'sbwidget', cleaned, 'user')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
