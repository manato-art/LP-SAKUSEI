/**
 * Widget編集オーバーレイ（本番 SquadBeyond の Widget 編集 UI の再現）。
 *
 * エディタ上の Widget（SbWidgetBlot）をクリックすると開くフルスクリーンパネル。
 * 本番の実測色:
 *   - 全体コンテナ背景: #2B2B2B (rgb(43,43,43))
 *   - コードパネル背景: #151515 (rgb(21,21,21))
 *   - ラベル文字色: #fff
 *   - 構文ハイライト: Material Theme 系
 */
import type Quill from 'quill'
import { toast } from '../ui.ts'
import { highlightHtml, highlightCss } from './syntax-highlight.ts'

/* ================================================================
 *  定数
 * ================================================================ */

/** 本番実測のダークUI色 */
const COLOR = {
  container: '#2B2B2B',
  codePanel: '#151515',
  codeBorder: '#333',
  codeText: '#eeffff',
  labelText: '#fff',
  lineNumberText: '#555',
  divider: '#444',
  toggleBg: '#3a3a3a',
  toggleBgOn: '#1976d2',
  // Widget 選択UI
  selectBorder: '#1976d2',
  selectLabel: '#333',
  selectLabelBg: 'rgba(25,118,210,.9)',
} as const

const FONT = '"Hiragino Sans","Hiragino Kaku Gothic ProN",sans-serif'
const MONO = '"SF Mono",Menlo,"Fira Code",monospace'

/* ================================================================
 *  Widget 選択 CSS（一度だけ注入）
 * ================================================================ */

let selectionCssInjected = false

function injectSelectionCss(): void {
  if (selectionCssInjected) return
  selectionCssInjected = true
  const style = document.createElement('style')
  style.setAttribute('data-widget-selection', 'true')
  style.textContent = `
    section.sb-widget-block { cursor:pointer; transition:outline .15s, box-shadow .15s; position:relative; }
    section.sb-widget-block:hover { outline:2px solid ${COLOR.selectBorder}; outline-offset:-2px; }
    section.sb-widget-block:hover::after {
      content:attr(data-widget-name);
      position:absolute; bottom:8px; left:50%; transform:translateX(-50%);
      background:${COLOR.selectLabelBg}; color:#fff; font:600 12px/1.4 ${FONT};
      padding:4px 12px; border-radius:4px; white-space:nowrap; pointer-events:none;
      z-index:5; box-shadow:0 2px 8px rgba(0,0,0,.3);
    }
    section.sb-widget-block[data-widget-selected="true"] {
      outline:2px solid ${COLOR.selectBorder}; outline-offset:-2px;
    }
  `
  document.head.append(style)
}

/* ================================================================
 *  公開 API
 * ================================================================ */

export interface WidgetEditTarget {
  readonly node: HTMLElement
  readonly html: string
  readonly css: string
  readonly index: number
  readonly length: number
}

/**
 * Quill エディタ上の Widget ブロットにクリックハンドラを配線する。
 * editor.ts の初期化後に呼ぶ。
 */
export function wireWidgetClick(root: HTMLElement, quill: Quill): void {
  const editor = root.querySelector<HTMLElement>('.ql-editor')
  if (editor === null) return

  injectSelectionCss()

  // 既存の Widget ブロックに名前ラベルを付与
  labelAllWidgets(editor)

  // MutationObserver で後から追加される Widget にもラベルを付与
  const observer = new MutationObserver(() => labelAllWidgets(editor))
  observer.observe(editor, { childList: true, subtree: true })

  editor.addEventListener('click', (event) => {
    const target = event.target as HTMLElement
    const widgetBlock = target.closest<HTMLElement>('section.sb-widget-block')
    if (widgetBlock === null) return

    event.preventDefault()
    event.stopPropagation()

    const blotIndex = getBlotIndex(quill, widgetBlock)
    if (blotIndex === null) return

    openWidgetEditor(quill, {
      node: widgetBlock,
      html: extractHtml(widgetBlock),
      css: extractCss(widgetBlock),
      index: blotIndex.index,
      length: blotIndex.length,
    })
  })
}

/** 全 Widget ブロックに data-widget-name 属性を付与（ホバー時のラベル表示用）。 */
function labelAllWidgets(editor: HTMLElement): void {
  for (const block of editor.querySelectorAll<HTMLElement>('section.sb-widget-block')) {
    if (block.dataset['widgetName'] !== undefined) continue
    block.dataset['widgetName'] = guessWidgetName(block.innerHTML)
  }
}

/* ================================================================
 *  Widget 編集オーバーレイ本体
 * ================================================================ */

function openWidgetEditor(quill: Quill, target: WidgetEditTarget): void {
  const overlay = document.createElement('div')
  overlay.dataset['widgetEditor'] = 'true'
  overlay.style.cssText =
    `position:fixed;inset:0;z-index:9000;background:#fff;display:flex;flex-direction:column;` +
    `font-family:${FONT}`

  /* ── ヘッダー ── */
  const header = buildHeader(overlay, quill, target)

  /* ── タイトル行 ── */
  const titleBar = buildTitleBar(target)

  /* ── ダークコンテナ（2ペイン） ── */
  const darkContainer = document.createElement('div')
  darkContainer.style.cssText =
    `flex:1;display:flex;background:${COLOR.container};overflow:hidden;min-height:0`

  // 左: ビジュアルエディタ
  const leftPane = buildVisualEditor(target)

  // 仕切り
  const divider = document.createElement('div')
  divider.style.cssText =
    `width:10px;background:${COLOR.container};cursor:col-resize;flex-shrink:0;` +
    `display:flex;align-items:center;justify-content:center`
  const dividerDot = document.createElement('div')
  dividerDot.style.cssText =
    `width:4px;height:32px;border-radius:2px;background:${COLOR.divider}`
  divider.append(dividerDot)

  // 右: コードパネル
  const rightPane = buildCodePanels(target)

  darkContainer.append(leftPane, divider, rightPane)

  /* ── 組み立て ── */
  overlay.append(header, titleBar, darkContainer)
  document.body.append(overlay)
}

/* ================================================================
 *  ヘッダー
 * ================================================================ */

function buildHeader(
  overlay: HTMLElement,
  quill: Quill,
  target: WidgetEditTarget,
): HTMLElement {
  const header = document.createElement('div')
  header.style.cssText =
    `display:flex;align-items:center;padding:12px 20px;border-bottom:1px solid #eee;flex-shrink:0`

  // 閉じる
  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.textContent = '閉じる'
  closeBtn.style.cssText =
    `border:none;background:none;color:#666;font:14px/1 ${FONT};cursor:pointer;padding:4px 8px`
  closeBtn.addEventListener('click', () => overlay.remove())

  // Widget編集（中央）
  const title = document.createElement('div')
  title.textContent = 'Widget編集'
  title.style.cssText =
    `flex:1;text-align:center;font:600 15px/1.4 ${FONT};color:#333`

  // 右側ボタン群
  const rightBtns = document.createElement('div')
  rightBtns.style.cssText = 'display:flex;gap:8px;align-items:center'

  const registerBtn = document.createElement('button')
  registerBtn.type = 'button'
  registerBtn.innerHTML = svgPlus() + ' Widgetとして登録'
  registerBtn.style.cssText =
    `display:flex;align-items:center;gap:4px;border:1px solid #ddd;background:#fff;` +
    `color:#333;border-radius:4px;padding:6px 14px;font:13px/1 ${FONT};cursor:pointer`
  registerBtn.addEventListener('click', () => {
    toast('Widgetとして登録はクローンでは未対応です')
  })

  const updateBtn = document.createElement('button')
  updateBtn.type = 'button'
  updateBtn.textContent = '更新する'
  updateBtn.style.cssText =
    `border:none;background:#1976d2;color:#fff;border-radius:4px;padding:6px 20px;` +
    `font:600 13px/1 ${FONT};cursor:pointer`
  updateBtn.addEventListener('click', () => {
    const htmlArea = overlay.querySelector<HTMLTextAreaElement>('[data-code-html]')
    const cssArea = overlay.querySelector<HTMLTextAreaElement>('[data-code-css]')
    const htmlCode = htmlArea?.value.trim() ?? ''
    const cssCode = cssArea?.value.trim() ?? ''

    if (htmlCode === '') {
      toast('HTMLが空です', 'error')
      return
    }

    const finalHtml = cssCode !== '' ? `<style>${cssCode}</style>${htmlCode}` : htmlCode
    quill.deleteText(target.index, target.length, 'user')
    quill.insertEmbed(target.index, 'sbwidget', finalHtml, 'user')

    overlay.remove()
    toast('Widgetを更新しました')
  })

  rightBtns.append(registerBtn, updateBtn)
  header.append(closeBtn, title, rightBtns)
  return header
}

/* ================================================================
 *  タイトル行
 * ================================================================ */

function buildTitleBar(target: WidgetEditTarget): HTMLElement {
  const bar = document.createElement('div')
  bar.style.cssText =
    `display:flex;align-items:center;gap:8px;padding:12px 20px;border-bottom:1px solid #eee;flex-shrink:0`

  const handle = document.createElement('span')
  handle.innerHTML = svgDragHandle()
  handle.style.cssText = 'color:#999;cursor:grab;flex-shrink:0'

  const nameEl = document.createElement('div')
  nameEl.textContent = guessWidgetName(target.html)
  nameEl.style.cssText =
    `font:600 14px/1.4 ${FONT};color:#333;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap`

  bar.append(handle, nameEl)
  return bar
}

/* ================================================================
 *  左ペイン: ビジュアルエディタ
 * ================================================================ */

function buildVisualEditor(target: WidgetEditTarget): HTMLElement {
  const pane = document.createElement('div')
  pane.style.cssText = `flex:1;display:flex;flex-direction:column;min-width:0`

  // ツールバー
  const toolbar = document.createElement('div')
  toolbar.style.cssText = `background:#fff;border-bottom:1px solid #ddd;flex-shrink:0`

  const toolbarRow1 = document.createElement('div')
  toolbarRow1.style.cssText =
    `display:flex;flex-wrap:wrap;gap:2px;padding:6px 10px;align-items:center`

  const tools = [
    { label: '↩', title: '元に戻す' },
    { label: '↪', title: 'やり直す' },
    { label: 'sans-serif', title: 'フォント', wide: true },
    { label: '−', title: 'フォントサイズを小さく' },
    { label: '19', title: 'フォントサイズ' },
    { label: '+', title: 'フォントサイズを大きく' },
    { label: 'B', title: '太字', bold: true },
    { label: 'U', title: '下線' },
    { label: 'S', title: '取り消し線' },
    { label: '≡', title: '配置' },
    { label: 'A', title: '文字色' },
    { label: '■', title: '背景色' },
    { label: '🖼', title: '画像' },
    { label: '💡', title: 'マーカー' },
    { label: '⏎', title: '改行' },
  ]
  for (const t of tools) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = t.label
    btn.title = t.title
    btn.style.cssText =
      `border:none;background:none;padding:4px 6px;font:${t.bold ? 'bold ' : ''}13px/1 ${FONT};` +
      `color:#555;cursor:pointer;min-width:24px;border-radius:2px`
    btn.addEventListener('mouseenter', () => { btn.style.background = '#f0f0f0' })
    btn.addEventListener('mouseleave', () => { btn.style.background = 'none' })
    btn.addEventListener('click', (e) => { e.preventDefault() })
    toolbarRow1.append(btn)
  }

  const toolbarRow2 = document.createElement('div')
  toolbarRow2.style.cssText = `display:flex;gap:2px;padding:2px 10px 6px;align-items:center`
  for (const t of [{ label: '🔗', title: 'リンク' }, { label: 'Tx', title: '書式クリア' }]) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = t.label
    btn.title = t.title
    btn.style.cssText =
      `border:none;background:none;padding:4px 6px;font:13px/1 ${FONT};color:#555;cursor:pointer;min-width:24px;border-radius:2px`
    btn.addEventListener('click', (e) => { e.preventDefault() })
    toolbarRow2.append(btn)
  }
  toolbar.append(toolbarRow1, toolbarRow2)

  // エディタ本文
  const editorBody = document.createElement('div')
  editorBody.style.cssText =
    `flex:1;background:#fff;overflow-y:auto;padding:16px;min-height:0`
  // CSS を style タグとして注入してからHTMLをレンダリング
  if (target.css.trim() !== '') {
    const styleTag = document.createElement('style')
    styleTag.textContent = target.css
    editorBody.append(styleTag)
  }
  const contentDiv = document.createElement('div')
  contentDiv.innerHTML = target.html
  editorBody.append(contentDiv)

  pane.append(toolbar, editorBody)
  return pane
}

/* ================================================================
 *  右ペイン: コードパネル (HTML + CSS)
 * ================================================================ */

function buildCodePanels(target: WidgetEditTarget): HTMLElement {
  const pane = document.createElement('div')
  pane.style.cssText = `flex:1;display:flex;flex-direction:column;min-width:0`

  // 「デフォルト時のコードを表示」トグル行 + ビューアイコン
  const toggleRow = document.createElement('div')
  toggleRow.style.cssText =
    `display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:8px 12px;flex-shrink:0`

  const toggleLabel = document.createElement('span')
  toggleLabel.textContent = 'デフォルト時のコードを表示'
  toggleLabel.style.cssText = `font:12px/1 ${FONT};color:#aaa`

  const toggle = document.createElement('button')
  toggle.type = 'button'
  toggle.role = 'switch'
  toggle.setAttribute('aria-checked', 'false')
  toggle.style.cssText =
    `width:36px;height:20px;border-radius:10px;border:none;background:${COLOR.toggleBg};` +
    `position:relative;cursor:pointer;transition:background .2s;flex-shrink:0`
  const toggleKnob = document.createElement('span')
  toggleKnob.style.cssText =
    `position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;` +
    `background:#fff;transition:left .2s;box-shadow:0 1px 2px rgba(0,0,0,.3)`
  toggle.append(toggleKnob)
  toggle.addEventListener('click', () => {
    const on = toggle.getAttribute('aria-checked') === 'true'
    toggle.setAttribute('aria-checked', String(!on))
    toggle.style.background = on ? COLOR.toggleBg : COLOR.toggleBgOn
    toggleKnob.style.left = on ? '2px' : '18px'
  })

  // ビュー切替アイコン（本番の2つのアイコンボタン）
  const viewBtns = document.createElement('div')
  viewBtns.style.cssText = 'display:flex;gap:2px;margin-left:8px'
  const viewSplit = makeViewButton(svgViewSplit(), '分割表示')
  const viewCode = makeViewButton(svgViewCode(), 'コード表示')
  viewCode.style.background = '#444' // アクティブ
  viewBtns.append(viewSplit, viewCode)

  toggleRow.append(toggleLabel, toggle, viewBtns)

  // HTML(カスタム) パネル
  const htmlPanel = createHighlightedCodePanel('HTML(カスタム)', target.html, 'data-code-html', 'html')

  // 分割線
  const codeDivider = document.createElement('div')
  codeDivider.style.cssText = `height:10px;background:${COLOR.container};flex-shrink:0`

  // CSS(カスタム) パネル
  const cssPanel = createHighlightedCodePanel('CSS(カスタム)', target.css, 'data-code-css', 'css')

  pane.append(toggleRow, htmlPanel, codeDivider, cssPanel)
  return pane
}

function makeViewButton(svgHtml: string, title: string): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.title = title
  btn.innerHTML = svgHtml
  btn.style.cssText =
    `border:1px solid #555;background:${COLOR.container};color:#aaa;border-radius:3px;` +
    `padding:4px 6px;cursor:pointer;display:flex;align-items:center`
  return btn
}

/* ================================================================
 *  構文ハイライト付きコードパネル
 *
 *  textareaを透明にして重ね、背後にハイライト済み pre を置く
 *  「overlay editor」パターン。
 * ================================================================ */

function createHighlightedCodePanel(
  title: string,
  content: string,
  dataAttr: string,
  lang: 'html' | 'css',
): HTMLElement {
  const panel = document.createElement('div')
  panel.style.cssText =
    `flex:1;display:flex;flex-direction:column;background:${COLOR.codePanel};overflow:hidden;min-height:0`

  // ラベル
  const label = document.createElement('div')
  label.textContent = title
  label.style.cssText =
    `padding:8px 12px;font:12px/1.4 ${MONO};color:${COLOR.labelText};flex-shrink:0`

  // コードエリア
  const codeWrap = document.createElement('div')
  codeWrap.style.cssText = `flex:1;display:flex;overflow:hidden;min-height:0`

  // 行番号ガター
  const gutter = document.createElement('div')
  gutter.style.cssText =
    `width:40px;background:${COLOR.codePanel};border-right:1px solid ${COLOR.codeBorder};` +
    `overflow:hidden;flex-shrink:0;padding:4px 6px 4px 0;text-align:right;box-sizing:border-box;` +
    `font:12px/1.6 ${MONO};color:${COLOR.lineNumberText};user-select:none`
  updateLineNumbers(gutter, content)

  // エディタコンテナ（overlay パターン）
  const editorBox = document.createElement('div')
  editorBox.style.cssText = `flex:1;position:relative;overflow:auto;min-height:0`

  // ハイライト表示用 pre
  const highlight = document.createElement('pre')
  highlight.style.cssText =
    `position:absolute;inset:0;margin:0;padding:4px 12px;` +
    `font:12px/1.6 ${MONO};white-space:pre;pointer-events:none;overflow:hidden;` +
    `tab-size:2;word-wrap:normal`
  highlight.innerHTML = (lang === 'html' ? highlightHtml(content) : highlightCss(content))

  // textarea（透明・入力受付）
  const textarea = document.createElement('textarea')
  textarea.value = content
  textarea.spellcheck = false
  textarea.setAttribute(dataAttr, 'true')
  textarea.style.cssText =
    `position:relative;z-index:1;width:100%;height:100%;border:none;resize:none;padding:4px 12px;` +
    `font:12px/1.6 ${MONO};color:transparent;caret-color:${COLOR.codeText};` +
    `background:transparent;outline:none;white-space:pre;overflow:auto;` +
    `tab-size:2;box-sizing:border-box`

  // 入力同期
  const sync = (): void => {
    highlight.innerHTML = (lang === 'html' ? highlightHtml(textarea.value) : highlightCss(textarea.value))
    updateLineNumbers(gutter, textarea.value)
  }
  textarea.addEventListener('input', sync)
  textarea.addEventListener('scroll', () => {
    highlight.style.transform = `translate(-${textarea.scrollLeft}px,-${textarea.scrollTop}px)`
    gutter.scrollTop = textarea.scrollTop
  })

  // Tab キーでインデント
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end)
      textarea.selectionStart = textarea.selectionEnd = start + 2
      sync()
    }
  })

  editorBox.append(highlight, textarea)
  codeWrap.append(gutter, editorBox)
  panel.append(label, codeWrap)
  return panel
}

/* ================================================================
 *  行番号
 * ================================================================ */

function updateLineNumbers(gutter: HTMLElement, content: string): void {
  const count = (content.match(/\n/g)?.length ?? 0) + 1
  const lines: string[] = []
  for (let i = 1; i <= Math.max(count, 20); i++) lines.push(String(i))
  gutter.textContent = lines.join('\n')
}

/* ================================================================
 *  ヘルパー
 * ================================================================ */

function getBlotIndex(quill: Quill, node: HTMLElement): { index: number; length: number } | null {
  try {
    const blot = (quill as unknown as { scroll: { find: (n: Node) => unknown } }).scroll.find(node)
    if (blot === null || blot === undefined) return null
    const b = blot as { offset: (p?: unknown) => number; length: () => number; parent?: unknown }
    const index = typeof b.offset === 'function' && b.parent
      ? b.offset((quill as unknown as { scroll: unknown }).scroll)
      : quill.getIndex(blot as unknown as Parameters<typeof quill.getIndex>[0])
    const length = typeof b.length === 'function' ? b.length() : 1
    return { index, length }
  } catch {
    return null
  }
}

/** Widget の HTML から名前を推定する（最初のクラス名またはテキストから）。 */
function guessWidgetName(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const firstEl = doc.body.firstElementChild
  const cls = firstEl?.className ?? ''
  const firstText = doc.body.textContent?.trim().substring(0, 30) ?? ''
  if (cls !== '') return (cls.split(/\s+/)[0] ?? firstText) || 'Widget'
  return firstText || 'Widget'
}

/** Widget の innerHTML から style タグの CSS を抽出する。 */
function extractCss(node: HTMLElement): string {
  const styles: string[] = []
  for (const style of node.querySelectorAll('style')) {
    styles.push(style.textContent ?? '')
  }
  for (const style of document.head.querySelectorAll('style[data-widget-css]')) {
    styles.push(style.textContent ?? '')
  }
  return styles.join('\n').trim()
}

/** Widget の innerHTML から style タグを除いた HTML を抽出する。 */
function extractHtml(node: HTMLElement): string {
  const clone = node.cloneNode(true) as HTMLElement
  for (const style of clone.querySelectorAll('style')) style.remove()
  return clone.innerHTML.trim()
}

/* ================================================================
 *  SVG アイコン
 * ================================================================ */

function svgPlus(): string {
  return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="vertical-align:middle">
    <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`
}

function svgDragHandle(): string {
  return `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="vertical-align:middle">
    <rect x="3" y="3" width="10" height="1.5" rx=".75"/>
    <rect x="3" y="7.25" width="10" height="1.5" rx=".75"/>
    <rect x="3" y="11.5" width="10" height="1.5" rx=".75"/>
  </svg>`
}

/** 分割表示アイコン（本番の左側アイコン） */
function svgViewSplit(): string {
  return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2">
    <rect x="1" y="2" width="14" height="12" rx="1.5"/>
    <line x1="8" y1="2" x2="8" y2="14"/>
  </svg>`
}

/** コード表示アイコン（本番の右側アイコン） */
function svgViewCode(): string {
  return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2">
    <path d="M5 4 L2 8 L5 12"/>
    <path d="M11 4 L14 8 L11 12"/>
    <line x1="9" y1="3" x2="7" y2="13"/>
  </svg>`
}
