/**
 * Widget編集の「元に戻す・やり直す」（2026-09-24・点検で見つけた「部品の操作が戻せない」）。
 *
 * Widget の中身（設定データ）の変わり目を順に覚える。部品を足す・消す・動かす・右の欄で変える・文字を打つ、のどれも。
 * 中身は作り直すたびに新しいものになる（書き換えない）ので、そのまま覚えてよい。
 * すぐ続いた変わり目（打っている途中）は1回ぶんにまとめる。戻したあとに変えたら、やり直しの先は捨てる。
 * ⌘Z・Ctrl+Z で戻す、⌘⇧Z・Ctrl+Y でやり直す（右の欄の入力欄の中ではブラウザの戻すに任せる）。
 */

export interface History<T> {
  /** 変わり目を覚える（now はまとめるかを決める時刻 ms） */
  readonly record: (value: T, now?: number) => void
  readonly undo: () => T | null
  readonly redo: () => T | null
  readonly canUndo: () => boolean
  readonly canRedo: () => boolean
}

export function createHistory<T>(initial: T, options: { readonly mergeMs: number; readonly limit: number }): History<T> {
  let stack: T[] = [initial]
  let index = 0
  /** 前に覚えた時刻（戻した・やり直した直後は 0＝まとめない） */
  let lastAt = 0
  return {
    record: (value, now = Date.now()) => {
      if (value === stack[index]) return
      const merge = lastAt !== 0 && index > 0 && now - lastAt < options.mergeMs
      stack = [...stack.slice(0, merge ? index : index + 1), value]
      if (stack.length > options.limit) stack = stack.slice(stack.length - options.limit)
      index = stack.length - 1
      lastAt = now
    },
    undo: () => {
      if (index === 0) return null
      index -= 1
      lastAt = 0
      return stack[index] ?? null
    },
    redo: () => {
      if (index >= stack.length - 1) return null
      index += 1
      lastAt = 0
      return stack[index] ?? null
    },
    canUndo: () => index > 0,
    canRedo: () => index < stack.length - 1,
  }
}

/** ⌘Z・Ctrl+Z／⌘⇧Z・Ctrl+Y を受け取る（入力欄の中はブラウザに任せる）。受け持ったら既定の動きを止める */
export function attachUndoKeys(roots: readonly HTMLElement[], actions: { readonly undo: () => boolean; readonly redo: () => boolean }): void {
  for (const root of roots) {
    root.addEventListener(
      'keydown',
      (event) => {
        if (!(event.metaKey || event.ctrlKey) || event.altKey) return
        const target = event.target
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
        const key = event.key.toLowerCase()
        const isRedo = (key === 'z' && event.shiftKey) || (key === 'y' && event.ctrlKey && !event.metaKey)
        const isUndo = key === 'z' && !event.shiftKey
        if (!isUndo && !isRedo) return
        if (isUndo ? actions.undo() : actions.redo()) {
          event.preventDefault()
          event.stopPropagation()
        }
      },
      true,
    )
  }
}
