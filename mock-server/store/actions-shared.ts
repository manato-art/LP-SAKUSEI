/**
 * State更新で共通に使う採番と時刻（actions.ts から分離）。
 */

/** 実APIは created_at/updated_at を数値（UNIXタイムスタンプ・秒）で返す（実測） */
export const nowTs = (): number => Math.floor(Date.now() / 1000)
/** そのコレクションの通し番号（uidの連番に使う） */
export function nextSeq(items: readonly unknown[]): number {
  return items.length + 1
}
