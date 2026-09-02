/**
 * セッション内メモリストア（企画書 §10-9）。
 *
 * - 既定は空シード（§10-5）。
 * - 書き込みは必ず「新しい State を返す」イミュータブル更新（§12 コーディング規約）。
 * - reset で新規アカウント発行直後へ戻す（再起動 or `?reset=1`）。
 */
import { createEmptyState } from './seed-empty.ts'
import { createDemoState } from './seed-demo.ts'
import { loadPersistedState, persistenceEnabled, schedulePersist } from './persistence.ts'
import type { State } from './types.ts'

/** シード（保存済みが無いときの初期状態）。SEED_DEMO=1 なら架空デモ1式、なければ空。 */
function seedState(): State {
  return process.env['SEED_DEMO'] === '1' ? createDemoState() : createEmptyState()
}

/**
 * 初期状態。DATA_DIR に保存済み state があればそれを読み戻す（ユーザーが作ったLPを保持）。
 * 無ければシード（テスト・検証の前提は変えない＝DATA_DIR未設定では常にシード）。
 */
function initialState(): State {
  const persisted = loadPersistedState()
  if (persisted !== null) {
    console.log(`[store] 永続化データから復元しました（abTests: ${persisted.abTests.length}件、folders: ${persisted.folders.length}件）`)
    return persisted
  }
  const seed = seedState()
  console.log(`[store] シードから初期化（${persistenceEnabled() ? '永続化ファイル未検出' : 'DATA_DIR未設定'}、abTests: ${seed.abTests.length}件）`)
  return seed
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
  schedulePersist(current) // DATA_DIR があればディスクへ保存（無ければノーオペ）
  return current
}

/** 新規アカウント発行直後へ戻す（§10-9 リセット）。SEED_DEMO のときはデモへ戻す。 */
export function resetState(): State {
  current = seedState()
  revision += 1
  schedulePersist(current) // 保存済みもシードで上書き
  return current
}
