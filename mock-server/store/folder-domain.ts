/**
 * フォルダが持つ配信ドメイン（2026-09-13・実物に合わせる）。
 *
 * 実物（公式FAQ）では配信URLは `https://<フォルダのドメイン>/ab/<ID>` で、フォルダごとにドメインを選ぶ。
 * ドメインが無いフォルダは配信URLが表示されず、「フォルダの設定＞ドメイン変更から設定してください」と案内される。
 *
 * 保存する値:
 *   ''        … 未設定（配信URLを出さない）
 *   'system'  … このシステムのドメイン（配信に使ってきたホスト。環境で変わるのでホスト名では持たない）
 *   それ以外   … 登録した独自ドメインのホスト名（例 sb.example.test）
 */
import type { Folder, State } from './types.ts'

/** このシステムのドメインを指す印（実際のホスト名は画面側が今開いているURLから入れる） */
export const SYSTEM_FOLDER_DOMAIN = 'system'

/** ホスト名の形（英数とハイフンのラベルを . でつないだもの） */
const HOST = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/

/** ホスト名として使える形か（英数とハイフンのラベルが . で2つ以上つながっていること） */
export function isHostName(value: string): boolean {
  return value.length <= 253 && HOST.test(value)
}

/** 受け取った値をドメインとして整える（受け付けられない形なら null） */
export function normalizeFolderDomain(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim().toLowerCase()
  if (value === '' || value === SYSTEM_FOLDER_DOMAIN) return value
  return isHostName(value) ? value : null
}

/**
 * ドメインの項目が無い古い保存データを、このシステムのドメインとして読む。
 * （この項目を足す前に作られたフォルダは、ずっとこのシステムのホストで配信URLを出していたため）
 */
export function migrateFolderDomains(state: State): { state: State; changed: number } {
  const legacy = state.folders.filter((f) => f.domain === undefined).length
  if (legacy === 0) return { state, changed: 0 }
  const folders: readonly Folder[] = state.folders.map((f) =>
    f.domain === undefined ? { ...f, domain: SYSTEM_FOLDER_DOMAIN } : f,
  )
  return { state: { ...state, folders }, changed: legacy }
}
