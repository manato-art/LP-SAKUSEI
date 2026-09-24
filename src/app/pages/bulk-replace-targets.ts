/**
 * マジック置換: 一覧でチェックした行 → サーバーへ送る「置換の指定」を組み立てる（純粋関数）。
 *
 * 以前は `${version_uid} ${value}` という文字列を鍵にして、あとで空白で割り直していた。
 * 検索語に半角スペースがある（例「赤い 花」）と語が「赤い」に切れ、
 * 選んでいない場所が置き換わっていた。鍵は JSON の配列にし、割り直しはしない。
 */
import type { BulkReplacePage, BulkReplaceRow } from '../api.ts'

export type ReplaceKind = 'image' | 'text' | 'link'

export interface ReplaceTarget {
  version_uid: string
  value: string
  /** テキストのみ: そのVersionの何番目の一致を置き換えるか */
  indexes?: number[]
}

/** 一覧の1行を指す鍵（ページ × Version × 値 × テキストの何番目か）。値に空白があっても取り違えない */
export function rowKey(page: BulkReplacePage, row: BulkReplaceRow): string {
  return JSON.stringify([page.ab_test_uid, row.version_uid, row.value, row.text_index ?? null])
}

/**
 * チェックした行を置換の指定にまとめる。
 * テキストは同じVersion・同じ語を1件にまとめ、何番目かを `indexes` に並べる。
 */
export function collectReplaceTargets(
  results: readonly BulkReplacePage[],
  checked: ReadonlySet<string>,
  kind: ReplaceKind,
): ReplaceTarget[] {
  const plain: ReplaceTarget[] = []
  const grouped = new Map<string, { version_uid: string; value: string; indexes: number[] }>()
  for (const page of results) {
    for (const row of page.rows) {
      if (!checked.has(rowKey(page, row))) continue
      if (kind === 'text' && row.text_index !== undefined) {
        const key = JSON.stringify([row.version_uid, row.value])
        const prev = grouped.get(key)
        grouped.set(key, {
          version_uid: row.version_uid,
          value: row.value,
          indexes: [...(prev?.indexes ?? []), row.text_index],
        })
      } else {
        plain.push({ version_uid: row.version_uid, value: row.value })
      }
    }
  }
  return [...plain, ...grouped.values()]
}
