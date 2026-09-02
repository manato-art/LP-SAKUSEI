/**
 * ストアのディスク永続化（任意）。
 *
 * `DATA_DIR` が設定されているとき（本番＝RailwayのVolume `/data` など）だけ有効。
 * 書き込みのたびに state を `${DATA_DIR}/state.json` へ保存し、起動時に読み戻す。
 * これで**再起動・再デプロイをまたいでユーザーが作ったLPが消えない**。
 *
 * ## アーカイブ（作業中データを消える前に守る保険・2026-09-03）
 * 破壊的操作（リセット等）で作業中の記事を失った事故を受けて、世代アーカイブを持つ。
 * ただし**毎回の保存でアーカイブしない**（重くなるため）:
 *   - 通常保存は `state.json` を書くだけ（以前の「毎回.bakへ全体コピー」は廃止＝重さの元だった）。
 *   - アーカイブは **最短間隔スロットル**（既定30分に1回まで）＋**世代数上限**（既定6個）で
 *     `${DATA_DIR}/archives/state-<ISO>.json` に残し、古いものから自動削除（溜め続けない）。
 *   - **リセット等の破壊操作の直前だけは強制で1回アーカイブ**（`archiveBeforeDestruction`）。
 * 復元は `state.json` が壊れていたら最新アーカイブへフォールバックする。
 *
 * `DATA_DIR` が無いローカル／テストではノーオペ（従来どおりメモリのみ＝テストの前提を変えない）。
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { State } from './types.ts'

const DATA_DIR = process.env['DATA_DIR']
const FILE = DATA_DIR === undefined || DATA_DIR === '' ? null : join(DATA_DIR, 'state.json')
const ARCHIVE_DIR = DATA_DIR === undefined || DATA_DIR === '' ? null : join(DATA_DIR, 'archives')

/** 残す世代数の上限（超えたら古いものから削除）。 */
const MAX_ARCHIVES = 6
/** アーカイブの最短間隔（これ未満の連続保存ではアーカイブしない＝重くしない）。 */
const ARCHIVE_MIN_INTERVAL_MS = 30 * 60 * 1000
let lastArchiveAt = 0

export function persistenceEnabled(): boolean {
  return FILE !== null
}

/** アーカイブ一覧を新しい順（ファイル名がISO時刻なので辞書順の降順＝新しい順）で返す。 */
function archivesNewestFirst(): string[] {
  if (ARCHIVE_DIR === null || !existsSync(ARCHIVE_DIR)) return []
  return readdirSync(ARCHIVE_DIR)
    .filter((f) => f.startsWith('state-') && f.endsWith('.json'))
    .sort()
    .reverse()
    .map((f) => join(ARCHIVE_DIR, f))
}

/**
 * 保存済み state を読む。本体が壊れていたら**最新アーカイブ**へ順にフォールバックする。
 */
export function loadPersistedState(): State | null {
  const candidates = [FILE, ...archivesNewestFirst()].filter((p): p is string => p !== null)
  for (const path of candidates) {
    if (!existsSync(path)) continue
    try {
      return JSON.parse(readFileSync(path, 'utf8')) as State
    } catch {
      // 次の候補（アーカイブ）へ
    }
  }
  return null
}

/** 上限を超えたアーカイブを古い方から削除する。 */
function rotateArchives(): void {
  for (const old of archivesNewestFirst().slice(MAX_ARCHIVES)) {
    try {
      rmSync(old)
    } catch {
      // 削除失敗は無視（次回また試す）
    }
  }
}

/**
 * state をアーカイブする。`force` でなければ最短間隔スロットルで間引く（毎回は残さない）。
 */
function archiveState(state: State, force: boolean): void {
  if (ARCHIVE_DIR === null) return
  const now = Date.now()
  if (!force && now - lastArchiveAt < ARCHIVE_MIN_INTERVAL_MS) return
  lastArchiveAt = now
  try {
    mkdirSync(ARCHIVE_DIR, { recursive: true })
    const stamp = new Date(now).toISOString().replace(/[:.]/g, '-')
    writeFileSync(join(ARCHIVE_DIR, `state-${stamp}.json`), JSON.stringify(state))
    rotateArchives()
  } catch {
    // アーカイブはベストエフォート（失敗しても本保存・アプリは止めない）
  }
}

/**
 * リセット等の破壊操作の直前に、**現在の内容を強制アーカイブ**する（消える前の砦）。
 * store 側の resetState から呼ぶ。
 */
export function archiveBeforeDestruction(state: State): void {
  archiveState(state, true)
}

let timer: ReturnType<typeof setTimeout> | null = null
let pending: State | null = null

/** state をデバウンス保存（連続書き込みで毎回ディスクを叩かない）。 */
export function schedulePersist(state: State): void {
  if (FILE === null) return
  pending = state
  if (timer !== null) return
  timer = setTimeout(flush, 400)
}

function flush(): void {
  timer = null
  const state = pending
  pending = null
  if (state === null || FILE === null) return
  try {
    if (DATA_DIR !== undefined && DATA_DIR !== '' && !existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true })
    }
    // 通常保存は state.json を書くだけ（毎回のフルコピーはしない＝軽い）。
    writeFileSync(FILE, JSON.stringify(state))
    // アーカイブはスロットルで間引く（毎回は残さない）。
    archiveState(state, false)
  } catch {
    // 保存はベストエフォート（失敗してもアプリは動く）
  }
}
