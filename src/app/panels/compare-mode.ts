/**
 * 比較モードパネル（フローティング・ドラッグ移動可能）
 *
 * エディタの上にフローティングパネルとして表示。
 * 「…」ボタンでドラッグ移動できる。
 * 実物 SquadBeyond の比較モード UI を再現。
 */
import { toast } from '../ui.ts'

/* ──────────────────── SVG アイコン ──────────────────── */

const ICON_CLOSE = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M11.54 4.46a.56.56 0 010 .79L8.79 8l2.75 2.75a.56.56 0 01-.79.79L8 8.79l-2.75 2.75a.56.56 0 01-.79-.79L7.21 8 4.46 5.25a.56.56 0 01.79-.79L8 7.21l2.75-2.75a.56.56 0 01.79 0z"/></svg>`

const ICON_DOTS = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="4" cy="6.5" r="1.1"/><circle cx="4" cy="9.5" r="1.1"/><circle cx="8" cy="6.5" r="1.1"/><circle cx="8" cy="9.5" r="1.1"/><circle cx="12" cy="6.5" r="1.1"/><circle cx="12" cy="9.5" r="1.1"/></svg>`

const ICON_EYE = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M8 4.2c-2.6 0-4.81 1.36-5.59 3.24a.14.14 0 000 .08C3.19 9.4 5.4 10.75 8 10.75s4.81-1.35 5.59-3.24a.14.14 0 000-.07C12.81 5.56 10.6 4.2 8 4.2zm0-.73c-3 0-5.55 1.56-6.45 3.73a.87.87 0 000 .54c.9 2.17 3.44 3.73 6.45 3.73s5.55-1.56 6.45-3.73a.87.87 0 000-.54C13.55 5.03 11 3.47 8 3.47zM10.5 7.47a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zm-1.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"/></svg>`

const ICON_HEATMAP = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M10.83 2.5a1 1 0 011-1H13.5a1 1 0 011 1v11a1 1 0 01-1 1h-1.67a1 1 0 01-1-1V2.5zm2.67 0h-1.67v11H13.5V2.5zM6.17 5.83a1 1 0 011-1h1.66a1 1 0 011 1V13.5a1 1 0 01-1 1H7.17a1 1 0 01-1-1V5.83zm2.66 0H7.17V13.5h1.66V5.83zM1.5 8.5a1 1 0 011-1h1.67a1 1 0 011 1v5a1 1 0 01-1 1H2.5a1 1 0 01-1-1v-5zm2.67 0H2.5v5h1.67v-5z"/></svg>`

const ICON_VERSION = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M6.1 2.5c-.07 0-.1.05-.1.08v.93A5.12 5.12 0 0111 8.62v2.88H12.9c.07 0 .1-.05.1-.08V6.81A1.3 1.3 0 0011.7 5.58h-.8a1 1 0 01-1.1-1.08V3.73A1.3 1.3 0 008.5 2.5H6.1zm4.9.45a3.3 3.3 0 011.86 1.77A3.22 3.22 0 0011.7 4.58h-.8a.2.2 0 01-.1.02V3.73c0-.27-.05-.55-.14-.78zM3 4.58c0-.02.03-.08.1-.08H5.5c.74 0 1.3.57 1.3 1.23V6.5A1 1 0 007.9 7.58h.8c.74 0 1.3.57 1.3 1.23v5.62c0 .02-.03.08-.1.08H3.1c-.07 0-.1-.06-.1-.08V4.58zm4.66.37a3.3 3.3 0 011.86 1.77c-.26-.1-.53-.15-.82-.15H7.9a.2.2 0 01-.1-.02V5.73c0-.28-.05-.55-.14-.78zM6.1 1.5A1.1 1.1 0 005 2.58V3.5h-.5A1.1 1.1 0 002 4.58v8.85A1.1 1.1 0 003.1 14.5h6.8A1.1 1.1 0 0011 13.42V12.5h1.9A1.1 1.1 0 0014 11.42V6.81 6.62A5.3 5.3 0 008.7 1.5H6.1z"/></svg>`

const ICON_HISTORY = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M7.68 1.46a6.5 6.5 0 11-4.18 10.6.5.5 0 01.68-.68l.15.17.16.19A5.5 5.5 0 107.61 2.46a5.48 5.48 0 00-3.17 1.91L3.73 5.26 5.26 3.73h0l.93.76C3.27 6.36 3.18 7.36 3.17 7.52l.77-.76a.4.4 0 01.57 0 .4.4 0 010 .57l-1.61 1.6a.4.4 0 01-.57 0L.72 7.33a.4.4 0 010-.57.4.4 0 01.57 0l.86.86A6.5 6.5 0 017.68 1.46z"/><path d="M8.5 4a.5.5 0 00-1 0v4a.5.5 0 00.5.5h3a.5.5 0 000-1H8.5V4z"/></svg>`

const ICON_BENCHMARK = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M9.79 3.39a2 2 0 012.83 2.83l-.98.98a.6.6 0 10.85.85l.98-.98a3.2 3.2 0 00-4.53-4.53l-2.4 2.4a3.2 3.2 0 004.53 4.53.5.5 0 10-.72-.68l-.03-.04a2 2 0 01-2.83-2.83l2.3-2.53z"/><path d="M9.28 6.37a.5.5 0 10-.72.68.03.03 0 01.03.04 2 2 0 01-2.83 2.83l-2.4 2.4a2 2 0 112.83-2.83l.98-.98a.6.6 0 10-.85-.85l-.98.98a3.2 3.2 0 104.53 4.53l2.4-2.4a3.2 3.2 0 00-4.53-4.53l.18.17z"/></svg>`

const ICON_COPY = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M14 4a2 2 0 00-2-2H6.5a2 2 0 00-2 2v1H4a2 2 0 00-2 2v5a2 2 0 002 2h5a2 2 0 002-2v-.5h1a2 2 0 002-2V4zm-3 6.5V7a2 2 0 00-2-2H5.5V4a1 1 0 011-1H12a1 1 0 011 1v5.5a1 1 0 01-1 1h-1zM9 6a1 1 0 011 1v5a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1h5z"/></svg>`

const ICON_QR = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><g stroke="currentColor" stroke-width="1.33" stroke-linecap="round" stroke-linejoin="round"><rect width="3.33" height="3.33" x="2" y="2" rx=".67"/><rect width="3.33" height="3.33" x="10.67" y="2" rx=".67"/><rect width="3.33" height="3.33" x="2" y="10.67" rx=".67"/><path d="M14 10.67h-2a1.33 1.33 0 00-1.33 1.33v2"/><path d="M14 14v.01"/><path d="M8 4.67v2A1.33 1.33 0 016.67 8H4.67"/><path d="M2 8h.01"/><path d="M8 2h.01"/><path d="M8 10.67v.01"/><path d="M10.67 8h.66"/><path d="M14 8v.01"/><path d="M8 14v-.67"/></g></svg>`

const ICON_EXTERNAL = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M14.5 2a.48.48 0 00-.48-.48l-3.39-.01a.48.48 0 000 .97h2.22L6.9 8.44a.48.48 0 00.68.68l5.95-5.95v2.22a.49.49 0 00.97 0V2zM3 3.5A1.5 1.5 0 001.5 5v8A1.5 1.5 0 003 14.5h8a1.5 1.5 0 001.5-1.5V8a.5.5 0 00-1 0v5a.5.5 0 01-.5.5H3a.5.5 0 01-.5-.5V5a.5.5 0 01.5-.5h5a.5.5 0 000-1H3z"/></svg>`

/* ──────────────────── タブ定義 ──────────────────── */

interface TabDef {
  readonly label: string
  readonly icon: string
}

const TABS: readonly TabDef[] = [
  { label: 'プレビュー', icon: ICON_EYE },
  { label: 'ヒートマップ', icon: ICON_HEATMAP },
  { label: '他のVersion', icon: ICON_VERSION },
  { label: '更新履歴・\n復元', icon: ICON_HISTORY },
  { label: 'ベンチマーク', icon: ICON_BENCHMARK },
]

/* ──────────────────── デバイス定義 ──────────────────── */

interface DeviceDef {
  readonly label: string
  readonly width: number
  readonly height: number
}

const DEVICES: readonly DeviceDef[] = [
  { label: 'iPhone SE (第1世代) (320×568)', width: 320, height: 568 },
  { label: 'Galaxy S22 / S23 / S24 (360×780)', width: 360, height: 780 },
  { label: 'iPhone SE (第2/3世代) (375×667)', width: 375, height: 667 },
  { label: 'iPhone 12 / 13 / 14 (390×844)', width: 390, height: 844 },
  { label: 'iPhone 15 / 15 Pro / 16 (393×852)', width: 393, height: 852 },
  { label: 'iPhone 16 Pro / 17 (402×874)', width: 402, height: 874 },
  { label: 'Pixel 7 / 8 (412×915)', width: 412, height: 915 },
  { label: 'iPhone 15 Plus / 15 Pro Max / 16 Plus (430×932)', width: 430, height: 932 },
  { label: 'iPhone 16 Pro Max / 17 Pro Max (440×956)', width: 440, height: 956 },
  { label: '小型ノートPC (1024×768)', width: 1024, height: 768 },
  { label: 'ノートPC (1280×800)', width: 1280, height: 800 },
  { label: 'デスクトップ (1440×900)', width: 1440, height: 900 },
  { label: 'デスクトップ (フルHD) (1920×1080)', width: 1920, height: 1080 },
]

/** デフォルト選択デバイスのインデックス（iPhone 16 Pro / 17） */
const DEFAULT_DEVICE_INDEX = 5
/** パネル初期幅（px） */
const PANEL_W = 420
/** パネル最小サイズ */
const MIN_W = 320
const MIN_H = 400

/* ──────────────────── CSS 注入 ──────────────────── */

function injectStyles(): void {
  if (document.getElementById('sb-cmp-panel-css') !== null) return
  const style = document.createElement('style')
  style.id = 'sb-cmp-panel-css'
  style.textContent = `
/* ── フローティングパネル ── */
.sb-cmp-panel {
  position: fixed;
  z-index: 9000;
  width: ${PANEL_W}px;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 40px rgba(0,0,0,.18), 0 0 0 1px rgba(0,0,0,.06);
  overflow: hidden;
  animation: sb-cmp-fadein .15s ease;
  user-select: none;
}
@keyframes sb-cmp-fadein { from { opacity: 0; transform: scale(.97); } to { opacity: 1; transform: scale(1); } }

/* ── ヘッダ ── */
.sb-cmp-header {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  gap: 8px;
  border-bottom: 1px solid #e5e5ea;
  flex-shrink: 0;
}
.sb-cmp-title {
  font-size: 14px;
  font-weight: 700;
  color: #1a1a1a;
  margin-right: auto;
}
.sb-cmp-hdr-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: #666;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-family: inherit;
  transition: background .12s;
}
.sb-cmp-hdr-btn:hover { background: #f0f0f0; }
.sb-cmp-drag-handle { cursor: grab; }
.sb-cmp-drag-handle:active { cursor: grabbing; }

/* ── タブバー ── */
.sb-cmp-tabs {
  display: flex;
  gap: 2px;
  padding: 6px 10px;
  border-bottom: 1px solid #e5e5ea;
  flex-shrink: 0;
  overflow-x: auto;
}
.sb-cmp-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 6px 8px;
  border: none;
  background: none;
  border-radius: 8px;
  cursor: pointer;
  color: #888;
  font-size: 10px;
  font-family: inherit;
  white-space: pre-line;
  text-align: center;
  line-height: 1.3;
  transition: background .12s, color .12s;
  min-width: 0;
  flex-shrink: 0;
}
.sb-cmp-tab:hover { background: #f5f5f5; color: #555; }
.sb-cmp-tab.active {
  background: #f0f0f5;
  color: #1a1a1a;
  font-weight: 600;
}
.sb-cmp-tab-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
}

/* ── コンテンツ ── */
.sb-cmp-content {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* ── URL バー ── */
.sb-cmp-url-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid #e5e5ea;
  flex-shrink: 0;
}
.sb-cmp-url-label {
  font-size: 13px;
  font-weight: 600;
  color: #1a1a1a;
  flex-shrink: 0;
}
.sb-cmp-url-text {
  font-size: 11px;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1 1 0;
  min-width: 0;
}
.sb-cmp-url-btn {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  padding: 3px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: color .12s, background .12s;
}
.sb-cmp-url-btn:hover { color: #333; background: #f0f0f0; }

/* ── デバイスセレクタ ── */
.sb-cmp-device {
  display: flex;
  align-items: center;
  padding: 6px 12px 8px;
  border-bottom: 1px solid #e5e5ea;
  flex-shrink: 0;
}
.sb-cmp-device-select {
  width: 100%;
  appearance: none;
  -webkit-appearance: none;
  background: #f5f5f7;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 7px 32px 7px 12px;
  font-size: 13px;
  color: #1a1a1a;
  font-family: inherit;
  cursor: pointer;
  outline: none;
  background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='%23888' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
}
.sb-cmp-device-select:focus {
  border-color: #4A8DF8;
  box-shadow: 0 0 0 2px rgba(74,141,248,.15);
}

/* ── フォンフレーム ── */
.sb-cmp-phone-area {
  flex: 1 1 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 14px 10px 20px;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}
.sb-cmp-phone {
  background: #1a1a1a;
  border-radius: 40px;
  padding: 12px 8px;
  box-shadow: 0 4px 24px rgba(0,0,0,.12), inset 0 0 0 1px rgba(255,255,255,.06);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}
.sb-cmp-phone-notch {
  width: 90px;
  height: 22px;
  background: #1a1a1a;
  border-radius: 0 0 16px 16px;
  margin: -2px auto 0;
  position: relative;
  z-index: 2;
}
.sb-cmp-phone-screen {
  background: #fff;
  border-radius: 30px;
  overflow: hidden;
  position: relative;
}
.sb-cmp-phone-screen iframe {
  border: none;
  display: block;
}

/* ── 準備中プレースホルダ ── */
.sb-cmp-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #aaa;
  font-size: 14px;
  padding: 40px 16px;
}
.sb-cmp-placeholder svg { opacity: .4; }

/* ── リサイズハンドル（四隅） ── */
.sb-cmp-resize {
  position: absolute;
  width: 14px;
  height: 14px;
  z-index: 2;
}
.sb-cmp-resize-tl { top: -2px; left: -2px; cursor: nwse-resize; }
.sb-cmp-resize-tr { top: -2px; right: -2px; cursor: nesw-resize; }
.sb-cmp-resize-bl { bottom: -2px; left: -2px; cursor: nesw-resize; }
.sb-cmp-resize-br { bottom: -2px; right: -2px; cursor: nwse-resize; }
  `
  document.head.append(style)
}

/* ──────────────────── 状態 ──────────────────── */

export interface ComparePanelDeps {
  /** 現在 Version の HTML 本文を返す */
  getCurrentHtml: () => string
  /** 現在 Version の UID */
  getVersionUid: () => string
}

let panelEl: HTMLElement | null = null
/** 閉じたときの位置・サイズを記憶し、再度開いたときに復元する */
let savedPanelRect: { top: number; right: number; width: number; height: number } | null = null

/* ──────────────────── 公開 API ──────────────────── */

export function isComparePanelOpen(): boolean {
  return panelEl !== null
}

export function toggleComparePanel(root: HTMLElement, deps: ComparePanelDeps): void {
  if (panelEl !== null) {
    closeComparePanel()
  } else {
    openComparePanel(root, deps)
  }
}

export function closeComparePanel(): void {
  if (cleanupPhoneResize !== null) {
    cleanupPhoneResize()
    cleanupPhoneResize = null
  }
  if (panelEl !== null) {
    // 閉じる前に位置・サイズを記憶
    const rect = panelEl.getBoundingClientRect()
    savedPanelRect = {
      top: rect.top,
      right: window.innerWidth - rect.right,
      width: rect.width,
      height: rect.height,
    }
    panelEl.remove()
    panelEl = null
  }
}

/** Version 切り替え時にプレビューを更新する */
export function refreshComparePreview(html: string): void {
  if (panelEl === null) return
  const iframe = panelEl.querySelector<HTMLIFrameElement>('[data-cmp-iframe]')
  if (iframe !== null) {
    iframe.srcdoc = wrapHtmlForPreview(html)
  }
}

/* ──────────────────── 内部 ──────────────────── */

function openComparePanel(root: HTMLElement, deps: ComparePanelDeps): void {
  injectStyles()

  panelEl = buildPanel(deps)

  if (savedPanelRect !== null) {
    // 前回閉じた位置・サイズを復元
    panelEl.style.top = `${savedPanelRect.top}px`
    panelEl.style.right = `${savedPanelRect.right}px`
    panelEl.style.width = `${savedPanelRect.width}px`
    panelEl.style.height = `${savedPanelRect.height}px`
  } else {
    // 初回: 右レールの左端を基準に初期位置を決める
    const sideToolbar = root.querySelector<HTMLElement>('[class*="_sideToolbarWrapper_"]')
    const toolbarRect = sideToolbar?.getBoundingClientRect()
    const initRight = toolbarRect !== undefined ? window.innerWidth - toolbarRect.left + 4 : 80
    const initTop = toolbarRect?.top ?? 60
    panelEl.style.top = `${initTop}px`
    panelEl.style.right = `${initRight}px`
    // パネル高さ: ビューポートいっぱい（上下8pxだけ余白）
    panelEl.style.height = `${window.innerHeight - initTop - 8}px`
  }

  document.body.append(panelEl)
}

function buildPanel(deps: ComparePanelDeps): HTMLElement {
  const panel = document.createElement('div')
  panel.className = 'sb-cmp-panel'
  panel.setAttribute('data-compare-panel', '')

  // ── ヘッダ ──
  const header = document.createElement('div')
  header.className = 'sb-cmp-header'

  const title = document.createElement('span')
  title.className = 'sb-cmp-title'
  title.textContent = '比較モード'

  const dotsBtn = document.createElement('button')
  dotsBtn.className = 'sb-cmp-hdr-btn sb-cmp-drag-handle'
  dotsBtn.innerHTML = ICON_DOTS
  dotsBtn.title = 'ドラッグで移動'
  wireDrag(dotsBtn, panel)

  const closeBtn = document.createElement('button')
  closeBtn.className = 'sb-cmp-hdr-btn'
  closeBtn.innerHTML = `${ICON_CLOSE}<span>閉じる</span>`
  closeBtn.addEventListener('click', closeComparePanel)

  header.append(title, dotsBtn, closeBtn)
  panel.append(header)

  // ── タブ ──
  const tabBar = document.createElement('div')
  tabBar.className = 'sb-cmp-tabs'

  const contentArea = document.createElement('div')
  contentArea.className = 'sb-cmp-content'

  let activeTabIndex = 0

  for (let i = 0; i < TABS.length; i += 1) {
    const tab = TABS[i]
    if (tab === undefined) continue
    const btn = document.createElement('button')
    btn.className = `sb-cmp-tab${i === 0 ? ' active' : ''}`

    const iconSpan = document.createElement('span')
    iconSpan.className = 'sb-cmp-tab-icon'
    iconSpan.innerHTML = tab.icon

    const labelSpan = document.createElement('span')
    labelSpan.textContent = tab.label

    btn.append(iconSpan, labelSpan)
    tabBar.append(btn)

    btn.addEventListener('click', () => {
      if (i === activeTabIndex) return
      activeTabIndex = i
      for (const t of tabBar.querySelectorAll('.sb-cmp-tab')) {
        t.classList.remove('active')
      }
      btn.classList.add('active')
      renderTabContent(contentArea, i, deps)
    })
  }

  panel.append(tabBar)

  // ── コンテンツエリア ──
  renderTabContent(contentArea, 0, deps)
  panel.append(contentArea)

  // ── 四隅リサイズハンドル ──
  for (const corner of ['tl', 'tr', 'bl', 'br'] as const) {
    const handle = document.createElement('div')
    handle.className = `sb-cmp-resize sb-cmp-resize-${corner}`
    wireResize(handle, panel, corner)
    panel.append(handle)
  }

  return panel
}

/* ──────────────────── ドラッグ移動 ──────────────────── */

function wireDrag(handle: HTMLElement, panel: HTMLElement): void {
  let startX = 0
  let startY = 0
  let startLeft = 0
  let startTop = 0

  function onMouseMove(e: MouseEvent): void {
    e.preventDefault()
    const dx = e.clientX - startX
    const dy = e.clientY - startY
    panel.style.left = `${startLeft + dx}px`
    panel.style.top = `${startTop + dy}px`
    // right を解除して left 基準に切り替える
    panel.style.right = 'auto'
  }

  function onMouseUp(): void {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    handle.style.cursor = 'grab'
  }

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault()
    const rect = panel.getBoundingClientRect()
    startX = e.clientX
    startY = e.clientY
    startLeft = rect.left
    startTop = rect.top
    // right → left に切り替え（ドラッグ中は left 基準のほうが直感的）
    panel.style.left = `${rect.left}px`
    panel.style.right = 'auto'
    handle.style.cursor = 'grabbing'
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  })
}

/* ──────────────────── リサイズ（四隅ドラッグ） ──────────────────── */

type Corner = 'tl' | 'tr' | 'bl' | 'br'

function wireResize(handle: HTMLElement, panel: HTMLElement, corner: Corner): void {
  let startX = 0
  let startY = 0
  let startRect = { left: 0, top: 0, width: 0, height: 0 }

  function onMouseMove(e: MouseEvent): void {
    e.preventDefault()
    const dx = e.clientX - startX
    const dy = e.clientY - startY

    let newLeft = startRect.left
    let newTop = startRect.top
    let newW = startRect.width
    let newH = startRect.height

    if (corner === 'tl') {
      newW = startRect.width - dx
      newH = startRect.height - dy
      newLeft = startRect.left + dx
      newTop = startRect.top + dy
    } else if (corner === 'tr') {
      newW = startRect.width + dx
      newH = startRect.height - dy
      newTop = startRect.top + dy
    } else if (corner === 'bl') {
      newW = startRect.width - dx
      newH = startRect.height + dy
      newLeft = startRect.left + dx
    } else {
      // br
      newW = startRect.width + dx
      newH = startRect.height + dy
    }

    // 最小サイズ制約
    if (newW < MIN_W) {
      if (corner === 'tl' || corner === 'bl') newLeft = startRect.left + startRect.width - MIN_W
      newW = MIN_W
    }
    if (newH < MIN_H) {
      if (corner === 'tl' || corner === 'tr') newTop = startRect.top + startRect.height - MIN_H
      newH = MIN_H
    }

    panel.style.left = `${newLeft}px`
    panel.style.top = `${newTop}px`
    panel.style.right = 'auto'
    panel.style.width = `${newW}px`
    panel.style.height = `${newH}px`
  }

  function onMouseUp(): void {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    const rect = panel.getBoundingClientRect()
    startX = e.clientX
    startY = e.clientY
    startRect = { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
    // left 基準に統一
    panel.style.left = `${rect.left}px`
    panel.style.right = 'auto'
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  })
}

/* ──────────────────── タブコンテンツ ──────────────────── */

function renderTabContent(
  container: HTMLElement,
  tabIndex: number,
  deps: ComparePanelDeps,
): void {
  container.innerHTML = ''

  if (tabIndex !== 0) {
    const tabDef = TABS[tabIndex]
    const placeholder = document.createElement('div')
    placeholder.className = 'sb-cmp-placeholder'
    placeholder.innerHTML = `
      ${tabDef?.icon ?? ''}
      <div>${tabDef?.label.replace('\n', '') ?? ''} は準備中です</div>
    `
    container.append(placeholder)
    return
  }

  // ── プレビュータブ ──
  const versionUid = deps.getVersionUid()

  // URL バー
  const urlBar = document.createElement('div')
  urlBar.className = 'sb-cmp-url-bar'

  const urlLabel = document.createElement('span')
  urlLabel.className = 'sb-cmp-url-label'
  urlLabel.textContent = '確認'

  const previewUrl = `https://sb-draft-preview.squadbeyond.com/articles/${versionUid}/draft`
  const urlText = document.createElement('span')
  urlText.className = 'sb-cmp-url-text'
  urlText.textContent = previewUrl
  urlText.title = previewUrl

  const copyBtn = document.createElement('button')
  copyBtn.className = 'sb-cmp-url-btn'
  copyBtn.innerHTML = ICON_COPY
  copyBtn.title = 'URLをコピー'
  copyBtn.addEventListener('click', () => {
    void navigator.clipboard.writeText(previewUrl).then(() => toast('コピーしました'))
  })

  const qrBtn = document.createElement('button')
  qrBtn.className = 'sb-cmp-url-btn'
  qrBtn.innerHTML = ICON_QR
  qrBtn.title = 'QRコード'
  qrBtn.addEventListener('click', () => toast('QRコードは準備中です', 'error'))

  const extBtn = document.createElement('button')
  extBtn.className = 'sb-cmp-url-btn'
  extBtn.innerHTML = ICON_EXTERNAL
  extBtn.title = '別タブで開く'
  extBtn.addEventListener('click', () => {
    const url =
      `${location.origin}${location.pathname}` +
      `#/ab_tests/${versionUid}/articles/${versionUid}/previews`
    window.open(url, '_blank', 'noopener')
  })

  urlBar.append(urlLabel, urlText, copyBtn, qrBtn, extBtn)
  container.append(urlBar)

  // デバイスセレクタ
  const deviceRow = document.createElement('div')
  deviceRow.className = 'sb-cmp-device'

  const deviceSelect = document.createElement('select')
  deviceSelect.className = 'sb-cmp-device-select'
  for (let di = 0; di < DEVICES.length; di += 1) {
    const d = DEVICES[di]
    if (d === undefined) continue
    const opt = document.createElement('option')
    opt.value = `${d.width}x${d.height}`
    opt.textContent = d.label
    if (di === DEFAULT_DEVICE_INDEX) opt.selected = true
    deviceSelect.append(opt)
  }

  deviceRow.append(deviceSelect)
  container.append(deviceRow)

  // フォンフレーム
  const phoneArea = document.createElement('div')
  phoneArea.className = 'sb-cmp-phone-area'

  const currentDevice = DEVICES[DEFAULT_DEVICE_INDEX] ?? DEVICES[0]
  if (currentDevice === undefined) return
  phoneArea.append(buildPhoneMockup(deps.getCurrentHtml(), currentDevice, phoneArea))
  container.append(phoneArea)

  // デバイス変更
  deviceSelect.addEventListener('change', () => {
    const [w, h] = deviceSelect.value.split('x').map(Number)
    const dev = DEVICES.find((d) => d.width === w && d.height === h) ?? DEVICES[0]
    if (dev === undefined) return
    phoneArea.innerHTML = ''
    phoneArea.append(buildPhoneMockup(deps.getCurrentHtml(), dev, phoneArea))
  })
}

/* ──────── ResizeObserver クリーンアップ ──────── */
let cleanupPhoneResize: (() => void) | null = null

/**
 * スマホモック構築。
 * 1:1 で組み立て → CSS transform で全体を縮小 → ResizeObserver でパネルリサイズに追従。
 * 常にスマホ全体が見える（見切れない）。
 */
function buildPhoneMockup(html: string, device: DeviceDef, phoneArea: HTMLElement): HTMLElement {
  // 前の Observer を切断
  if (cleanupPhoneResize !== null) {
    cleanupPhoneResize()
    cleanupPhoneResize = null
  }

  const isPhone = device.width < 768
  const bezelPadX = isPhone ? 8 : 4
  const bezelPadY = isPhone ? 12 : 4
  const notchH = isPhone ? 22 : 0

  // ── 1:1 でフォン構造を構築 ──
  const phone = document.createElement('div')
  phone.className = 'sb-cmp-phone'
  phone.style.width = `${device.width + bezelPadX * 2}px`
  if (!isPhone) {
    phone.style.borderRadius = '12px'
    phone.style.padding = '4px'
  }

  if (isPhone) {
    const notch = document.createElement('div')
    notch.className = 'sb-cmp-phone-notch'
    phone.append(notch)
  }

  const screen = document.createElement('div')
  screen.className = 'sb-cmp-phone-screen'
  screen.style.width = `${device.width}px`
  screen.style.height = `${device.height}px`
  if (!isPhone) screen.style.borderRadius = '8px'

  const iframe = document.createElement('iframe')
  iframe.setAttribute('data-cmp-iframe', '')
  iframe.title = 'LPプレビュー'
  iframe.srcdoc = wrapHtmlForPreview(html)
  iframe.style.width = `${device.width}px`
  iframe.style.height = `${device.height}px`
  // iframe は 1:1（phone 全体を transform するので個別スケール不要）

  screen.append(iframe)
  phone.append(screen)

  // ── ラッパー（phone の視覚サイズを layout に反映する） ──
  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'display:inline-block;flex-shrink:0'
  wrapper.append(phone)

  // phone の自然サイズ（1:1）
  const phoneNatW = device.width + bezelPadX * 2
  const phoneNatH = device.height + bezelPadY * 2 + notchH

  // ── パネルサイズに合わせてスマホ全体を縮小 ──
  function fitToArea(): void {
    const areaW = phoneArea.clientWidth - 20
    const areaH = phoneArea.clientHeight - 40
    if (areaW <= 0 || areaH <= 0) return

    const scale = Math.min(1, areaW / phoneNatW, areaH / phoneNatH)
    phone.style.transform = `scale(${scale})`
    phone.style.transformOrigin = 'top left'
    // ラッパーに縮小後の寸法を設定（layout 上のサイズ）
    wrapper.style.width = `${phoneNatW * scale}px`
    wrapper.style.height = `${phoneNatH * scale}px`
  }

  const ro = new ResizeObserver(fitToArea)
  ro.observe(phoneArea)
  cleanupPhoneResize = () => ro.disconnect()
  // 初回サイズ計算（レイアウト確定後に実行）
  requestAnimationFrame(fitToArea)

  return wrapper
}

/** Quill の HTML 本文をプレビュー用の完全なページに包む */
function wrapHtmlForPreview(bodyHtml: string): string {
  return `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif;
  font-size:14px;line-height:1.6;color:#333;background:#fff}
img,video{max-width:100%;height:auto;display:block}
a{color:#1a73e8}
</style>
</head><body>
<div class="article-body">${bodyHtml}</div>
</body></html>`
}
