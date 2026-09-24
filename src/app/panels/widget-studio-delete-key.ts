/**
 * 見たまま画面の「部品を選ぶ」と「文字を打つ」の分け方と、Backspace・Delete で部品を消す
 * （2026-09-24・本人「バックスペース・デリートで消したい」→「消えない」→ 本人の選択「Canva式（1回＝選ぶ）」）。
 *
 * - 1回押す: 部品を選ぶだけ（文字の入力の印を外す）。この状態で Backspace・Delete を押すと部品を消す
 *   （被せた移行先も一緒に消える＝「消す」ボタンと同じ）
 * - ダブルクリック: その部品の文字を、押した所から打てる。Esc で打つのをやめて、選んだ状態に戻る
 * - Enter: 選んでいる文字の部品の文字を、末尾から打ち始める
 * - 打っている途中の Backspace・Delete は文字を消す。空になった部品でもう一度押すと部品ごと消す
 * - ⌘/Ctrl/Alt と一緒のとき（行ごと・単語ごとに消す）はブラウザに任せる。右の欄の入力欄では、ここは動かない
 * 並びの行（左）で押したときは template-form.ts、上のツールバーの消しゴムは widget-visual-editor.ts が消す
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

/** 見たまま画面の部品（押した所・入力の印の所から探す） */
export interface CanvasPart {
  readonly el: HTMLElement
  /** 見たまま画面で文字を打てる部品か */
  readonly editable: boolean
  readonly isSelected: boolean
  /** この部品を選ぶ */
  readonly select: () => void
}

export interface PartKeysDeps {
  readonly editorBody: HTMLElement
  readonly contentDiv: HTMLElement
  readonly partOf: (node: EventTarget | Node | null) => CanvasPart | null
  /** 選んでいる部品（無ければ null） */
  readonly selectedPart: () => CanvasPart | null
  readonly remove: () => void
}

export interface PartKeys {
  /** 見たまま画面を1回押したとき（部品を選ぶ前に呼ぶ）。打っている途中の部品の中なら、そのまま打てる */
  readonly onClick: (el: HTMLElement | null) => void
}

/** 部品の文字の入れ物（ボタンの文字・図形の中の文字など。無ければ部品そのもの） */
function textHolderOf(el: HTMLElement): HTMLElement {
  const holders = el.querySelectorAll<HTMLElement>('.nc-b-button__label,.nc-b-shape__text,.nc-b-list__text,.nc-b-imageText__text')
  return holders[holders.length - 1] ?? el
}

function endOf(el: HTMLElement): Range {
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  return range
}

/** 画面の点にある文字の位置（ブラウザごとに名前が違う） */
function caretAt(x: number, y: number): Range | null {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
  }
  if (typeof doc.caretRangeFromPoint === 'function') return doc.caretRangeFromPoint(x, y)
  if (typeof doc.caretPositionFromPoint === 'function') {
    const pos = doc.caretPositionFromPoint(x, y)
    if (pos === null) return null
    const range = document.createRange()
    range.setStart(pos.offsetNode, pos.offset)
    range.collapse(true)
    return range
  }
  return null
}

export function attachPartKeys(deps: PartKeysDeps): PartKeys {
  /** 文字を打っている部品（null＝部品を選ぶだけの状態） */
  let editing: HTMLElement | null = null
  const clear = (): void => document.getSelection()?.removeAllRanges()
  const startTyping = (el: HTMLElement, range: Range): void => {
    editing = el
    deps.contentDiv.focus({ preventScroll: true })
    const sel = document.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  }

  /** 入力の印がある文字の部品 */
  const caret = (): CaretInfo | null => {
    const sel = document.getSelection()
    if (sel === null || sel.rangeCount === 0 || sel.anchorNode === null || !deps.contentDiv.contains(sel.anchorNode)) return null
    const part = deps.partOf(sel.anchorNode)
    if (part === null || !part.editable) return null
    return { isSelected: part.isSelected, isEmpty: (part.el.textContent ?? '').trim() === '' }
  }

  deps.contentDiv.addEventListener('dblclick', (event) => {
    const part = deps.partOf(event.target)
    if (part === null || !part.editable) return
    if (!part.isSelected) part.select()
    const range = caretAt(event.clientX, event.clientY)
    startTyping(part.el, range !== null && part.el.contains(range.startContainer) ? range : endOf(textHolderOf(part.el)))
  })

  deps.editorBody.addEventListener(
    'keydown',
    (event) => {
      const plain = !event.metaKey && !event.ctrlKey && !event.altKey
      if (event.key === 'Escape' && editing !== null) {
        event.preventDefault()
        editing = null
        clear()
        return
      }
      if (event.key === 'Enter' && plain && caret() === null) {
        const part = deps.selectedPart()
        if (part === null || !part.editable) return
        event.preventDefault()
        startTyping(part.el, endOf(textHolderOf(part.el)))
        return
      }
      const decision = deleteKeyDecision(event, { hasSelected: deps.selectedPart() !== null, caret: caret() })
      if (decision !== 'remove') return
      event.preventDefault()
      event.stopPropagation()
      editing = null
      deps.remove()
    },
    true,
  )

  return {
    onClick: (el) => {
      if (el !== null && el === editing) return
      editing = null
      clear()
    },
  }
}
