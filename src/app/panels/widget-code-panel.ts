/**
 * Widget編集画面の右側「コードパネル」（widget-editor.ts から分離）。
 *
 * HTML と CSS を行番号つきで出し、色分けしたまま編集できるようにする。
 */
import { COLOR, FONT, MONO, type WidgetEditTarget } from './widget-editor-theme.ts'
import { highlightHtml, highlightCss } from './syntax-highlight.ts'
import { svgViewCode, svgViewSplit } from './widget-editor-icons.ts'
import { applyCodeSelectionStyle } from './code-selection.ts'

export function buildCodePanels(target: WidgetEditTarget): HTMLElement {
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
export function makeViewButton(svgHtml: string, title: string): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.title = title
  btn.innerHTML = svgHtml
  btn.style.cssText =
    `border:1px solid #555;background:${COLOR.container};color:#aaa;border-radius:3px;` +
    `padding:4px 6px;cursor:pointer;display:flex;align-items:center`
  return btn
}
export function createHighlightedCodePanel(
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
  editorBox.style.cssText = `flex:1;position:relative;overflow:hidden;min-height:0`

  // ハイライト表示用 pre
  const highlight = document.createElement('pre')
  highlight.style.cssText =
    // 指示177: inset:0 で高さを固定し overflow:hidden にすると、内容がコンテナの高さで
    // 切り落とされ、スクロールした先の行がハイライト層に存在しなくなる（文字が出ない）。
    // 内容の高さのまま置き、はみ出しのクリップはコンテナ(editorBox)に任せる。
    `position:absolute;top:0;left:0;min-width:100%;margin:0;padding:4px 12px;` +
    `font:12px/1.6 ${MONO};white-space:pre;pointer-events:none;overflow:visible;` +
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
  // 指示177: 選択範囲が不透明だと下の色付きコードが隠れて読めなくなる
  applyCodeSelectionStyle(textarea)

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
export function updateLineNumbers(gutter: HTMLElement, content: string): void {
  const count = (content.match(/\n/g)?.length ?? 0) + 1
  const lines: string[] = []
  for (let i = 1; i <= Math.max(count, 20); i++) lines.push(String(i))
  gutter.textContent = lines.join('\n')
}
