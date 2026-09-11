/**
 * State更新で共通に使う採番と時刻（actions.ts から分離）。
 */

/** 実APIは created_at/updated_at を数値（UNIXタイムスタンプ・秒）で返す（実測） */
export const nowTs = (): number => Math.floor(Date.now() / 1000)
/** 今ある件数＋1（Version名の決定論的な生成にだけ使う。uid には使わない＝削除のあとに重なるため） */
export function nextSeq(items: readonly unknown[]): number {
  return items.length + 1
}

/**
 * 新しく作る物の uid（2026-09-11 修正）。
 * 番号は増えるだけの通し番号（その物の id＝state.nextId から取ったもの）にする。
 * 以前は「今ある件数＋1」だったので、削除のあとに作ると既存と同じ uid が付き、
 * 本番で別々のLPの Version が2件とも VERSION_0005 になっていた（uid 検索は先頭一致なので、別のLPを書き換えうる）。
 * 削除した物の uid も二度と使わない（古いプレビューURL・中間ページリンクが別の物を指さないように）。
 * 念のため、既存の uid と重なるときは次の番号にする。
 */
export function freshUid(
  items: readonly { uid: string }[],
  seq: number,
  toUid: (n: number) => string,
): string {
  const taken = new Set(items.map((item) => item.uid))
  let n = seq
  while (taken.has(toUid(n))) n += 1
  return toUid(n)
}
