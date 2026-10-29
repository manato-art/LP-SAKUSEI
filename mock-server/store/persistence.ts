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
 * ## 保存に失敗したら黙らない（2026-10-29 本人「保存に失敗したらすぐ知らせる」）
 * 以前は失敗を握りつぶしていた。データが大きくなると保存そのものができなくなり（手元の測定では
 * 10商材・3か月ぶんで JSON にできなかった）、気づかないまま次に立ち上がり直すと、最後に保存できたときより後が消える。
 *   - 失敗したらログに出し、知らせの合図（onPersistEvent）を出し、新しい書き込みが無くても少しあとで試し直す
 *   - 別名（state.json.tmp）に書いてから置き換える＝書きかけで止まっても、前に保存できたファイルが壊れない
 *   - サーバーを止める前に flushPersistNow で待たずに書く（index.ts の SIGTERM）
 *   - 大きくなってきた（重くなってきた）ことも合図する（isHeavySave）
 *   合図を受けて外へ知らせるのは persist-alert.ts、管理画面の赤い帯は routes/system-status.ts → save-status-banner.ts。
 *
 * `DATA_DIR` が無いローカル／テストではノーオペ（従来どおりメモリのみ＝テストの前提を変えない）。
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createEmptyState } from './seed-empty.ts'
import type { MeasureDb } from './measure-db.ts'
import { withoutMeasurements } from './measure-rows.ts'
import { createMeasureSync, type MeasureSync, type MeasureSyncResult } from './measure-sync.ts'
import { completeTasks } from './task-shape.ts'
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
 * 中まで見て埋める「設定のかたまり」。
 *
 * 最上位のキーしか見ないと、既にある `integrations` は丸ごとそのまま残り、
 * あとから足したキーだけが `undefined` になる。読み出し側が「空文字なら未設定」で
 * 見ていると、`undefined` はそれに当たらず**入っていることにされる**（本番でそうなった）。
 *
 * ここに書けるのは、決まった名前の値だけを持つ設定のかたまりに限る。
 * 配列や、利用者が作った物の入れ物を混ぜてはいけない（既定値で上書きしてしまう）。
 */
const NESTED_SETTINGS_KEYS: readonly string[] = ['integrations', 'alertSetting']

/**
 * 永続化データにスキーマ進化で追加されたフィールドが欠けている場合、
 * 空シードのデフォルト値で補完する（マイグレーション）。
 * これにより古い state.json でも新しいコードで安全に読める。
 */
function migrateState(raw: Record<string, unknown>): State {
  const defaults = createEmptyState() as unknown as Record<string, unknown>
  const migrated = { ...defaults }
  for (const key of Object.keys(defaults)) {
    const saved = key in raw ? raw[key] : defaults[key]
    if (NESTED_SETTINGS_KEYS.includes(key)) {
      // 保存されている値を優先しつつ、足りないキーだけ既定値で埋める
      migrated[key] = {
        ...(defaults[key] as Record<string, unknown>),
        ...((saved ?? {}) as Record<string, unknown>),
      }
      continue
    }
    migrated[key] = saved
  }
  const state = migrated as unknown as State
  // 1件ずつの中身も見るもの: スケジュールなどを足す前に保存したタスク（task-shape.ts）
  return { ...state, tasks: completeTasks(state.tasks) }
}

/**
 * 保存済み state を読む。本体が壊れていたら**最新アーカイブ**へ順にフォールバックする。
 * 読み込み後にマイグレーションを適用し、欠けているフィールドをデフォルト値で補完する。
 */
export function loadPersistedState(): State | null {
  const candidates = [FILE, ...archivesNewestFirst()].filter((p): p is string => p !== null)
  for (const path of candidates) {
    if (!existsSync(path)) continue
    try {
      const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
      // 立ち上がり直したあとも「最後に保存できた時刻」が分かるように、読み戻したファイルを書いた時刻を持つ
      health = { ...health, lastOkAt: statSync(path).mtimeMs }
      return migrateState(raw)
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
    writeFileSync(join(ARCHIVE_DIR, `state-${stamp}.json`), JSON.stringify(fileContentOf(state)))
    rotateArchives()
  } catch (error) {
    // アーカイブはベストエフォート（失敗しても本保存・アプリは止めない）。ただし黙らない
    console.error('[store] 退避（アーカイブ）を書けませんでした:', (error as Error).message)
  }
}

/**
 * 今の state.json の写しを残す（数字をデータベースへ移す直前など・2026-10-29）。残した場所を返す（無ければ null）
 */
export function backupStateFile(label: string): string | null {
  if (FILE === null || DATA_DIR === undefined || !existsSync(FILE)) return null
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const to = join(DATA_DIR, `state-${label}-${stamp}.json`)
  copyFileSync(FILE, to)
  console.log(`[store] state.json の写しを残しました: ${to}`)
  return to
}

/**
 * リセット等の破壊操作の直前に、**現在の内容を強制アーカイブ**する（消える前の砦）。
 * store 側の resetState から呼ぶ。
 */
export function archiveBeforeDestruction(state: State): void {
  archiveState(state, true)
}

let timer: ReturnType<typeof setTimeout> | null = null
/** いまの timer が「失敗したあとの試し直し」の待ちか（新しい書き込みが来たら、いつもの間隔で書き直す） */
let retrying = false
let pending: State | null = null

/** 保存の様子（知らせと管理画面の赤い帯に使う） */
export interface PersistHealth {
  /** 最後に保存できた時刻（UNIXミリ秒）。起動してからまだ一度も保存できていなければ null */
  lastOkAt: number | null
  /** 続けて失敗している回数（0＝問題なし） */
  failures: number
  /** 最後に失敗した理由（ログ・管理画面用） */
  lastError: string
  /** 最後に保存できたファイルの大きさ（バイト）と、保存1回にかかった時間（ミリ秒） */
  bytes: number
  durationMs: number
}

/** 保存の合図。failed＝失敗した／recovered＝失敗のあと保存できた／heavy＝大きくなってきた */
export type PersistEvent =
  | { kind: 'failed'; health: PersistHealth }
  | { kind: 'recovered'; health: PersistHealth }
  | { kind: 'heavy'; health: PersistHealth }

/**
 * 「重くなってきた」の目安。今の本番は約3.5MB・保存1回20ミリ秒。
 * 手元の測定では114MBで保存1回に約0.7秒（その間はLPの表示も計測も待たされる）、さらに大きいと保存できなかった。
 */
export const HEAVY_BYTES = 50 * 1024 * 1024
export const HEAVY_MS = 500
/** 失敗したあと、新しい書き込みが来なくても試し直すまでの間 */
export const PERSIST_RETRY_MS = 30_000

let health: PersistHealth = { lastOkAt: null, failures: 0, lastError: '', bytes: 0, durationMs: 0 }
const listeners: Array<(event: PersistEvent) => void> = []

/**
 * 数字の記録をしまうデータベース（2026-10-29・measure-startup.ts が起動時に付ける）。付いていなければ今までどおり state.json だけ。
 *   json … 試しの期間。state.json が正（全部を書く）で、データベースへも変わった分を写す。データベースの失敗はログだけ
 *   db   … 数字はデータベースが正。state.json には数字を書かない。データベースの失敗は赤い帯・知らせになる
 */
export type MeasureSource = 'json' | 'db'
let measure: { sync: MeasureSync; source: MeasureSource } | null = null
/** 数字をデータベースが正にしたのに、起動時につながらなかった（数字は state.json へ書いて守る） */
let measureDbUnavailable = false

interface DbHealth {
  lastOkAt: number | null
  failures: number
  lastError: string
}
let dbHealth: DbHealth = { lastOkAt: null, failures: 0, lastError: '' }

/** 数字がデータベースにあり、その書き込みの成否が「保存できているか」に入るか */
function dbCounts(): boolean {
  return measure?.source === 'db' || measureDbUnavailable
}

export function persistHealth(): PersistHealth {
  if (!dbCounts()) return health
  const lastOkAt = health.lastOkAt === null || dbHealth.lastOkAt === null ? null : Math.min(health.lastOkAt, dbHealth.lastOkAt)
  return {
    ...health,
    lastOkAt,
    failures: health.failures + dbHealth.failures,
    lastError: dbHealth.failures > 0 ? `データベース: ${dbHealth.lastError}` : health.lastError,
  }
}

/** 管理画面・確かめ用: データベースの様子 */
export function measureDbStatus(): { attached: boolean; source: MeasureSource | null; unavailable: boolean } & DbHealth {
  return { attached: measure !== null, source: measure?.source ?? null, unavailable: measureDbUnavailable, ...dbHealth }
}

function onMeasureSyncResult(result: MeasureSyncResult): void {
  if (result.ok) {
    const wasFailing = dbHealth.failures > 0
    dbHealth = { lastOkAt: Date.now(), failures: 0, lastError: '' }
    if (!wasFailing) return
    console.log('[db] データベースへの書き込みが元に戻りました')
    if (dbCounts() && persistHealth().failures === 0) emit({ kind: 'recovered', health: persistHealth() })
    return
  }
  dbHealth = { ...dbHealth, failures: dbHealth.failures + 1, lastError: result.error }
  console.error(`[db] データベースへ書けませんでした（${String(dbHealth.failures)}回続けて）:`, result.error)
  if (dbCounts()) emit({ kind: 'failed', health: persistHealth() })
}

/** 数字の記録をデータベースへも書くようにする（measure-startup.ts） */
export function attachMeasureDb(db: MeasureDb, source: MeasureSource): void {
  measure = { sync: createMeasureSync(db, onMeasureSyncResult, PERSIST_RETRY_MS), source }
  measureDbUnavailable = false
}

/** この state まではデータベースに入っている（読み戻した直後・写した直後） */
export function markMeasurementsSynced(state: State): void {
  measure?.sync.markSynced(state)
}

/**
 * 数字をデータベースが正にしたのに、起動時につながらなかった。
 * 数字は state.json へも書いて守り（データベースに付けない）、赤い帯で知らせる。
 */
export function markMeasureDbUnavailable(error: string): void {
  measure = null
  measureDbUnavailable = true
  dbHealth = { ...dbHealth, failures: dbHealth.failures + 1, lastError: `つながりません（${error}）` }
  console.error('[db] 数字のデータベースにつながりません。数字は state.json へ書いて守ります:', error)
  emit({ kind: 'failed', health: persistHealth() })
}

/** state.json（と退避）に書く中身。数字をデータベースが正にしたら、数字は抜く */
function fileContentOf(state: State): Partial<State> {
  return measure?.source === 'db' ? withoutMeasurements(state) : state
}

export function isHeavySave(save: Pick<PersistHealth, 'bytes' | 'durationMs'>): boolean {
  return save.bytes >= HEAVY_BYTES || save.durationMs >= HEAVY_MS
}

/** 保存の合図を受け取る（外へ知らせる persist-alert.ts が使う）。外すための関数を返す */
export function onPersistEvent(listener: (event: PersistEvent) => void): () => void {
  listeners.push(listener)
  return () => {
    const at = listeners.indexOf(listener)
    if (at !== -1) listeners.splice(at, 1)
  }
}

function emit(event: PersistEvent): void {
  for (const listener of listeners) {
    try {
      listener(event)
    } catch (error) {
      // 知らせる側の失敗で保存を止めない。ただし黙らない
      console.error('[store] 保存の知らせを処理できませんでした:', (error as Error).message)
    }
  }
}

/** state をデバウンス保存（連続書き込みで毎回ディスクを叩かない）。 */
export function schedulePersist(state: State): void {
  if (FILE === null) return
  pending = state
  if (timer !== null && !retrying) return
  if (timer !== null) clearTimeout(timer)
  retrying = false
  timer = setTimeout(flush, 400)
}

/**
 * 保存待ちの内容を待たずに書く（サーバーを止める前・index.ts の SIGTERM）。
 * state.json はその場で書き、データベースへの書き込みは終わるまで待つ（返す Promise）
 */
export function flushPersistNow(): Promise<void> {
  if (timer !== null) clearTimeout(timer)
  flush()
  return measure?.sync.drain() ?? Promise.resolve()
}

function flush(): void {
  timer = null
  retrying = false
  const state = pending
  pending = null
  if (state === null || FILE === null) return
  // 数字の記録は、変わった分だけデータベースへ（state.json が書けなくても、こちらは書く）
  measure?.sync.request(state)
  const started = Date.now()
  try {
    if (DATA_DIR !== undefined && DATA_DIR !== '' && !existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true })
    }
    // 通常保存は state.json を書くだけ（毎回のフルコピーはしない＝軽い）。
    // 書きかけで止まっても前のファイルが壊れないよう、別名に書いてから置き換える
    const tmp = `${FILE}.tmp`
    writeFileSync(tmp, JSON.stringify(fileContentOf(state)))
    renameSync(tmp, FILE)
    const wasFailing = health.failures > 0
    health = { lastOkAt: Date.now(), failures: 0, lastError: '', bytes: statSync(FILE).size, durationMs: Date.now() - started }
    if (wasFailing) {
      console.log('[store] 保存が元に戻りました')
      emit({ kind: 'recovered', health })
    }
    if (isHeavySave(health)) emit({ kind: 'heavy', health })
    // アーカイブはスロットルで間引く（毎回は残さない）。
    archiveState(state, false)
  } catch (error) {
    health = { ...health, failures: health.failures + 1, lastError: (error as Error).message }
    console.error(`[store] 保存に失敗しました（${String(health.failures)}回続けて）:`, health.lastError)
    emit({ kind: 'failed', health })
    // 新しい書き込みが来なくても試し直す（来れば、そちらの新しい内容で先に試す）
    if (pending === null) pending = state
    if (timer === null) {
      retrying = true
      timer = setTimeout(flush, PERSIST_RETRY_MS)
      // 試し直しの待ちだけで、終わろうとしているプロセスを引き止めない
      timer.unref?.()
    }
  }
}
