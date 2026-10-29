/**
 * 起動時に、数字の記録のデータベースを使い始める（2026-10-29 本人「OK進めて」・index.ts から1回呼ぶ）。
 *
 *   試しの期間（MEASURE_SOURCE が db でない）: state.json が正。今の記録をデータベースへ写し、以後は両方に書く
 *     （データベースと state.json が合うのを確かめてから切り替える）
 *   切り替え（MEASURE_SOURCE=db・はじめて）: state.json の写しを残してから、記録をデータベースへ写す。以後 state.json には数字を書かない
 *   切り替えたあと: データベースから読み戻す。一度データベースを正にしたら、MEASURE_SOURCE を戻しても自動では戻らない
 *     （state.json には数字が無いので、戻すとデータベースの数字を消してしまう）
 *   つながらないとき: 試しの期間なら何もしない（state.json が正なので数字は守られる）。
 *     切り替えるつもりだったら、数字は state.json へ書いて守り、赤い帯で知らせる（つながったら立ち上げ直す）
 *
 * サーバーが受け付けを始める前（index.ts の listen より前）に呼ぶ。読み戻すあいだに数字が増えないように。
 */
import { copyStateToDb } from './measure-sync.ts'
import { ensureMeasureSchema, loadMeasurements, readMeasureMeta, writeMeasureMeta, type MeasureDb } from './measure-db.ts'
import { MEASURE_KEYS } from './measure-rows.ts'
import {
  attachMeasureDb,
  backupStateFile,
  markMeasureDbUnavailable,
  markMeasurementsSynced,
  schedulePersist,
  type MeasureSource,
} from './persistence.ts'
import { getState, setState } from './store.ts'
import type { State } from './types.ts'

export interface StartOptions {
  /** つながらないときに試す回数と、その間（本番は 12回×5秒＝1分） */
  attempts: number
  waitMs: number
}

const DEFAULT_START: StartOptions = { attempts: 12, waitMs: 5000 }

async function withRetries<T>(task: () => Promise<T>, options: StartOptions): Promise<T> {
  let lastError: unknown
  for (let i = 0; i < options.attempts; i += 1) {
    try {
      return await task()
    } catch (error) {
      lastError = error
      console.error(`[db] データベースにつながりません（${String(i + 1)}/${String(options.attempts)}回目）:`, (error as Error).message)
      if (i + 1 < options.attempts) await new Promise((resolve) => setTimeout(resolve, options.waitMs))
    }
  }
  throw lastError
}

const counts = (state: Pick<State, (typeof MEASURE_KEYS)[number]>): string =>
  MEASURE_KEYS.map((key) => `${key}:${String(state[key].length)}`).join(' ')

/** データベースを使い始める。使い始めた形（json / db）を返す。つながらなければ null */
export async function startMeasurementStore(
  db: MeasureDb,
  requested: MeasureSource,
  options: StartOptions = DEFAULT_START,
): Promise<MeasureSource | null> {
  let recorded: string | null
  try {
    recorded = await withRetries(async () => {
      await ensureMeasureSchema(db)
      return readMeasureMeta(db, 'source')
    }, options)
  } catch (error) {
    if (requested === 'db') markMeasureDbUnavailable((error as Error).message)
    else console.error('[db] 試しの期間なので、データベースを使わずに続けます（数字は state.json が正）')
    return null
  }

  if (recorded === 'db') {
    if (requested !== 'db') {
      console.error('[db] すでにデータベースが正になっています。MEASURE_SOURCE が db でなくても、データベースから読みます')
    }
    const loaded = await loadMeasurements(db)
    setState((s) => ({ ...s, ...loaded }))
    attachMeasureDb(db, 'db')
    markMeasurementsSynced(getState())
    console.log(`[db] 数字の記録をデータベースから読み戻しました（${counts(loaded)}）`)
    return 'db'
  }

  // 写しているあいだに state が変わっても取りこぼさないよう、写した state を覚えておき、あとで差を書く
  const snapshot = getState()
  if (requested === 'db') backupStateFile('before-db')
  await copyStateToDb(db, snapshot)
  await writeMeasureMeta(db, 'source', requested)
  await writeMeasureMeta(db, `${requested}_started_at`, new Date().toISOString())
  attachMeasureDb(db, requested)
  markMeasurementsSynced(snapshot)
  // state.json を今の形で書き直す（切り替えなら数字を抜く）・写したあとに変わった分をデータベースへ
  schedulePersist(getState())
  console.log(
    requested === 'db'
      ? `[db] 数字の記録をデータベースへ移しました。以後はデータベースが正です（${counts(snapshot)}）`
      : `[db] 数字の記録をデータベースへ写しました。試しの期間なので state.json が正です（${counts(snapshot)}）`,
  )
  return requested
}
