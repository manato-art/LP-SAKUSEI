/**
 * セッション内メモリストア（企画書 §10-9）。
 *
 * - 既定は空シード（§10-5）。
 * - 書き込みは必ず「新しい State を返す」イミュータブル更新（§12 コーディング規約）。
 * - reset で新規アカウント発行直後へ戻す（再起動 or `?reset=1`）。
 */
import { createEmptyState } from './seed-empty.ts'
import { createDemoState } from './seed-demo.ts'
import type { State } from './types.ts'

/**
 * 既定は空シード（テスト・検証の前提を変えない）。
 * `SEED_DEMO=1` のときだけ、公開デモ用に架空のフォルダ／ABテスト／Versionを1件用意する
 * （エディタ等の各画面を「到達できる」状態にするため・seed-demo.ts）。
 */
function initialState(): State {
  return process.env['SEED_DEMO'] === '1' ? createDemoState() : createEmptyState()
}

let current: State = initialState()
let revision = 0

export function getState(): State {
  return current
}

/** 現在のリビジョン（テスト・デバッグ用。書き込みごとに増える） */
export function getRevision(): number {
  return revision
}

/**
 * 更新関数から新しい State を作って差し替える。
 * updater は既存 State を破壊してはならない（常に新しいオブジェクト/配列を返す）。
 */
export function setState(updater: (state: State) => State): State {
  const next = updater(current)
  if (next === current) return current
  current = next
  revision += 1
  return current
}

/** 新規アカウント発行直後へ戻す（§10-9 リセット）。SEED_DEMO のときはデモへ戻す。 */
export function resetState(): State {
  current = initialState()
  revision += 1
  return current
}
