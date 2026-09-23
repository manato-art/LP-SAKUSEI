/**
 * Widget編集への入口（本番 SquadBeyond の Widget 編集 UI の再現）。
 *
 * エディタ上の Widget（SbWidgetBlot）をクリックすると開く。画面そのものは widget-studio.ts
 * （2026-09-23 に「ノーコードで作る」と1つにした。部品で作ったWidgetは部品として、それ以外はHTMLとして直す）。
 * ここに残るのは、キャンバス側の配線: クリックで開く・Widget CSS のスコープ補正・Widget の位置（index/length）。
 */
import type Quill from 'quill'
import { COLOR, type WidgetEditTarget } from './widget-editor-theme.ts'
import { widgetResetCss } from '../../shared/sb-preview-css.ts'
import { scopeWidgetCss } from './widget-style-scope.ts'
import { widgetSelectionCss } from './widget-canvas-css.ts'
import { extractCss, extractHtml } from './widget-editor-html.ts'
import { openWidgetStudio } from './widget-studio.ts'

export { guessWidgetName } from './widget-editor-html.ts'

/* ================================================================
 *  Widget 選択 CSS（一度だけ注入）
 * ================================================================ */

let selectionCssInjected = false

function injectSelectionCss(): void {
  if (selectionCssInjected) return
  selectionCssInjected = true
  const style = document.createElement('style')
  style.setAttribute('data-widget-selection', 'true')
  style.textContent = widgetSelectionCss(COLOR.selectBorder)
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

  // Widget CSSのスコープ補正（指示148）
  const refresh = (): void => {
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
    openWidgetEditorForNode(quill, widgetBlock)
  })
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
 * 元の `<style>` は止めて、写しだけで表示する（@media を LPの幅で判定するため。作り直しは widget-style-scope.ts）。
 * HTML には触らないので、保存・配信は不変。
 */
const CANVAS_SCOPE = '.ql-editor .sb-widget-block'

/**
 * 編集キャンバスの箇条書きの飾り（採取した編集画面のCSSの `.ql-editor ul > li::before{content:"•"}` と、
 * Quill の `.ql-editor li{list-style-type:none;padding-left:1.5em}`）が、Widget の中の ul/li にも効いて
 * 「・✓ 送料無料」のように余計な点が出ていた（2026-09-22 実測。配信は .ql-editor の外なので出ない）。
 * Widget の中だけ、ブラウザ本来の箇条書きに戻す。
 * 強さは編集画面のCSS（採取物の `.ql-editor ul li:not(.ql-direction-rtl)`）と同じにし、あとに置いて勝つ。
 * Widget 自身の指定はさらにあとに並ぶので、同じ強さなら Widget が勝つ（li に余白や印を付けている Widget はそのまま）。
 */
const CANVAS_LIST_RESET =
  `${CANVAS_SCOPE} :is(ul,ol) li{list-style-type:revert;padding-left:revert;position:revert}` +
  `${CANVAS_SCOPE} li::before{content:none}`

function refreshWidgetCanvasCss(editor: HTMLElement): void {
  let imports = ''
  let rules = ''
  for (const style of editor.querySelectorAll<HTMLStyleElement>('section.sb-widget-block style')) {
    const scoped = scopeWidgetCss(style.textContent ?? '', CANVAS_SCOPE)
    imports += scoped.imports
    rules += scoped.rules
    // 元の <style> は止める。ブラウザは @media をウィンドウ幅で判定するので、残すとPC用の値が勝ってしまう
    // （本人指定: 編集画面は LPの幅 620px で判定）。SquadBeyond のプレビュー用CSSも画面全体に効いてしまう。
    // 表示は上で作り直した写しで行う。sheet.disabled は HTML に書き出されないので、保存される内容は変わらない。
    if (style.sheet !== null) style.sheet.disabled = true
  }
  // 配信と同じ「Widget の見た目に要る土台」を Widget 自身の指定より前に置く（同じ強さなら Widget が勝つ）。
  // @import は先頭にしか書けないので、さらにその前へまとめる。
  const hasWidget = editor.querySelector('section.sb-widget-block') !== null
  const next = hasWidget ? imports + widgetResetCss(CANVAS_SCOPE) + CANVAS_LIST_RESET + rules : ''
  let head = document.getElementById('sb-widget-canvas-scope') as HTMLStyleElement | null
  if (head === null) {
    head = document.createElement('style')
    head.id = 'sb-widget-canvas-scope'
    document.head.append(head)
  }
  if (head.textContent !== next) head.textContent = next
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
 * Widget ノード（section.sb-widget-block）を指定して Widget 編集を開く。
 * キャンバスのクリックと、widget-nav.ts の左カードからの呼び出し用。
 */
export function openWidgetEditorForNode(quill: Quill, widgetNode: HTMLElement): void {
  const blotIndex = getBlotIndex(quill, widgetNode)
  if (blotIndex === null) return
  const target: WidgetEditTarget = {
    node: widgetNode,
    html: extractHtml(widgetNode),
    css: extractCss(widgetNode),
    index: blotIndex.index,
    length: blotIndex.length,
  }
  openWidgetStudio(quill, { kind: 'lp', target })
}
