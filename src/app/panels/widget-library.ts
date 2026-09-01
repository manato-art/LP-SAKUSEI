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
 * ## 採取できていない部分（正直に扱う）
 * 各カードの中身（Widgetの実HTML）は、実物ではプレビュー iframe に動的描画されるだけで
 * **採取物には残らない**。よって「プレビュー」は実物の描画を出せず、「追加」も実HTMLが無い。
 * クローンでは、追加時に**そのWidget名のプレースホルダ**を本文へ挿入して「入った」ことは示す
 * （実HTMLが採取できたら差し替える）。
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
      toast(`「${title}」のプレビューは未採取です（実Widgetの中身は採取物に残りません）`, 'error')
    })
    add?.addEventListener('click', (event) => {
      event.stopPropagation()
      insertPlaceholder(quill, title)
      toast(`「${title}」を追加しました（クローンは名前のプレースホルダを挿入します）`)
      close()
    })
  }
}

/** 実Widget HTMLが無いので、そのWidget名のプレースホルダ・ブロックを本文へ挿入する。 */
function insertPlaceholder(quill: Quill, title: string): void {
  const range = quill.getSelection(true)
  const index = range?.index ?? quill.getLength()
  const html =
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
