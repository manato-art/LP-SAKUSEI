/**
 * Widget編集オーバーレイ（本番 SquadBeyond の Widget 編集 UI の再現）。
 *
 * エディタ上の Widget（SbWidgetBlot）をクリックすると開くフルスクリーンパネル。
 * 本番の実測色:
 *   - 全体コンテナ背景: #2B2B2B (rgb(43,43,43))
 *   - コードパネル背景: #151515 (rgb(21,21,21))
 *   - ラベル文字色: #fff
 *
 * 構造:
 *   ┌─ ヘッダー（閉じる ｜ Widget編集 ｜ + Widgetとして登録 ｜ 更新する）──┐
 *   ├─ タイトル行（≡ Widget名（カテゴリー））────────────────────────────────┤
 *   ├─ ダークコンテナ (#2B2B2B) ─────────────────────────────────────────────┤
 *   │  ┌──── 左: ビジュアルエディタ(白背景) ────┐ ┌──── 右: コードパネル ────┐│
 *   │  │  ツールバー                            │ │  デフォルト時のコード表示 ││
 *   │  │  ─────────────────────                 │ │  HTML(カスタム)  [#151515]││
 *   │  │  エディタ本文                          │ │  ────────────────────────││
 *   │  │                                        │ │  CSS(カスタム)   [#151515]││
 *   │  └────────────────────────────────────────┘ └────────────────────────┘│
 *   └──────────────────────────────────────────────────────────────────────┘
 */
import type Quill from 'quill'
import { toast } from '../ui.ts'

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
  labelBg: '#151515',
  lineNumber: '#555',
  lineNumberText: '#888',
  divider: '#444',
  toggleBg: '#3a3a3a',
  toggleBgOn: '#1976d2',
} as const

const FONT = '"Hiragino Sans","Hiragino Kaku Gothic ProN",sans-serif'
const MONO = '"SF Mono",Menlo,"Fira Code",monospace'

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
    // コードパネルの HTML/CSS を取得して Widget を更新
    const htmlArea = overlay.querySelector<HTMLTextAreaElement>('[data-code-html]')
    const cssArea = overlay.querySelector<HTMLTextAreaElement>('[data-code-css]')
    const htmlCode = htmlArea?.value.trim() ?? ''
    const cssCode = cssArea?.value.trim() ?? ''

    if (htmlCode === '') {
      toast('HTMLが空です', 'error')
      return
    }

    const finalHtml = cssCode !== '' ? `<style>${cssCode}</style>${htmlCode}` : htmlCode

    // Quill 上の既存 Widget を差し替え
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

  // ドラッグハンドル
  const handle = document.createElement('span')
  handle.innerHTML = svgDragHandle()
  handle.style.cssText = 'color:#999;cursor:grab;flex-shrink:0'

  // Widget名（HTML内容から推定）
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
  pane.style.cssText =
    `flex:1;display:flex;flex-direction:column;min-width:0`

  // ツールバー
  const toolbar = document.createElement('div')
  toolbar.style.cssText =
    `background:#fff;border-bottom:1px solid #ddd;flex-shrink:0`

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

  // エディタ本文（Widgetの実HTMLをレンダリング）
  const editorBody = document.createElement('div')
  editorBody.style.cssText =
    `flex:1;background:#fff;overflow-y:auto;padding:16px;min-height:0`
  editorBody.innerHTML = target.html

  pane.append(toolbar, editorBody)
  return pane
}

/* ================================================================
 *  右ペイン: コードパネル (HTML + CSS)
 * ================================================================ */

function buildCodePanels(target: WidgetEditTarget): HTMLElement {
  const pane = document.createElement('div')
  pane.style.cssText =
    `flex:1;display:flex;flex-direction:column;min-width:0`

  // 「デフォルト時のコードを表示」トグル行
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
  toggleRow.append(toggleLabel, toggle)

  // HTML(カスタム) パネル
  const htmlPanel = createDarkCodePanel('HTML(カスタム)', target.html, 'data-code-html')

  // 分割線
  const codeDivider = document.createElement('div')
  codeDivider.style.cssText =
    `height:10px;background:${COLOR.container};flex-shrink:0`

  // CSS(カスタム) パネル
  const cssPanel = createDarkCodePanel('CSS(カスタム)', target.css, 'data-code-css')

  pane.append(toggleRow, htmlPanel, codeDivider, cssPanel)
  return pane
}

/**
 * 本番準拠のダークコードパネル。
 * 背景 #151515、白ラベル、行番号付き。
 */
function createDarkCodePanel(title: string, content: string, dataAttr: string): HTMLElement {
  const panel = document.createElement('div')
  panel.style.cssText =
    `flex:1;display:flex;flex-direction:column;background:${COLOR.codePanel};overflow:hidden;min-height:0`

  // ラベル
  const label = document.createElement('div')
  label.textContent = title
  label.style.cssText =
    `padding:8px 12px;font:12px/1.4 ${MONO};color:${COLOR.labelText};flex-shrink:0`

  // コードエリア（行番号 + textarea）
  const codeWrap = document.createElement('div')
  codeWrap.style.cssText = `flex:1;display:flex;overflow:hidden;min-height:0`

  // 行番号ガター
  const gutter = document.createElement('div')
  gutter.style.cssText =
    `width:40px;background:${COLOR.codePanel};border-right:1px solid ${COLOR.codeBorder};` +
    `overflow:hidden;flex-shrink:0;padding:4px 0;text-align:right;box-sizing:border-box;` +
    `font:12px/1.6 ${MONO};color:${COLOR.lineNumberText};user-select:none`
  updateLineNumbers(gutter, content)

  // textarea
  const textarea = document.createElement('textarea')
  textarea.value = content
  textarea.spellcheck = false
  textarea.setAttribute(dataAttr, 'true')
  textarea.style.cssText =
    `flex:1;border:none;resize:none;padding:4px 12px;` +
    `font:12px/1.6 ${MONO};color:${COLOR.codeText};` +
    `background:${COLOR.codePanel};outline:none;min-height:0;white-space:pre;overflow:auto;` +
    `tab-size:2`

  // 行番号の同期
  textarea.addEventListener('input', () => updateLineNumbers(gutter, textarea.value))
  textarea.addEventListener('scroll', () => { gutter.scrollTop = textarea.scrollTop })

  // Tab キーでインデント
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end)
      textarea.selectionStart = textarea.selectionEnd = start + 2
      updateLineNumbers(gutter, textarea.value)
    }
  })

  codeWrap.append(gutter, textarea)
  panel.append(label, codeWrap)
  return panel
}

function updateLineNumbers(gutter: HTMLElement, content: string): void {
  const count = (content.match(/\n/g)?.length ?? 0) + 1
  const lines: string[] = []
  for (let i = 1; i <= Math.max(count, 20); i++) {
    lines.push(String(i))
  }
  gutter.textContent = lines.join('\n')
  gutter.style.padding = '4px 6px 4px 0'
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

/** Widget の HTML から名前を推定する（最初のテキストやクラス名から）。 */
function guessWidgetName(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  // クラス名ベースの推定
  const firstEl = doc.body.firstElementChild
  const cls = firstEl?.className ?? ''
  // テキストベースの推定
  const firstText = doc.body.textContent?.trim().substring(0, 40) ?? ''
  if (cls !== '') return (cls.split(/\s+/)[0] ?? firstText) || 'Widget'
  return firstText || 'Widget'
}

/** Widget の innerHTML から style タグの CSS を抽出する。 */
function extractCss(node: HTMLElement): string {
  const styles: string[] = []
  for (const style of node.querySelectorAll('style')) {
    styles.push(style.textContent ?? '')
  }
  // head に注入されたwidget CSSも探す
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

/** + アイコン SVG */
function svgPlus(): string {
  return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="vertical-align:middle">
    <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`
}

/** ドラッグハンドル SVG（≡ 的な3本線） */
function svgDragHandle(): string {
  return `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="vertical-align:middle">
    <rect x="3" y="3" width="10" height="1.5" rx=".75"/>
    <rect x="3" y="7.25" width="10" height="1.5" rx=".75"/>
    <rect x="3" y="11.5" width="10" height="1.5" rx=".75"/>
  </svg>`
}
