/**
 * 数字の記録を、変わった分だけデータベースへ送る係（2026-10-29・persistence.ts が使う）。
 *
 * 保存の合図（0.4秒ごとにまとめた最新の state）を受けたら、前にデータベースへ書けた state と比べて、
 * 変わった記録・消えた記録だけを書く（measure-rows.ts の diffMeasurements）。
 *   - 書いている最中に次の合図が来たら、書き終えてから「書けた state → 最新の state」の差を書く（重ねて書かない）
 *   - 失敗したら、書けた state は進めない＝次はその分も含めて書く。少し待ってから試し直す
 */
import { diffMeasurements, MEASURE_KEYS, type MeasureChange } from './measure-rows.ts'
import { measureKeysInDb, writeMeasureChanges, type MeasureDb } from './measure-db.ts'
import type { State } from './types.ts'

export type MeasureSyncResult = { ok: true } | { ok: false; error: string }

export interface MeasureSync {
  /** 最新の state を渡す（書くのは順番に・まとめて） */
  request(state: State): void
  /** この state まではデータベースに入っている、と覚える（読み戻した直後・最初に全部書いた直後） */
  markSynced(state: State): void
  /** 書き待ちと書いている最中の分が終わるまで待つ（サーバーを止める前） */
  drain(): Promise<void>
}

export function createMeasureSync(
  db: MeasureDb,
  onResult: (result: MeasureSyncResult) => void,
  retryMs: number,
): MeasureSync {
  let synced: State | null = null
  let latest: State | null = null
  let running: Promise<void> | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null

  const run = async (): Promise<void> => {
    while (latest !== null && latest !== synced) {
      const target = latest
      try {
        await writeMeasureChanges(db, diffMeasurements(synced, target))
        synced = target
        onResult({ ok: true })
      } catch (error) {
        onResult({ ok: false, error: (error as Error).message })
        retryTimer = setTimeout(() => {
          retryTimer = null
          start()
        }, retryMs)
        // 試し直しの待ちだけで、終わろうとしているプロセスを引き止めない
        retryTimer.unref?.()
        return
      }
    }
  }

  const start = (): void => {
    if (running !== null || retryTimer !== null) return
    running = run().finally(() => {
      running = null
    })
  }

  return {
    request(state) {
      latest = state
      start()
    },
    markSynced(state) {
      synced = state
    },
    async drain() {
      // 失敗して待っている分も、止める前に1回試す
      if (retryTimer !== null) {
        clearTimeout(retryTimer)
        retryTimer = null
        start()
      }
      while (running !== null) await running
    },
  }
}

/**
 * 今の state をそのままデータベースへ写す（はじめて使うとき・試しの期間に立ち上がり直したとき）。
 * 全部を書き、データベースにだけ残っている記録（state には無い）は消す＝データベースを state と同じにする。
 */
export async function copyStateToDb(db: MeasureDb, state: State): Promise<void> {
  const inDb = await measureKeysInDb(db)
  const changes: MeasureChange[] = diffMeasurements(null, state).map((change) => {
    const keep = new Set(change.upserts.map((u) => u.key))
    return { ...change, deletes: (inDb.get(change.collection) ?? []).filter((key) => !keep.has(key)) }
  })
  // state に1件も無い種類で、データベースにだけ残っているもの
  for (const collection of MEASURE_KEYS) {
    if (changes.some((c) => c.collection === collection)) continue
    const stale = inDb.get(collection) ?? []
    if (stale.length > 0) changes.push({ collection, upserts: [], deletes: stale })
  }
  await writeMeasureChanges(db, changes)
}

