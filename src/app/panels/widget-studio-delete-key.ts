/**
 * Backspace・Delete で部品を消す（2026-09-24・本人「バックスペース・デリートで消したい」）。
 *
 * - 部品を選んでいて、文字を打っていないとき（画像・移行先・図形など文字を打たない部品を選んだとき）は、部品を消す
 *   （被せた移行先も一緒に消える＝「消す」ボタンと同じ）
 * - 文字の部品の中で打っている途中は、ふつうに文字を消す。選んでいる文字の部品が空なら、もう一度押すと部品ごと消す
 * - ⌘/Ctrl/Alt と一緒のとき（行ごと・単語ごとに消す）はブラウザに任せる。右の欄の入力欄では、ここは動かない
 * 並びの行（左）で押したときは template-form.ts が消す。上のツールバーの消しゴムは widget-visual-editor.ts
 */

/** 文字の部品の中に入力の印があるとき、その部品が選んでいる部品か・空か */
export interface CaretInfo {
  readonly isSelected: boolean
  readonly isEmpty: boolean
}

export type DeleteDecision = 'remove' | 'type' | 'ignore'

export function deleteKeyDecision(
  event: { readonly key: string; readonly metaKey: boolean; readonly ctrlKey: boolean; readonly altKey: boolean },
  state: { readonly hasSelected: boolean; readonly caret: CaretInfo | null },
): DeleteDecision {
  if (event.key !== 'Backspace' && event.key !== 'Delete') return 'ignore'
  if (event.metaKey || event.ctrlKey || event.altKey) return 'ignore'
  if (!state.hasSelected) return 'ignore'
  if (state.caret === null) return 'remove'
  // 文字を打っている途中（別の部品の文字の中でも）は文字を消す。選んでいる部品が空なら部品ごと
  return state.caret.isSelected && state.caret.isEmpty ? 'remove' : 'type'
}

export interface DeleteKeyDeps {
  readonly editorBody: HTMLElement
  readonly hasSelected: () => boolean
  readonly caret: () => CaretInfo | null
  readonly remove: () => void
}

/** 見たまま画面で Backspace・Delete を受け取る（文字の入力より先に） */
export function attachDeleteKey(deps: DeleteKeyDeps): void {
  deps.editorBody.addEventListener(
    'keydown',
    (event) => {
      const decision = deleteKeyDecision(event, { hasSelected: deps.hasSelected(), caret: deps.caret() })
      if (decision !== 'remove') return
      event.preventDefault()
      event.stopPropagation()
      deps.remove()
    },
    true,
  )
}
