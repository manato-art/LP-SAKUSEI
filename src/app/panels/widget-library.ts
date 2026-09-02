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
  card: '.MuiCard-root',
  cardTitle: '.MuiCardHeader-title p',
} as const

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

  wireCategories(portal.root)
  wireSearch(portal.root)
  wireCards(portal.root, quill, portal.close)
}

/** カテゴリー選択の見た目切替（実物は選択中が塗り／他はテキストボタン）。 */
function wireCategories(root: HTMLElement): void {
  const categories = [...root.querySelectorAll<HTMLElement>(HOOK.category)]
  const activate = (target: HTMLElement): void => {
    for (const cat of categories) {
      const on = cat === target
      cat.classList.toggle('MuiButton-contained', on)
      cat.classList.toggle('MuiButton-containedPrimary', on)
      cat.classList.toggle('MuiButton-text', !on)
      cat.classList.toggle('MuiButton-textPrimary', !on)
    }
  }
  for (const cat of categories) {
    cat.addEventListener('click', () => activate(cat))
  }
}

/** Widget検索（カード名での絞り込み・クライアント側）。 */
function wireSearch(root: HTMLElement): void {
  const input = root.querySelector<HTMLInputElement>(HOOK.search)
  if (input === null) return
  const cards = [...root.querySelectorAll<HTMLElement>(HOOK.card)]
  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase()
    for (const card of cards) {
      const title = (card.querySelector(HOOK.cardTitle)?.textContent ?? '').toLowerCase()
      card.style.display = query === '' || title.includes(query) ? '' : 'none'
    }
  })
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
      insertWidget(quill, card, title)
      toast(`「${title}」を追加しました`)
      close()
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

/** 「追加」= そのWidgetの実HTMLを本文へ挿入する（採取物が無ければ名前プレースホルダに退避）。 */
function insertWidget(quill: Quill, card: HTMLElement, title: string): void {
  const range = quill.getSelection(true)
  const index = range?.index ?? quill.getLength()
  const body = widgetBodyHtml(card)
  const html =
    body ??
    `<div style="border:1px dashed #B0B0B0;border-radius:6px;padding:16px;margin:8px 0;` +
      `background:#FAFAFA;color:#555;text-align:center;font-size:14px">【Widget】${escapeHtml(title)}</div>`
  quill.clipboard.dangerouslyPasteHTML(index, html, 'user')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
