/**
 * ストアのディスク永続化（任意）。
 *
 * `DATA_DIR` が設定されているとき（本番＝RailwayのVolume `/data` など）だけ有効。
 * 書き込みのたびに state を `${DATA_DIR}/state.json` へ保存し、起動時に読み戻す。
 * これで**再起動・再デプロイをまたいでユーザーが作ったLPが消えない**（「2回目でモックに戻る」を解消）。
 *
 * `DATA_DIR` が無いローカル／テストではノーオペ（従来どおりメモリのみ＝テストの前提を変えない）。
 * state は純粋なデータ（関数を含まない）なので JSON で完全にシリアライズできる。
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { State } from './types.ts'

const DATA_DIR = process.env['DATA_DIR']
const FILE = DATA_DIR === undefined || DATA_DIR === '' ? null : join(DATA_DIR, 'state.json')
const BAK = FILE === null ? null : `${FILE}.bak`

export function persistenceEnabled(): boolean {
  return FILE !== null
}

/** 保存済み state を読む（無ければ null）。本体が壊れていたら1世代前の .bak を試す。 */
export function loadPersistedState(): State | null {
  for (const path of [FILE, BAK]) {
    if (path === null || !existsSync(path)) continue
    try {
      return JSON.parse(readFileSync(path, 'utf8')) as State
    } catch {
      // 次の候補（.bak）へフォールバック
    }
  }
  return null
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
    // 上書きの前に、直前の内容を .bak へ退避（1世代の巻き戻し用の保険）。
    if (BAK !== null && existsSync(FILE)) {
      try {
        copyFileSync(FILE, BAK)
      } catch {
        // バックアップ失敗は本保存を止めない
      }
    }
    writeFileSync(FILE, JSON.stringify(state))
  } catch {
    // 保存はベストエフォート（失敗してもアプリは動く）
  }
}
