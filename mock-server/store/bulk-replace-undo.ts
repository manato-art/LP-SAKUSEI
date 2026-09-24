/**
 * マジック置換の「元に戻す」のための控え（メモリだけに持つ）。
 *
 * 置換した直後に結果画面から戻すための物なので、直近の数件だけを覚える。
 * サーバーが再起動したら消える（そのときは各ページの「変更・復元履歴」から戻す）。
 * 1回戻したら控えは捨てる（同じ置換を2回戻さない）。
 */
import { randomUUID } from 'node:crypto'

export interface UndoEntry {
  version_uid: string
  /** 置換する前の本文 */
  before: string
  /** 置換した直後の本文（これと今が同じときだけ戻す） */
  after: string
}

/** 覚えておく置換の数 */
const MAX_UNDO = 20

let undoBook: ReadonlyMap<string, readonly UndoEntry[]> = new Map()

/** 置換1回ぶんを覚えて、戻すときの番号を返す */
export function rememberUndo(entries: readonly UndoEntry[]): string {
  const id = randomUUID()
  const kept = [...undoBook.entries(), [id, [...entries]] as const].slice(-MAX_UNDO)
  undoBook = new Map(kept)
  return id
}

/** 控えを取り出して捨てる。無ければ null */
export function consumeUndo(id: string): readonly UndoEntry[] | null {
  const entries = undoBook.get(id)
  if (entries === undefined) return null
  undoBook = new Map([...undoBook.entries()].filter(([key]) => key !== id))
  return entries
}
