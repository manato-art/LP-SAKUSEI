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
 *   - 名前行: SVG 13×13 + テキスト (10px, var(--sb-accent, #0091FF))
 *   - プレビュー: 200×64px, bg: #fff, border: 1px solid #eaeaea, radius: 4px
 *
 * 開け閉め（2026-10-18 本人指定「開いたり閉まったりできるようにして」）: 閉じると列ごと細い帯にたたみ、
 * その分キャンバスが広がる。帯を押すと開く。開け閉めはブラウザに覚えておく。
 *
 * 「離脱ポップ▼」も並べる（指示41・2026-10-31 本人「ここに離脱ポップの項目も設けて確認できるようにしたい。Widget▼ 離脱ポップ▼
 * って感じで、それぞれプルダウンみたいな感じで開けるようにしたい」）。列の名前は「設置済み」、中は「Widget▼」「離脱ポップ▼」の
 * 開け閉めできる段（開け閉めはブラウザに覚えておく）。離脱ポップの段は widget-nav-popups.ts。
 */
import type Quill from 'quill'
import { guessWidgetName, openWidgetEditorForNode } from './widget-editor.ts'
import { containWidgetStyles } from './widget-style-scope.ts'
import { duplicatePlacedWidget } from './widget-duplicate.ts'
import { toast } from '../ui.ts'
import { popupApi } from '../api-popups.ts'
import { navPopupsOf, navSection, popupCards, popupEditHash, type NavPopup } from './widget-nav-popups.ts'

/* ── 定数 ── */

const SIDEBAR_W = 220
const COLLAPSED_W = 28
const COLLAPSED_KEY = 'sb-widget-nav-collapsed'
/** 段ごとの開け閉め（Widget・離脱ポップ） */
const SECTION_KEY = 'sb-widget-nav-section-'
const CARD_W = 196
const CARD_PAD_H = 12
const CARD_PAD_V = 4
const PREVIEW_H = 64
const NAME_COLOR = 'var(--sb-accent, #0091FF)'
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

/** 開け閉めの矢印（left＝閉じる・right＝開く） */
function svgChevron(direction: 'left' | 'right'): string {
  const d = direction === 'left' ? 'M10 3.5L5.5 8l4.5 4.5' : 'M6 3.5L10.5 8 6 12.5'
  return `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0">
    <path d="${d}" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`
}

/* ── 開け閉めの状態（ブラウザに覚えておく） ── */

interface NavState {
  readonly collapsed: boolean
  readonly toggle: () => void
  readonly widgetsOpen: boolean
  readonly toggleWidgets: () => void
  readonly popupCount: number
  /** 離脱ポップの段（ページが分からない所では null） */
  readonly popupSection: () => HTMLElement | null
}

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    // 保存先が使えないブラウザ（シークレット等）では、毎回開いた状態から始める
    return false
  }
}

/** 段が開いているか（初めは開いている） */
function loadSectionOpen(name: string): boolean {
  try {
    return localStorage.getItem(`${SECTION_KEY}${name}`) !== '0'
  } catch {
    return true
  }
}

function saveSectionOpen(name: string, open: boolean): void {
  try {
    localStorage.setItem(`${SECTION_KEY}${name}`, open ? '1' : '0')
  } catch {
    // 保存先が使えないブラウザでは、その場の開け閉めだけ効く
  }
}

function saveCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0')
  } catch {
    // 保存先が使えないブラウザでは、その場の開け閉めだけ効く（次に開いたときは開いた状態）
  }
}

/* ── 公開 API ── */

/**
 * Widget ナビサイドバーをエディタにマウントする。
 * editor.ts の wireWidgetClick() の後に呼ぶ。
 *
 * 本番 SquadBeyond と同様に、バージョンパネルとキャンバスの**間**に
 * flex 子要素として挿入する。キャンバス（contentWrapper）は flex:1 で
 * 残りスペースを埋めるため、Widget nav が出現しても自然に幅が縮む。
 */
/** 離脱ポップの段に要るもの（このページ・いま直している Version） */
export interface WidgetNavPopupDeps {
  readonly abTestUid: string
  readonly versionUid: () => string
}

export function mountWidgetNav(root: HTMLElement, quill: Quill, popupDeps?: WidgetNavPopupDeps): void {
  const editorWrapper = root.querySelector<HTMLElement>('[class*="_editorWrapper_"]')
  const contentWrapper = root.querySelector<HTMLElement>('.quillEditorContentWrapper')
  if (editorWrapper === null || contentWrapper === null) return

  const editor = root.querySelector<HTMLElement>('.ql-editor')
  if (editor === null) return

  // contentWrapper を flex:1 に変更して、Widget nav の出入りに応じて
  // キャンバス幅が自動調整されるようにする（採取CSSの width:56% を上書き）
  contentWrapper.style.flex = '1 1 0'
  contentWrapper.style.width = 'auto'
  contentWrapper.style.minWidth = '0'

  const sidebar = document.createElement('div')
  sidebar.dataset['widgetNav'] = 'true'
  sidebar.style.cssText =
    `width:${SIDEBAR_W}px;flex-shrink:0;overflow-y:auto;overflow-x:hidden;` +
    `display:none;flex-direction:column;gap:8px;padding:8px 0;` +
    `border-right:1px solid #eee;background:#fff;box-sizing:border-box;` +
    `height:calc(100vh - 92px)`

  // バージョンパネルの直後、キャンバスの直前に挿入する（flex 子要素として自然に並ぶ）
  editorWrapper.insertBefore(sidebar, contentWrapper)

  // 初回スキャン＋MutationObserver で Widget の増減を検知
  // デバウンスして過剰な再描画を防止（カードクリック直後の DOM 変化で再構築されるのを回避）
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let collapsed = loadCollapsed()
  const toggle = (): void => {
    collapsed = !collapsed
    saveCollapsed(collapsed)
    refresh()
  }
  const open = { widgets: loadSectionOpen('widgets'), popups: loadSectionOpen('popups') }
  const toggleSection = (name: keyof typeof open): void => {
    open[name] = !open[name]
    saveSectionOpen(name, open[name])
    refresh()
  }
  let popups: readonly NavPopup[] = []
  const popupSection = (): HTMLElement | null => {
    if (popupDeps === undefined) return null
    const section = navSection('離脱ポップ', popups.length, open.popups, () => toggleSection('popups'))
    section.body.append(
      popupCards(popups, {
        versionUid: popupDeps.versionUid,
        onCheck: (url) => window.open(url, '_blank', 'noopener'),
        onEdit: (popupUid) => {
          location.hash = popupEditHash(popupDeps.abTestUid, popupUid)
        },
      }),
    )
    return section.el
  }
  const refresh = (): void =>
    refreshCards(sidebar, editor, quill, {
      collapsed,
      toggle,
      widgetsOpen: open.widgets,
      toggleWidgets: () => toggleSection('widgets'),
      popupCount: popups.length,
      popupSection,
    })
  // このページのポップアップを読む（読めなくても Widget の段はいつもどおり）
  if (popupDeps !== undefined) {
    void Promise.all([popupApi.exitPopups(popupDeps.abTestUid), popupApi.followPopups(popupDeps.abTestUid)]).then(
      ([{ exit_popups }, { follow_popups }]) => {
        popups = navPopupsOf(exit_popups, follow_popups)
        refresh()
      },
      () => undefined,
    )
  }
  const debouncedRefresh = (): void => {
    if (debounceTimer !== null) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(refresh, 200)
  }
  refresh()
  const observer = new MutationObserver(debouncedRefresh)
  observer.observe(editor, { childList: true, subtree: true })
}

/* ── カード描画 ── */

function refreshCards(sidebar: HTMLElement, editor: HTMLElement, quill: Quill, nav: NavState): void {
  const widgets = editor.querySelectorAll<HTMLElement>('section.sb-widget-block')
  if (widgets.length === 0 && nav.popupCount === 0) {
    sidebar.style.display = 'none'
    return
  }

  sidebar.style.display = 'flex'
  sidebar.style.width = `${nav.collapsed ? COLLAPSED_W : SIDEBAR_W}px`
  // 既存カードを全削除して再構築（Widget の並び順が変わる可能性があるため）
  sidebar.innerHTML = ''

  if (nav.collapsed) {
    sidebar.append(createCollapsedStrip(nav.toggle))
    return
  }

  sidebar.append(createHeader(nav.toggle))
  const widgetSection = navSection('Widget', widgets.length, nav.widgetsOpen, nav.toggleWidgets)
  if (widgets.length === 0) {
    const empty = document.createElement('p')
    empty.textContent = 'このVersionにWidgetはまだありません'
    empty.style.cssText = `margin:0;padding:0 ${CARD_PAD_H}px;color:#999;font:11px/1.6 ${FONT}`
    widgetSection.body.append(empty)
  }
  for (const widgetNode of widgets) widgetSection.body.append(createWidgetCard(widgetNode, quill))
  sidebar.append(widgetSection.el)
  const popupSection = nav.popupSection()
  if (popupSection !== null) sidebar.append(popupSection)
}

/** 開け閉めのボタンの共通部分（押したら toggle・今の開閉を読み上げに伝える） */
function toggleButton(label: string, expanded: boolean, toggle: () => void): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.dataset['widgetNavToggle'] = 'true'
  button.setAttribute('aria-label', label)
  button.setAttribute('aria-expanded', String(expanded))
  button.title = label
  button.addEventListener('mouseenter', () => { button.style.background = '#f5f5f5' })
  button.addEventListener('mouseleave', () => { button.style.background = 'transparent' })
  button.addEventListener('click', toggle)
  return button
}

/** 開いているときの見出し（「設置済み」＋閉じるボタン） */
function createHeader(toggle: () => void): HTMLElement {
  const header = document.createElement('div')
  header.style.cssText =
    `display:flex;align-items:center;justify-content:space-between;gap:4px;padding:0 4px 0 ${CARD_PAD_H}px`

  const label = document.createElement('span')
  label.textContent = '設置済み'
  label.style.cssText = `font:600 10px/1.4 ${FONT};color:#999;letter-spacing:.5px`

  const close = toggleButton('設置済みを閉じる', true, toggle)
  close.innerHTML = svgChevron('left')
  close.style.cssText =
    'display:flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;' +
    'border:0;border-radius:4px;background:transparent;color:#999;cursor:pointer'

  header.append(label, close)
  return header
}

/** 閉じているときの細い帯（どこを押しても開く） */
function createCollapsedStrip(toggle: () => void): HTMLElement {
  const strip = toggleButton('設置済みを開く', false, toggle)
  strip.style.cssText =
    `display:flex;flex-direction:column;align-items:center;gap:8px;flex:1;width:100%;padding:4px 0;` +
    `border:0;background:transparent;color:#999;cursor:pointer;font:600 10px/1.4 ${FONT};letter-spacing:.5px`

  const label = document.createElement('span')
  label.textContent = '設置済み'
  label.style.cssText = 'writing-mode:vertical-rl'

  strip.innerHTML = svgChevron('right')
  strip.append(label)
  return strip
}

function createWidgetCard(widgetNode: HTMLElement, quill: Quill): HTMLElement {
  const card = document.createElement('div')
  card.dataset['widgetNavCard'] = 'true'
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

  // 複製（そのすぐ下にもう1つ置く・中の名前は付け直す＝片方の色を変えても、もう片方は変わらない。2026-10-24 本人指定）
  const duplicate = document.createElement('button')
  duplicate.type = 'button'
  duplicate.dataset['widgetNavDuplicate'] = 'true'
  duplicate.textContent = '複製'
  duplicate.title = 'このWidgetを、すぐ下にもう1つ置きます'
  duplicate.style.cssText =
    `margin-left:auto;flex-shrink:0;padding:2px 8px;border:1px solid #d5d5d5;border-radius:4px;background:#fff;` +
    `color:#555;font:600 10px/1.4 ${FONT};cursor:pointer`
  duplicate.addEventListener('click', (event) => {
    // カードを押したとき（編集を開く）にしない
    event.stopPropagation()
    if (duplicatePlacedWidget(quill, widgetNode)) toast('すぐ下に複製しました')
    else toast('このWidgetは複製できませんでした。編集画面を開き直してください', 'error')
  })

  nameRow.append(icon, nameEl, duplicate)

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

  // style タグも含めて写す（CSS が効くように）。ただし CSS はこの縮小プレビューの中だけに効かせる。
  // そのまま置くと編集画面全体に効き、キャンバスに PC 用の @media の値が出ていた（2026-09-11 実測）。
  previewContent.innerHTML = widgetNode.innerHTML
  containWidgetStyles(previewContent, 'widget')

  previewWrap.append(previewContent)
  card.append(nameRow, previewWrap)

  // クリック → Widget 編集オーバーレイを開く
  card.addEventListener('click', () => {
    openWidgetEditorForNode(quill, widgetNode)
  })

  return card
}
