/**
 * Widget編集画面の右側「コードパネル」（widget-editor.ts から分離）。
 *
 * HTML と CSS を行番号つきで出し、色分けしたまま編集できるようにする。
 *
 * 右上のボタン1つで表示を切り替える（指示183。2026-09-24 に2つのボタンを1つにした）。
 *   並べて表示 … 左に見え方、右にコード・部品（既定）
 *   コードだけ … 見え方を畳んで右を横いっぱいにする
 * 実際に左ペインを畳むのは呼び出し側なので、`onViewChange` で知らせる。
 *
 * 部品で作ったWidget（設定データつき・2026-09-23）では、コードは設定から書き出したものなので見るだけ。
 * 直接直したいときは「部品を解除」でHTMLのWidgetにする（readOnly）。
 */
import { COLOR, FONT, MONO, type WidgetEditTarget } from './widget-editor-theme.ts'
import { highlightHtml, highlightCss } from './syntax-highlight.ts'
import { svgViewCode, svgViewSplit } from './widget-editor-icons.ts'
import { codeCopyButton } from './code-copy.ts'
import { applyCodeSelectionStyle } from './code-selection.ts'

/** コードパネルの表示モード */
export type CodePaneView = 'split' | 'code'

export interface CodePanelOptions {
  /** 分割表示／コード表示が切り替わったとき（左ペインを畳むのは呼び出し側） */
  readonly onViewChange?: (view: CodePaneView) => void
  /**
   * 普段（「デフォルト時のコードを表示」がOFF）に出す「要素ごとに編集」（部品で作ったWidgetでは「部品」の入力欄）。
   * ONにすると代わりに今の HTML / CSS が出る（本人指定）。無ければ従来どおりコードだけを出す。
   */
  readonly design?: { readonly element: HTMLElement; readonly refresh: () => void }
  /** CSS欄が書き換えられたとき（手入力でも「要素ごとに編集」からでも）。プレビューへ流す */
  readonly onCssInput?: (css: string) => void
  /** コードを見るだけにする（部品で作ったWidget）。ボタンがあれば帯の右に出す */
  readonly readOnly?: { readonly note: string; readonly detachLabel?: string; readonly onDetach?: () => void }
  /** 「デフォルト時のコードを表示」をONにした直後（部品で作ったWidgetは、ここで今のコードを入れ直す） */
  readonly onShowCode?: () => void
}

export interface CodePanel {
  readonly pane: HTMLElement
  /** HTML・CSS の欄を入れ直す（色付け・行番号・プレビューも同じ道で更新される） */
  readonly setCode: (html: string, css: string) => void
  readonly isCodeVisible: () => boolean
}

/**
 * 右ペイン（要素ごとに編集・コード）の既定の幅。画面いっぱいになったので、
 * 右は読みやすい幅で止め、余った所は左（見え方）に回す（本人の指示 2026-09-23）。
 * 仕切りのドラッグで変えられる。「コードだけ」を選んだときは全幅（widget-studio.ts）。
 */
export const RIGHT_PANE_FLEX = '0 0 560px'

export function buildCodePanels(target: WidgetEditTarget, options: CodePanelOptions = {}): CodePanel {
  const { onViewChange, design, onCssInput, readOnly, onShowCode } = options
  const pane = document.createElement('div')
  pane.style.cssText = `flex:1;display:flex;flex-direction:column;min-width:0;min-height:0`

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

  // 表示の切り替えは1つのボタン（2026-09-24・本人「ボタンを1つにして、1つのボタンで切り替え」）。
  // 押すと「見え方と並べる」⇔「コードだけ横いっぱい」。アイコンは押したら切り替わる先、
  // コードだけのあいだはボタンを青くして、今どちらかも分かるようにする
  const viewBtn = document.createElement('button')
  viewBtn.type = 'button'
  viewBtn.dataset['codeViewToggle'] = 'true'
  let view: CodePaneView = 'split'
  const paintViewButton = (): void => {
    const codeOnly = view === 'code'
    viewBtn.innerHTML = codeOnly ? svgViewSplit() : svgViewCode()
    const label = codeOnly ? '見え方と並べて表示する' : 'コードだけを横いっぱいに表示する'
    viewBtn.title = label
    viewBtn.setAttribute('aria-label', label)
    viewBtn.setAttribute('aria-pressed', String(codeOnly))
    viewBtn.style.background = codeOnly ? 'var(--sb-accent-tint, #E6F4FF)' : 'var(--sb-c-ffffff, #FFFFFF)'
    viewBtn.style.borderColor = codeOnly ? 'var(--sb-accent, #0091FF)' : 'var(--sb-c-d5dae0, #D5DAE0)'
    viewBtn.style.color = codeOnly ? 'var(--sb-accent, #0091FF)' : 'var(--sb-c-555555, #555555)'
  }
  viewBtn.style.cssText =
    `width:30px;height:28px;margin-left:8px;border:1px solid var(--sb-c-d5dae0, #D5DAE0);border-radius:6px;cursor:pointer;` +
    `display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0;transition:border-color .15s,color .15s`
  viewBtn.addEventListener('mouseenter', () => {
    if (view === 'split') viewBtn.style.borderColor = 'var(--sb-accent, #0091FF)'
  })
  viewBtn.addEventListener('mouseleave', paintViewButton)
  viewBtn.addEventListener('click', () => {
    view = view === 'split' ? 'code' : 'split'
    paintViewButton()
    onViewChange?.(view)
  })
  paintViewButton()

  toggleRow.append(toggleLabel, toggle, viewBtn)

  // HTML(カスタム) パネル
  const htmlPanel = createCodeEditor('HTML(カスタム)', target.html, 'data-code-html', 'html', readOnly !== undefined)

  // 分割線
  const codeDivider = document.createElement('div')
  codeDivider.style.cssText = `height:10px;background:${COLOR.container};flex-shrink:0`

  // CSS(カスタム) パネル
  const cssPanel = createCodeEditor('CSS(カスタム)', target.css, 'data-code-css', 'css', readOnly !== undefined)
  const htmlArea = htmlPanel.querySelector<HTMLTextAreaElement>('[data-code-html]')
  const cssArea = cssPanel.querySelector<HTMLTextAreaElement>('[data-code-css]')
  cssArea?.addEventListener('input', (e) => onCssInput?.((e.currentTarget as HTMLTextAreaElement).value))

  // HTML と CSS はひとまとめにして、トグルで「要素ごとに編集」と入れ替える
  const codeArea = document.createElement('div')
  codeArea.style.cssText = 'flex:1;display:flex;flex-direction:column;min-height:0'
  if (readOnly !== undefined) codeArea.append(buildReadOnlyBar(readOnly))
  codeArea.append(htmlPanel, codeDivider, cssPanel)

  // 「デフォルト時のコードを表示」: 押すと今のコードを出す／戻すと「要素ごとに編集」（本人指定）
  let isCodeVisible = false
  const setCodeVisible = (visible: boolean): void => {
    const wasVisible = isCodeVisible
    isCodeVisible = visible
    toggle.setAttribute('aria-checked', String(visible))
    toggle.style.background = visible ? COLOR.toggleBgOn : COLOR.toggleBg
    toggleKnob.style.left = visible ? '18px' : '2px'
    codeArea.style.display = visible || design === undefined ? 'flex' : 'none'
    if (visible && !wasVisible) onShowCode?.()
    if (design === undefined) return
    design.element.style.display = visible ? 'none' : ''
    // コードを直接書き換えてから戻ってきたら、今のコードでカードを作り直す
    if (wasVisible && !visible) design.refresh()
  }
  toggle.addEventListener('click', () => setCodeVisible(!isCodeVisible))

  pane.append(toggleRow, codeArea)
  if (design !== undefined) pane.append(design.element)
  setCodeVisible(false)

  const setCode = (html: string, css: string): void => {
    for (const [area, value] of [
      [htmlArea, html],
      [cssArea, css],
    ] as const) {
      if (area === null || area.value === value) continue
      area.value = value
      // 値を入れるだけでは、上に重ねた色付き表示と行番号が古いまま。同じ更新を通す
      area.dispatchEvent(new Event('input'))
    }
  }
  return { pane, setCode, isCodeVisible: () => isCodeVisible }
}

/** 見るだけのコードの上に出す帯（理由と「部品を解除」） */
function buildReadOnlyBar(readOnly: NonNullable<CodePanelOptions['readOnly']>): HTMLElement {
  const bar = document.createElement('div')
  bar.dataset['codeReadonly'] = 'true'
  bar.style.cssText =
    `display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 12px;flex-shrink:0;` +
    `background:#1f1f1f;color:#bbb;font:12px/1.5 ${FONT}`
  const note = document.createElement('span')
  note.textContent = readOnly.note
  note.style.cssText = 'flex:1;min-width:180px'
  bar.append(note)
  if (readOnly.detachLabel !== undefined && readOnly.onDetach !== undefined) {
    const detach = document.createElement('button')
    detach.type = 'button'
    detach.textContent = readOnly.detachLabel
    detach.style.cssText =
      `border:1px solid #666;background:transparent;color:#eee;border-radius:4px;padding:5px 10px;` +
      `font:600 12px/1 ${FONT};cursor:pointer;white-space:nowrap`
    detach.addEventListener('click', readOnly.onDetach)
    bar.append(detach)
  }
  return bar
}

/**
 * 色付きのコード欄（行番号・Tabで字下げ・まとめてコピー）。値は `[${dataAttr}]` の textarea。
 * Widget全体のコード（見るだけ）と、見本の部品の「コードで直す」（form-sample.ts）で使う
 */
export function createCodeEditor(
  title: string,
  content: string,
  dataAttr: string,
  lang: 'html' | 'css',
  readOnly: boolean,
): HTMLElement {
  const panel = document.createElement('div')
  panel.style.cssText =
    `flex:1;display:flex;flex-direction:column;background:${COLOR.codePanel};overflow:hidden;min-height:0`

  // ラベル（右端に「まとめてコピー」）
  const label = document.createElement('div')
  label.style.cssText =
    `padding:8px 12px;font:12px/1.4 ${MONO};color:${COLOR.labelText};flex-shrink:0;` +
    `display:flex;align-items:center;justify-content:space-between;gap:8px`
  const labelText = document.createElement('span')
  labelText.textContent = title
  label.append(labelText)

  // コードエリア
  const codeWrap = document.createElement('div')
  codeWrap.style.cssText = `flex:1;display:flex;overflow:hidden;min-height:0`

  // 行番号ガター
  const gutter = document.createElement('div')
  // スマホでは入力欄だけ16pxに拡大されるので、行番号・色付き表示も同じ大きさに
  // 揃える必要がある（ずれるとカーソルが文字と合わなくなる）。CSSが掴むための目印。
  gutter.dataset['codeFont'] = 'true'
  gutter.style.cssText =
    `width:40px;background:${COLOR.codePanel};border-right:1px solid ${COLOR.codeBorder};` +
    `overflow:hidden;flex-shrink:0;padding:4px 6px 4px 0;text-align:right;box-sizing:border-box;` +
    // white-space:pre が無いと改行が畳まれ、行番号が「1 2」「3 4」と折り返して
    // コードの行とズレる（指示181のスクショで発生していた）。
    `font:12px/1.6 ${MONO};color:${COLOR.lineNumberText};user-select:none;white-space:pre`
  updateLineNumbers(gutter, content)

  // エディタコンテナ（overlay パターン）
  const editorBox = document.createElement('div')
  editorBox.style.cssText = `flex:1;position:relative;overflow:hidden;min-height:0`

  // ハイライト表示用 pre
  const highlight = document.createElement('pre')
  highlight.dataset['codeFont'] = 'true'
  highlight.style.cssText =
    // 指示177: inset:0 で高さを固定し overflow:hidden にすると、内容がコンテナの高さで
    // 切り落とされ、スクロールした先の行がハイライト層に存在しなくなる（文字が出ない）。
    // 内容の高さのまま置き、はみ出しのクリップはコンテナ(editorBox)に任せる。
    `position:absolute;top:0;left:0;min-width:100%;margin:0;padding:4px 12px;` +
    // 指示181: 地の文字色を必ず置く。ハイライトが取りこぼした語は span に包まれず
    // 素のまま出るので、ここが無いと既定の黒文字＝ほぼ黒の地に溶けて読めない。
    `font:12px/1.6 ${MONO};color:${COLOR.codeText};white-space:pre;` +
    `pointer-events:none;overflow:visible;tab-size:2;word-wrap:normal`
  highlight.innerHTML = (lang === 'html' ? highlightHtml(content) : highlightCss(content))

  // textarea（透明・入力受付）
  const textarea = document.createElement('textarea')
  textarea.value = content
  textarea.spellcheck = false
  textarea.readOnly = readOnly
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
    if (e.key === 'Tab' && !readOnly) {
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
  // コード全体をまとめてコピー（textarea が出来てから足す）
  label.append(codeCopyButton(textarea, { dark: true }))

  panel.append(label, codeWrap)
  return panel
}
function updateLineNumbers(gutter: HTMLElement, content: string): void {
  const count = (content.match(/\n/g)?.length ?? 0) + 1
  const lines: string[] = []
  for (let i = 1; i <= Math.max(count, 20); i++) lines.push(String(i))
  gutter.textContent = lines.join('\n')
}
