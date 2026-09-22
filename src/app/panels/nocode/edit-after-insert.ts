/**
 * 見本を「追加」したあと、そのWidgetの編集画面を開く（ノーコードでWidgetを作る①）。
 *
 * 追加はQuillへの差し込みなので、戻り値から要素を取れない。
 * 足す前にあったWidgetを控えておき、足したあとに増えた1つを探す。
 */
import type Quill from 'quill'
import { openWidgetEditorForNode } from '../widget-editor.ts'
import { newestNode } from './nocode-flow.ts'

/** 本文に入っているWidget（`section.sb-widget-block`） */
export function widgetNodesInEditor(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('.ql-editor section.sb-widget-block')]
}

/**
 * 足す前の一覧と比べて、いま増えたWidgetの編集画面を開く。
 * 見本の名前は `data-widget-title` に控える（「Widgetとして登録」の名前の初期値に使う）。
 * 画面の上だけの目印で、保存されるHTMLには入らない（Widgetの中身だけが保存される）。
 */
export function openEditorOnNewest(quill: Quill, before: readonly HTMLElement[], title: string): void {
  const node = newestNode(before, widgetNodesInEditor())
  if (node === null) return
  node.dataset['widgetTitle'] = title
  node.scrollIntoView({ block: 'center' })
  openWidgetEditorForNode(quill, node)
}
