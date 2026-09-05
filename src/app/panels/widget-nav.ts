/**
 * Widget ナビカード（左サイドバー）。
 *
 * キャンバス上に Widget ブロットがあると、バージョンリストとキャンバスの間に
 * 小さなカード（アイコン＋名前＋縮小プレビュー）が出現する。
 * カードをクリックすると Widget 編集オーバーレイが開く。
 *
 * 本番 SquadBeyond 実測:
 *   - サイドバー幅: 240px, position: fixed
 *   - カード: 224×90px, padding: 4px 12px, cursor: pointer
 *   - 名前行: SVG 13×13 + テキスト (10px, #0091ff)
 *   - プレビュー: 200×64px, bg: #fff, border: 1px solid #eaeaea, radius: 4px
 */
import type Quill from 'quill'
import { guessWidgetName, openWidgetEditorForNode } from './widget-editor.ts'

/* ── 定数 ── */

const SIDEBAR_W = 220
const CARD_W = 196
const CARD_PAD_H = 12
const CARD_PAD_V = 4
const PREVIEW_H = 64
const NAME_COLOR = '#0091ff'
const NAME_FONT_SIZE = '10px'
const BORDER_COLOR = '#eaeaea'
const FONT = '"Hiragino Sans","Hiragino Kaku Gothic ProN",sans-serif'

/* ── SVG アイコン ── */

/** パズルピースアイコン（本番の Widget カード先頭アイコン再現） */
function svgPuzzle(): string {
  return `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;vertical-align:middle">
    <path d="M4.5 2C4.5 1.17 5.17.5 6 .5s1.5.67 1.5 1.5h2A1.5 1.5 0 0 1 11 3.5v2c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5v2A1.5 1.5 0 0 1 9.5 12h-2c0 .83-.67 1.5-1.5 1.5S4.5 12.83 4.5 12h-2A1.5 1.5 0 0 1 1 10.5v-2c-.83 0-1.5-.67-1.5-1.5S.17 5.5 1 5.5v-2A1.5 1.5 0 0 1 2.5 2h2z"
      fill="#999" stroke="#999" stroke-width=".3"/>
  </svg>`
}

/* ── 公開 API ── */

/**
 * Widget ナビサイドバーをエディタにマウントする。
 * editor.ts の wireWidgetClick() の後に呼ぶ。
 */
export function mountWidgetNav(root: HTMLElement, quill: Quill): void {
  const editorWrapper = root.querySelector<HTMLElement>('[class*="_editorWrapper_"]')
  const contentWrapper = root.querySelector<HTMLElement>('.quillEditorContentWrapper')
  if (editorWrapper === null || contentWrapper === null) return

  const editor = root.querySelector<HTMLElement>('.ql-editor')
  if (editor === null) return

  // サイドバーコンテナ（バージョンリストとキャンバスの間に挿入）
  const sidebar = document.createElement('div')
  sidebar.dataset['widgetNav'] = 'true'
  sidebar.style.cssText =
    `width:${SIDEBAR_W}px;flex-shrink:0;overflow-y:auto;overflow-x:hidden;` +
    `display:none;flex-direction:column;gap:8px;padding:8px 0;` +
    `border-right:1px solid #eee;background:#fff;box-sizing:border-box;` +
    `height:calc(100vh - 92px);align-self:stretch`

  // editorWrapper の子として、contentWrapper の直前に挿入
  editorWrapper.insertBefore(sidebar, contentWrapper)

  // 初回スキャン＋MutationObserver で Widget の増減を検知
  // デバウンスして過剰な再描画を防止（カードクリック直後の DOM 変化で再構築されるのを回避）
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  const refresh = (): void => refreshCards(sidebar, editor, quill)
  const debouncedRefresh = (): void => {
    if (debounceTimer !== null) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(refresh, 200)
  }
  refresh()
  const observer = new MutationObserver(debouncedRefresh)
  observer.observe(editor, { childList: true, subtree: true })
}

/* ── カード描画 ── */

function refreshCards(sidebar: HTMLElement, editor: HTMLElement, quill: Quill): void {
  const widgets = editor.querySelectorAll<HTMLElement>('section.sb-widget-block')
  if (widgets.length === 0) {
    sidebar.style.display = 'none'
    return
  }

  sidebar.style.display = 'flex'
  // 既存カードを全削除して再構築（Widget の並び順が変わる可能性があるため）
  sidebar.innerHTML = ''

  // ヘッダーラベル
  const header = document.createElement('div')
  header.textContent = '設置済みWidget'
  header.style.cssText =
    `padding:4px ${CARD_PAD_H}px;font:600 10px/1.4 ${FONT};color:#999;letter-spacing:.5px`
  sidebar.append(header)

  for (const widgetNode of widgets) {
    const card = createWidgetCard(widgetNode, quill)
    sidebar.append(card)
  }
}

function createWidgetCard(widgetNode: HTMLElement, quill: Quill): HTMLElement {
  const card = document.createElement('div')
  card.style.cssText =
    `display:flex;flex-direction:column;gap:4px;` +
    `padding:${CARD_PAD_V}px ${CARD_PAD_H}px;cursor:pointer;border-radius:4px;` +
    `transition:background .15s;max-width:100%;box-sizing:border-box`
  card.addEventListener('mouseenter', () => { card.style.background = '#f5f5f5' })
  card.addEventListener('mouseleave', () => { card.style.background = 'transparent' })

  // 名前行（アイコン＋テキスト）
  const nameRow = document.createElement('div')
  nameRow.style.cssText = `display:flex;align-items:center;gap:6px`

  const icon = document.createElement('span')
  icon.innerHTML = svgPuzzle()
  icon.style.cssText = 'display:flex;align-items:center;flex-shrink:0'

  const nameEl = document.createElement('span')
  const widgetName = guessWidgetName(widgetNode.innerHTML)
  nameEl.textContent = widgetName
  nameEl.title = widgetName
  nameEl.style.cssText =
    `color:${NAME_COLOR};font:${NAME_FONT_SIZE}/1.4 ${FONT};` +
    `overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0`

  nameRow.append(icon, nameEl)

  // 縮小プレビュー
  const previewWrap = document.createElement('div')
  previewWrap.style.cssText =
    `width:${CARD_W}px;max-width:100%;height:${PREVIEW_H}px;background:#fff;` +
    `border:1px solid ${BORDER_COLOR};border-radius:4px;overflow:hidden;` +
    `position:relative;box-sizing:border-box`

  const previewContent = document.createElement('div')
  // Widget の中身を縮小表示（transform: scale で縮小）
  const scale = 0.2
  previewContent.style.cssText =
    `transform:scale(${scale});transform-origin:top left;` +
    `width:${100 / scale}%;pointer-events:none;position:absolute;top:0;left:0`

  // style タグも含めてクローン（CSS が効くように）
  previewContent.innerHTML = widgetNode.innerHTML

  previewWrap.append(previewContent)
  card.append(nameRow, previewWrap)

  // クリック → Widget 編集オーバーレイを開く
  card.addEventListener('click', () => {
    openWidgetEditorForNode(quill, widgetNode)
  })

  return card
}
