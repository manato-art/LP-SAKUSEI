/**
 * Widget編集オーバーレイ（本番 SquadBeyond の Widget 編集 UI の再現）。
 *
 * エディタ上の Widget（SbWidgetBlot）をクリックすると開くインラインパネル。
 * 本番の実測色:
 *   - 全体コンテナ背景: #2B2B2B (rgb(43,43,43))
 *   - コードパネル背景: #151515 (rgb(21,21,21))
 *   - ラベル文字色: #fff
 *   - 構文ハイライト: Material Theme 系
 *   - ブランドカラー: #0091ff (rgb(0,145,255))
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
  toggleBgOn: '#0091ff',
  brand: '#0091ff',
  // Widget 選択UI
  selectBorder: '#0091ff',
  selectLabel: '#333',
  selectLabelBg: 'rgba(0,145,255,.9)',
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
  // 既存の Widget エディタがあれば閉じる
  const existingEditor = document.querySelector('[data-widget-editor]')
  if (existingEditor !== null) {
    closeWidgetPanel(existingEditor as HTMLElement)
  }

  // 本番と同じモーダルカード: キャンバスの前面に浮かぶフローティングカード
  const panel = document.createElement('div')
  panel.dataset['widgetEditor'] = 'true'
  panel.style.cssText =
    `position:fixed;top:50%;left:calc(60px + 50%);z-index:200;` +
    `transform:translate(-50%,-50%);` +
    `width:min(88vw, 1100px);height:min(78vh, 680px);` +
    `display:flex;flex-direction:column;background:#fff;` +
    `overflow:hidden;font-family:${FONT};border-radius:12px;` +
    `box-shadow:0 8px 40px rgba(0,0,0,.18),0 0 0 1px rgba(0,0,0,.06)`

  // 背景オーバーレイ（半透明の暗幕）
  const backdrop = document.createElement('div')
  backdrop.dataset['widgetBackdrop'] = 'true'
  backdrop.style.cssText =
    `position:fixed;inset:0;z-index:199;background:rgba(0,0,0,.25)`
  backdrop.addEventListener('click', () => closeWidgetPanel(panel))
  document.body.append(backdrop, panel)

  /* ── ヘッダー ── */
  const header = buildHeader(panel, quill, target)

  /* ── タイトル行 ── */
  const titleBar = buildTitleBar(target)

  /* ── ダークコンテナ（2ペイン） ── */
  const darkContainer = document.createElement('div')
  darkContainer.style.cssText =
    `flex:1;display:flex;background:${COLOR.container};overflow:hidden;min-height:0`

  // 左: ビジュアルエディタ
  const { pane: leftPane, contentDiv } = buildVisualEditor(target)

  // 仕切り（本番実測: ~10px幅, cursor:col-resize, 中身は空＝ドットなし）
  const divider = document.createElement('div')
  divider.style.cssText =
    `width:10px;background:${COLOR.container};cursor:col-resize;flex-shrink:0;` +
    `display:flex;align-items:center;justify-content:center`

  // 右: コードパネル
  const rightPane = buildCodePanels(target)

  darkContainer.append(leftPane, divider, rightPane)

  // ビジュアルエディタ → コードパネルの同期（入力イベントで反映）
  const htmlArea = panel.querySelector<HTMLTextAreaElement>('[data-code-html]')
  const syncFn = (): void => {
    if (htmlArea !== null && contentDiv !== null) {
      htmlArea.value = contentDiv.innerHTML
    }
  }
  // buildVisualEditor 内で定義した syncContentToCode を後から差し替え
  // （クロージャ経由でアクセスするため、遅延バインドが必要）
  contentDiv.addEventListener('input', syncFn)

  /* ── 組み立て ── */
  panel.append(header, titleBar, darkContainer)
}

/** Widget 編集パネルを閉じる */
function closeWidgetPanel(panel: HTMLElement): void {
  // 背景オーバーレイも一緒に消す
  document.querySelector('[data-widget-backdrop]')?.remove()
  panel.remove()
}

/* ================================================================
 *  ヘッダー（本番実測: padding:12px, borderBottom:1px solid #f4f4f4）
 * ================================================================ */

function buildHeader(
  panel: HTMLElement,
  quill: Quill,
  target: WidgetEditTarget,
): HTMLElement {
  const header = document.createElement('div')
  header.style.cssText =
    `display:flex;align-items:center;padding:12px;border-bottom:1px solid #f4f4f4;flex-shrink:0`

  // 閉じる（本番実測: fontSize:12px, color:rgb(128,128,128), padding:0 8px）
  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.textContent = '閉じる'
  closeBtn.style.cssText =
    `border:none;background:none;color:rgb(128,128,128);font:12px/1 ${FONT};cursor:pointer;padding:0 8px`
  closeBtn.addEventListener('click', () => closeWidgetPanel(panel))

  // Widget編集（中央）
  const title = document.createElement('div')
  title.textContent = 'Widget編集'
  title.style.cssText =
    `flex:1;text-align:center;font:600 15px/1.4 ${FONT};color:#333`

  // 右側ボタン群
  const rightBtns = document.createElement('div')
  rightBtns.style.cssText = 'display:flex;gap:8px;align-items:center'

  // 「Widgetとして登録」（本番実測: fontSize:12px, color:#0091ff, border:none, SVG plus icon）
  const registerBtn = document.createElement('button')
  registerBtn.type = 'button'
  registerBtn.innerHTML = svgPlus() + ' Widgetとして登録'
  registerBtn.style.cssText =
    `display:flex;align-items:center;gap:4px;border:none;background:none;` +
    `color:${COLOR.brand};padding:6px 14px;font:12px/1 ${FONT};cursor:pointer`
  registerBtn.addEventListener('click', () => {
    toast('Widgetとして登録はクローンでは未対応です')
  })

  // 「更新する」（本番実測: fontSize:12px, color:white, bg:#0091ff, borderRadius:4px）
  const updateBtn = document.createElement('button')
  updateBtn.type = 'button'
  updateBtn.textContent = '更新する'
  updateBtn.style.cssText =
    `border:none;background:${COLOR.brand};color:#fff;border-radius:4px;padding:6px 20px;` +
    `font:12px/1 ${FONT};cursor:pointer`
  updateBtn.addEventListener('click', () => {
    const htmlArea = panel.querySelector<HTMLTextAreaElement>('[data-code-html]')
    const cssArea = panel.querySelector<HTMLTextAreaElement>('[data-code-css]')
    const htmlCode = htmlArea?.value.trim() ?? ''
    const cssCode = cssArea?.value.trim() ?? ''

    if (htmlCode === '') {
      toast('HTMLが空です', 'error')
      return
    }

    const finalHtml = cssCode !== '' ? `<style>${cssCode}</style>${htmlCode}` : htmlCode
    quill.deleteText(target.index, target.length, 'user')
    quill.insertEmbed(target.index, 'sbwidget', finalHtml, 'user')

    closeWidgetPanel(panel)
    toast('Widgetを更新しました')
  })

  rightBtns.append(registerBtn, updateBtn)
  header.append(closeBtn, title, rightBtns)
  return header
}

/* ================================================================
 *  タイトル行（本番実測: fontSize:16px, fontWeight:400, icon:fa-hand-point-up, border:none）
 * ================================================================ */

function buildTitleBar(target: WidgetEditTarget): HTMLElement {
  const bar = document.createElement('div')
  bar.style.cssText =
    `display:flex;align-items:center;gap:8px;padding:12px;flex-shrink:0`

  const handle = document.createElement('span')
  handle.innerHTML = svgPointingHand()
  handle.style.cssText = 'color:#999;flex-shrink:0'

  const nameEl = document.createElement('div')
  nameEl.textContent = guessWidgetName(target.html)
  nameEl.style.cssText =
    `font:400 16px/1.4 ${FONT};color:#333;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap`

  bar.append(handle, nameEl)
  return bar
}

/* ================================================================
 *  左ペイン: ビジュアルエディタ
 * ================================================================ */

function buildVisualEditor(target: WidgetEditTarget): { pane: HTMLElement; contentDiv: HTMLElement } {
  const pane = document.createElement('div')
  pane.style.cssText = `flex:1;display:flex;flex-direction:column;min-width:0`

  // ── ツールバー（本番実測: 1行 flex-wrap, height:64px, 20項目, 1px×16pxセパレータ） ──
  const toolbar = document.createElement('div')
  toolbar.style.cssText =
    `background:#fff;border-bottom:1px solid #ddd;flex-shrink:0;height:64px;box-sizing:border-box;` +
    `display:flex;flex-wrap:wrap;gap:2px;padding:6px 10px;align-items:center`

  /** contentDiv への参照（ツールバーからの書式操作に使用） */
  let contentRef: HTMLElement | null = null

  /** ツールバーアイコンボタンを生成 */
  const mkBtn = (
    innerHtml: string,
    title: string,
    action?: () => void,
    wide?: boolean,
  ): HTMLButtonElement => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.innerHTML = innerHtml
    btn.title = title
    btn.style.cssText =
      `border:none;background:none;padding:4px;color:#555;cursor:pointer;` +
      `display:flex;align-items:center;justify-content:center;gap:2px;` +
      `min-width:${wide === true ? '80' : '28'}px;height:28px;border-radius:2px`
    btn.addEventListener('mouseenter', () => { btn.style.background = '#f0f0f0' })
    btn.addEventListener('mouseleave', () => { btn.style.background = 'none' })
    btn.addEventListener('mousedown', (e) => { e.preventDefault() }) // 選択を維持
    if (action !== undefined) {
      btn.addEventListener('click', () => { action(); syncContentToCode() })
    }
    return btn
  }

  /** ビジュアルエディタの変更をコードパネルに反映する（後で配線） */
  let syncContentToCode: () => void = () => {}

  /** ツールバーセパレータ（本番実測: 1px × 16px） */
  const mkSep = (): HTMLElement => {
    const s = document.createElement('div')
    s.style.cssText = 'width:1px;height:16px;background:#ddd;margin:0 4px;flex-shrink:0'
    return s
  }

  /** フォントサイズ数値表示 */
  const mkSizeNum = (value: string): HTMLElement => {
    const el = document.createElement('span')
    el.textContent = value
    el.style.cssText =
      `display:flex;align-items:center;justify-content:center;min-width:28px;height:24px;` +
      `border:1px solid #ddd;border-radius:2px;font:12px/1 ${FONT};color:#555;padding:0 4px`
    return el
  }

  /** execCommand ラッパー */
  const exec = (cmd: string, val?: string): void => {
    contentRef?.focus()
    document.execCommand(cmd, false, val)
  }

  // 整列サイクル
  const ALIGNS = ['left', 'center', 'right', 'justifyFull'] as const
  let alignIdx = 0

  // サイズ表示
  const sizeNum = mkSizeNum('19')

  // ツールバーアイテム配置（本番の順序を再現 + 実動作接続）
  toolbar.append(
    mkBtn(svgToolUndo(), '元に戻す', () => exec('undo')),
    mkBtn(svgToolRedo(), 'やり直す', () => exec('redo')),
    mkSep(),
    mkBtn(`<span style="font:12px/1 ${FONT};white-space:nowrap">sans-serif</span>${svgDropdownArrow()}`, 'フォント', () => {
      const name = prompt('フォント名', 'sans-serif')
      if (name !== null && name.trim() !== '') exec('fontName', name.trim())
    }, true),
    mkSep(),
    mkBtn(svgToolSizeMinus(), 'サイズ−', () => {
      const cur = parseInt(sizeNum.textContent ?? '19', 10)
      const next = Math.max(8, cur - 1)
      exec('fontSize', '3')
      // fontSize command uses 1-7 scale; use inline style for exact px
      const sel = window.getSelection()
      if (sel !== null && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0)
        const span = range.commonAncestorContainer.parentElement
        if (span !== null) span.style.fontSize = `${next}px`
      }
      sizeNum.textContent = String(next)
    }),
    sizeNum,
    mkBtn(svgToolSizePlus(), 'サイズ+', () => {
      const cur = parseInt(sizeNum.textContent ?? '19', 10)
      const next = Math.min(72, cur + 1)
      exec('fontSize', '5')
      const sel = window.getSelection()
      if (sel !== null && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0)
        const span = range.commonAncestorContainer.parentElement
        if (span !== null) span.style.fontSize = `${next}px`
      }
      sizeNum.textContent = String(next)
    }),
    mkSep(),
    mkBtn(svgToolBold(), '太字', () => exec('bold')),
    mkBtn(svgToolUnderline(), '下線', () => exec('underline')),
    mkBtn(svgToolStrikethrough(), '取り消し線', () => exec('strikeThrough')),
    mkBtn(svgToolAlign(), '配置', () => {
      alignIdx = (alignIdx + 1) % ALIGNS.length
      const a = ALIGNS[alignIdx] ?? 'left'
      exec(`justify${a.charAt(0).toUpperCase()}${a.slice(1)}`)
    }),
    mkBtn(svgToolItalic(), '斜体', () => exec('italic')),
    mkBtn(svgToolTextColor(), '文字色', () => {
      const c = prompt('文字色 (例: #ff0000)', '#000000')
      if (c !== null && c.trim() !== '') exec('foreColor', c.trim())
    }),
    mkBtn(svgToolBgColor(), '背景色', () => {
      const c = prompt('背景色 (例: #ffff00)', '#ffffff')
      if (c !== null && c.trim() !== '') exec('hiliteColor', c.trim())
    }),
    mkBtn(svgToolImage(), '画像', () => {
      const url = prompt('画像URL', 'https://')
      if (url !== null && url.trim() !== '' && url.trim() !== 'https://') exec('insertImage', url.trim())
    }),
    mkBtn(svgToolMarker(), 'マーカー', () => exec('hiliteColor', '#fff176')),
    mkBtn(svgToolLink(), 'リンク', () => {
      const url = prompt('リンクURL', 'https://')
      if (url !== null && url.trim() !== '' && url.trim() !== 'https://') exec('createLink', url.trim())
    }),
    mkBtn(svgToolClearFormat(), '書式クリア', () => exec('removeFormat')),
  )

  // エディタ本文（本番実測: padding:20px, contenteditable で書式操作を可能に）
  const editorBody = document.createElement('div')
  editorBody.style.cssText =
    `flex:1;background:#fff;overflow-y:auto;padding:20px;min-height:0`
  // CSS を style タグとして注入してからHTMLをレンダリング
  if (target.css.trim() !== '') {
    const styleTag = document.createElement('style')
    styleTag.textContent = target.css
    editorBody.append(styleTag)
  }
  const contentDiv = document.createElement('div')
  contentDiv.setAttribute('contenteditable', 'true')
  contentDiv.style.cssText = 'outline:none;min-height:100px'
  contentDiv.innerHTML = target.html
  editorBody.append(contentDiv)

  // ツールバーから参照できるようにする
  contentRef = contentDiv

  pane.append(toolbar, editorBody)
  return { pane, contentDiv }
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

/**
 * Widget ノード（section.sb-widget-block）を指定して Widget 編集オーバーレイを開く。
 * widget-nav.ts の左カードからの呼び出し用。
 */
export function openWidgetEditorForNode(quill: Quill, widgetNode: HTMLElement): void {
  const blotIndex = getBlotIndex(quill, widgetNode)
  if (blotIndex === null) return
  openWidgetEditor(quill, {
    node: widgetNode,
    html: extractHtml(widgetNode),
    css: extractCss(widgetNode),
    index: blotIndex.index,
    length: blotIndex.length,
  })
}

/** Widget の HTML から名前を推定する（最初のクラス名またはテキストから）。 */
export function guessWidgetName(html: string): string {
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
 *  SVG アイコン — ヘッダー / タイトル / ビュー切替
 * ================================================================ */

function svgPlus(): string {
  return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="vertical-align:middle">
    <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`
}

/** 人差し指アイコン（本番の fa-hand-point-up 再現） */
function svgPointingHand(): string {
  return `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="vertical-align:middle"><path d="M7 1c.55 0 1 .45 1 1v5h1c.55 0 1 .45 1 1l1-1c.55 0 1 .45 1 1v3c0 2.2-1.8 4-4 4H6c-2.2 0-4-1.8-4-4V8c0-.55.45-1 1-1s1 .45 1 1V7c0-.55.45-1 1-1s1 .45 1 1V2c0-.55.45-1 1-1z"/></svg>`
}

/** 分割表示アイコン（コードパネルのビュー切替） */
function svgViewSplit(): string {
  return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2">
    <rect x="1" y="2" width="14" height="12" rx="1.5"/>
    <line x1="8" y1="2" x2="8" y2="14"/>
  </svg>`
}

/** コード表示アイコン（コードパネルのビュー切替） */
function svgViewCode(): string {
  return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2">
    <path d="M5 4 L2 8 L5 12"/>
    <path d="M11 4 L14 8 L11 12"/>
    <line x1="9" y1="3" x2="7" y2="13"/>
  </svg>`
}

/* ================================================================
 *  SVG アイコン — ツールバー（本番のSVGアイコンを再現）
 * ================================================================ */

/** ドロップダウン矢印（フォント選択などの▼） */
function svgDropdownArrow(): string {
  return `<svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left:2px"><path d="M2 3l2 2 2-2"/></svg>`
}

/** 元に戻す */
function svgToolUndo(): string {
  return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 5h7a3.5 3.5 0 0 1 0 7H8"/><path d="M5 2L2 5l3 3"/></svg>`
}

/** やり直す */
function svgToolRedo(): string {
  return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5H5a3.5 3.5 0 0 0 0 7h1"/><path d="M9 2l3 3-3 3"/></svg>`
}

/** サイズ小 (−) */
function svgToolSizeMinus(): string {
  return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="3" y1="7" x2="11" y2="7"/></svg>`
}

/** サイズ大 (+) */
function svgToolSizePlus(): string {
  return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="7" y1="3" x2="7" y2="11"/><line x1="3" y1="7" x2="11" y2="7"/></svg>`
}

/** 太字 (B) */
function svgToolBold(): string {
  return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 2h4a2.5 2.5 0 0 1 0 5H4zm0 5h4.5a2.5 2.5 0 0 1 0 5H4z"/></svg>`
}

/** 下線 (U) */
function svgToolUnderline(): string {
  return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3.5 2v4.5a3.5 3.5 0 0 0 7 0V2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="2" y1="13" x2="12" y2="13" stroke="currentColor" stroke-width="1.2"/></svg>`
}

/** 取り消し線 (S) */
function svgToolStrikethrough(): string {
  return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><line x1="1" y1="7" x2="13" y2="7" stroke-width="1.4"/><path d="M9.5 3.5C9 2.8 8.1 2.2 7 2.2c-1.5 0-2.7.9-2.7 2 0 .6.3 1.1.8 1.5"/><path d="M4.5 10.5c.5.7 1.4 1.3 2.5 1.3 1.5 0 2.7-.9 2.7-2 0-.5-.2-.9-.5-1.3"/></svg>`
}

/** 配置（左揃えアイコン + ドロップダウン） */
function svgToolAlign(): string {
  return `<svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><line x1="1" y1="2.5" x2="11" y2="2.5"/><line x1="1" y1="5.5" x2="8" y2="5.5"/><line x1="1" y1="8.5" x2="11" y2="8.5"/><line x1="1" y1="11.5" x2="8" y2="11.5"/><path d="M14 5.5l2 2-2 2" stroke-width="1.2"/></svg>`
}

/** 斜体 (I) */
function svgToolItalic(): string {
  return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><line x1="6" y1="2" x2="10" y2="2"/><line x1="4" y1="12" x2="8" y2="12"/><line x1="8" y1="2" x2="6" y2="12"/></svg>`
}

/** 文字色 (A + カラーバー) */
function svgToolTextColor(): string {
  return `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M3.5 10L7 2l3.5 8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><line x1="4.8" y1="8" x2="9.2" y2="8" stroke="currentColor" stroke-width="1.2"/><rect x="2" y="12" width="10" height="2" rx=".5" fill="#e53935"/></svg>`
}

/** 背景色 (A + 背景カラーバー) */
function svgToolBgColor(): string {
  return `<svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="10" width="12" height="3.5" rx=".5" fill="#ffca28"/><path d="M3.5 9L7 1l3.5 8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><line x1="4.8" y1="7" x2="9.2" y2="7" stroke="currentColor" stroke-width="1.2"/></svg>`
}

/** 画像 */
function svgToolImage(): string {
  return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="2" width="11" height="10" rx="1.5"/><circle cx="4.5" cy="5" r="1.2" fill="currentColor" stroke="none"/><path d="M1.5 10l3-3.5 2.5 3 2-1.5L12.5 11"/></svg>`
}

/** マーカー（ペンアイコン） */
function svgToolMarker(): string {
  return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 1l3 3-7 7H3v-3z"/><line x1="8" y1="3" x2="11" y2="6"/></svg>`
}

/** リンク（チェーンアイコン） */
function svgToolLink(): string {
  return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M6 8a3 3 0 0 0 4.24 0l1.5-1.5a3 3 0 0 0-4.24-4.24L6.62 3.14"/><path d="M8 6a3 3 0 0 0-4.24 0L2.26 7.5a3 3 0 0 0 4.24 4.24l.88-.88"/></svg>`
}

/** 書式クリア（消しゴムアイコン） */
function svgToolClearFormat(): string {
  return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 2l4.5 4.5-5 5H3.5L1 9l4-4.5z"/><line x1="5" y1="5.5" x2="9.5" y2="10"/><line x1="1" y1="12.5" x2="13" y2="12.5"/></svg>`
}
