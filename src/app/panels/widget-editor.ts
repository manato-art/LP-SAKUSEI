/**
 * Widget編集オーバーレイ（本番 SquadBeyond の Widget 編集 UI の再現）。
 *
 * エディタ上の Widget（SbWidgetBlot）をクリックすると開くインラインパネル。
 * 本番の実測色:
 *   - 全体コンテナ背景: #2B2B2B (rgb(43,43,43))
 *   - コードパネル背景: #151515 (rgb(21,21,21))
 *   - ラベル文字色: #fff
 *   - 構文ハイライト: Material Theme 系
 *   - ブランドカラー: var(--sb-accent, #0091FF) (rgb(0,145,255))
 */
import type Quill from 'quill'
import { toast } from '../ui.ts'
import {    loadGoogleFonts } from './toolbar/text-format.ts'
import {
  svgPlus,
  svgPointingHand,
} from './widget-editor-icons.ts'
import {
  COLOR,
  FONT,
  type WidgetEditTarget,
} from './widget-editor-theme.ts'
import { closeMediaControl } from './widget-media-control.ts'
import { buildCodePanels } from './widget-code-panel.ts'
import { buildDesignPanel } from './widget-design-panel.ts'
import { buildVisualEditor } from './widget-visual-editor.ts'

/* ================================================================
 *  定数
 * ================================================================ */





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
    /* 指示155-2: 編集キャンバス(.ql-editor)は行間1.8のため、Widget内の見出し等(<br>改行)が
       広がりすぎる。配信LP・編集プレビューと同じく1.5を既定にして揃える（Widget自身が
       line-heightを明示した要素は直接指定が継承より優先されるので影響しない）。 */
    .ql-editor section.sb-widget-block { line-height:1.5; }
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
    /* 指示161: ツールバーで付けた素のリンク(<a href>・クラス無し)を、編集プレビューで
       ひと目でリンクと分かる見た目にする（青＋下線）。Widget独自の装飾リンク(.link__button等)は
       クラスを持つので影響しない。 */
    [data-widget-editor] [contenteditable="true"] a:not([class]) {
      color:#0d6efd; text-decoration:underline; cursor:pointer;
    }
  `
  document.head.append(style)
}

/* ================================================================
 *  公開 API
 * ================================================================ */


/**
 * Quill エディタ上の Widget ブロットにクリックハンドラを配線する。
 * editor.ts の初期化後に呼ぶ。
 */
export function wireWidgetClick(root: HTMLElement, quill: Quill): void {
  const editor = root.querySelector<HTMLElement>('.ql-editor')
  if (editor === null) return

  injectSelectionCss()

  // 既存の Widget ブロックに名前ラベルを付与＋Widget CSSのスコープ補正（指示148）
  const refresh = (): void => {
    labelAllWidgets(editor)
    refreshWidgetCanvasCss(editor)
  }
  refresh()

  // MutationObserver で後から追加される Widget にも適用
  const observer = new MutationObserver(refresh)
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

/**
 * 指示148: 編集キャンバス(.ql-editor)ではウィジェットが配信LPと違ってずれる問題の根本修正。
 *
 * 原因: Quill のエディタCSS `.ql-editor :is(h1..h6,p,ol,ul,pre,blockquote){margin:0}`（詳細度0,1,1）が
 * ウィジェット内のクラス規則（例: `.title{margin:0 auto}` 詳細度0,1,0）を打ち消し、`margin:auto` の
 * 中央寄せが効かなくなる。配信LPには `.ql-editor` が無いのでこの問題は起きず、正しく中央に出る。
 *
 * 対策: 各ウィジェットの `<style>` を `.ql-editor .sb-widget-block` で前置きした写しを head に注入し、
 * 詳細度をQuillリセットのさらにELに上げて、ウィジェット作者のCSSを勝たせる（キャンバス限定）。
 * 元の `<style>` はそのまま残す（保存・配信は不変）。
 */
function refreshWidgetCanvasCss(editor: HTMLElement): void {
  const SCOPE = '.ql-editor .sb-widget-block'
  let css = ''
  for (const style of editor.querySelectorAll<HTMLStyleElement>('section.sb-widget-block style')) {
    css += scopeCssText(style.textContent ?? '', SCOPE)
  }
  let head = document.getElementById('sb-widget-canvas-scope') as HTMLStyleElement | null
  if (head === null) {
    head = document.createElement('style')
    head.id = 'sb-widget-canvas-scope'
    document.head.append(head)
  }
  if (head.textContent !== css) head.textContent = css
}

/** CSSテキストの各セレクタを scope で前置きして返す（CSSOMでパースし値は保持）。 */
function scopeCssText(cssText: string, scope: string): string {
  if (cssText.trim() === '') return ''
  const tmp = document.createElement('style')
  tmp.textContent = cssText
  document.head.append(tmp)
  let out: string
  try {
    out = serializeScopedRules(tmp.sheet?.cssRules ?? null, scope)
  } catch {
    out = ''
  }
  tmp.remove()
  return out
}

function serializeScopedRules(rules: CSSRuleList | null, scope: string): string {
  if (rules === null) return ''
  let out = ''
  for (const r of Array.from(rules)) {
    if (r instanceof CSSStyleRule) {
      const sels = r.selectorText
        .split(',')
        .map((s) => `${scope} ${s.trim()}`)
        .join(',')
      out += `${sels}{${r.style.cssText}}`
    } else if (typeof CSSMediaRule !== 'undefined' && r instanceof CSSMediaRule) {
      out += `@media ${r.media.mediaText}{${serializeScopedRules(r.cssRules, scope)}}`
    } else if (typeof CSSSupportsRule !== 'undefined' && r instanceof CSSSupportsRule) {
      out += `@supports ${(r as CSSSupportsRule).conditionText}{${serializeScopedRules(r.cssRules, scope)}}`
    } else {
      // @keyframes / @font-face など：スコープ不要、そのまま
      out += r.cssText
    }
  }
  return out
}

/* ================================================================
 *  Widget 編集オーバーレイ本体
 * ================================================================ */

function openWidgetEditor(quill: Quill, target: WidgetEditTarget): void {
  // 指示158: フォント選択で確実に見た目が変わるよう、日本語Webフォントを読み込んでおく。
  loadGoogleFonts()
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
    `width:min(94vw, 1280px);height:min(82vh, 720px);` +
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
  const { pane: leftPane, contentDiv, styleTag } = buildVisualEditor(target)

  // 仕切り（本番実測: ~10px幅, cursor:col-resize, 中身は空＝ドットなし）
  const divider = document.createElement('div')
  divider.style.cssText =
    `width:10px;background:${COLOR.container};cursor:col-resize;flex-shrink:0;` +
    `display:flex;align-items:center;justify-content:center`

  // 右: 普段は「要素ごとに編集」、「デフォルト時のコードを表示」で今のHTML/CSS（本人指定）。
  // CSS の正本はコード欄の textarea（「更新する」もそこから保存する）。カードからの変更も
  // textarea へ書いて input を投げるので、色付け・行番号・プレビューの style まで同じ道で更新される。
  let cssArea: HTMLTextAreaElement | null = null
  const design = buildDesignPanel({
    content: contentDiv,
    readCss: () => cssArea?.value ?? target.css,
    writeCss: (css) => {
      if (cssArea === null) return
      cssArea.value = css
      cssArea.dispatchEvent(new Event('input'))
    },
  })
  // 「コード表示」を選んだら左ペインと仕切りを畳んで全幅にする（指示183）。
  // display を空文字に戻すと cssText 側の display:flex ごと消えるので、元の値を控えておく。
  const leftDisplay = leftPane.style.display
  const dividerDisplay = divider.style.display
  const rightPane = buildCodePanels(target, {
    onViewChange: (view) => {
      const codeOnly = view === 'code'
      leftPane.style.display = codeOnly ? 'none' : leftDisplay
      divider.style.display = codeOnly ? 'none' : dividerDisplay
    },
    design,
    onCssInput: (css) => {
      styleTag.textContent = css
    },
  })
  cssArea = rightPane.querySelector<HTMLTextAreaElement>('[data-code-css]')

  darkContainer.append(leftPane, divider, rightPane)

  // 仕切りをドラッグして左右ペインのサイズを調整できるようにする（要望）
  wireDividerResize(divider, leftPane, darkContainer)

  // ビジュアルエディタ → コードパネルの同期（入力イベントで反映）。
  // ※ textarea はまだ panel に append される前なので、panel からではなく
  //   （既に textarea を内包している）darkContainer から取得する。
  //   以前は panel.querySelector が null を返し、ビジュアル編集がコードへ同期されず
  //   「更新する」（コードtextareaから保存）で編集内容が失われていた。
  const htmlArea = darkContainer.querySelector<HTMLTextAreaElement>('[data-code-html]')
  const syncFn = (): void => {
    if (htmlArea !== null && contentDiv !== null) {
      htmlArea.value = contentDiv.innerHTML
      // 値を入れるだけでは、上に重ねた色付き表示と行番号が古いまま（文字は透明の textarea の方にある）。
      // 「デフォルト時のコードを表示」を押したときに古いHTMLが見えてしまうので、同じ更新を通す。
      htmlArea.dispatchEvent(new Event('input'))
    }
  }
  contentDiv.addEventListener('input', syncFn)
  // 初期値も1回そろえておく（採取HTMLとtextareaのズレ防止）
  syncFn()

  /* ── 組み立て ── */
  panel.append(header, titleBar, darkContainer)

  // 指示146: パネルがDOMに載ってからウィジェットの <script> を実行する。
  // （多くのウィジェットの init は document.querySelector で自分の要素を探すため、
  //   contentDiv がドキュメントに接続済みである必要がある。）
  runWidgetScripts(contentDiv)
}

/**
 * 仕切り（col-resize）のドラッグで左ペイン(ビジュアル)と右ペイン(コード)の幅を変える。
 * 左ペインに固定幅(px)を与え、右ペインは flex:1 のまま残り幅を埋める。左右とも最小幅を確保。
 */
function wireDividerResize(divider: HTMLElement, leftPane: HTMLElement, container: HTMLElement): void {
  const MIN = 220
  let startX = 0
  let startLeftW = 0
  const onMove = (e: MouseEvent): void => {
    e.preventDefault()
    const total = container.clientWidth
    const dividerW = divider.offsetWidth
    const max = total - dividerW - MIN
    let next = startLeftW + (e.clientX - startX)
    if (next < MIN) next = MIN
    if (next > max) next = max
    leftPane.style.flex = `0 0 ${next}px`
  }
  const onUp = (): void => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    document.body.style.userSelect = ''
  }
  divider.addEventListener('mousedown', (e) => {
    e.preventDefault()
    startX = e.clientX
    startLeftW = leftPane.getBoundingClientRect().width
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  })
}

/** Widget 編集パネルを閉じる */
function closeWidgetPanel(panel: HTMLElement): void {
  closeMediaControl()
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

  // 「Widgetとして登録」（本番実測: fontSize:12px, color:var(--sb-accent, #0091FF), border:none, SVG plus icon）
  const registerBtn = document.createElement('button')
  registerBtn.type = 'button'
  registerBtn.innerHTML = svgPlus() + ' Widgetとして登録'
  registerBtn.style.cssText =
    `display:flex;align-items:center;gap:4px;border:none;background:none;` +
    `color:${COLOR.brand};padding:6px 14px;font:12px/1 ${FONT};cursor:pointer`
  registerBtn.addEventListener('click', () => {
    toast('Widgetとして登録はクローンでは未対応です')
  })

  // 「更新する」（本番実測: fontSize:12px, color:white, bg:var(--sb-accent, #0091FF), borderRadius:4px）
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







/**
 * Widget の <script> をプレビュー内で実行する（指示146: 動作確認のため）。
 * innerHTML で挿入された <script> は実行されないので、実行可能な <script> を作り直して差し込む。
 * 多くのSBウィジェットは `DOMContentLoaded` で init するが、編集画面では既に発火済みのため、
 * 実行中だけ addEventListener('DOMContentLoaded'|'load') を「即時実行」に差し替えて init を走らせる。
 * 実行はユーザー自身のウィジェット内容（配信でも同じスクリプトが動く）なので信頼して実行する。
 */
function runWidgetScripts(contentDiv: HTMLElement): void {
  const scripts = [...contentDiv.querySelectorAll('script')]
  if (scripts.length === 0) return

  const docAdd = document.addEventListener.bind(document)
  const winAdd = window.addEventListener.bind(window)
  const fireNow = (fn: EventListenerOrEventListenerObject, type: string): void => {
    try {
      const ev = new Event(type)
      if (typeof fn === 'function') fn(ev)
      else fn.handleEvent(ev)
    } catch {
      /* 個別ウィジェットの初期化失敗は握って他へ波及させない */
    }
  }
  const patch = (orig: typeof document.addEventListener) =>
    ((type: string, fn: EventListenerOrEventListenerObject, opts?: unknown) => {
      if ((type === 'DOMContentLoaded' || type === 'load') && fn !== null) {
        fireNow(fn, type)
        return
      }
      ;(orig as (t: string, f: EventListenerOrEventListenerObject, o?: unknown) => void)(type, fn, opts)
    }) as typeof document.addEventListener
  document.addEventListener = patch(docAdd)
  window.addEventListener = patch(winAdd)
  try {
    for (const old of scripts) {
      const s = document.createElement('script')
      for (const attr of old.attributes) s.setAttribute(attr.name, attr.value)
      s.textContent = old.textContent
      old.replaceWith(s) // 差し替えで同期実行される
    }
  } finally {
    document.addEventListener = docAdd
    window.addEventListener = winAdd
  }
}

/* ================================================================
 *  右ペイン: コードパネル (HTML + CSS)
 * ================================================================ */



/* ================================================================
 *  構文ハイライト付きコードパネル
 *
 *  textareaを透明にして重ね、背後にハイライト済み pre を置く
 *  「overlay editor」パターン。
 * ================================================================ */


/* ================================================================
 *  行番号
 * ================================================================ */


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





/* ================================================================
 *  SVG アイコン — ツールバー（本番のSVGアイコンを再現）
 * ================================================================ */















