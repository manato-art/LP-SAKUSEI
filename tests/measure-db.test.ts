/**
 * 数字の記録をデータベースへ1件ずつ書き、読み戻す（2026-10-29・store/measure-db.ts）。
 * 本物と同じ Postgres（PGlite）で確かめる。読み戻した記録は、中身も並び順も元と同じになる。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { diffMeasurements } from '../mock-server/store/measure-rows.ts'
import { ensureMeasureSchema, loadMeasurements, measureKeysInDb, readMeasureMeta, writeMeasureChanges, writeMeasureMeta } from '../mock-server/store/measure-db.ts'
import { createEmptyState } from '../mock-server/store/seed-empty.ts'
import type { State } from '../mock-server/store/types.ts'
import { pgliteMeasureDb } from './helpers/pglite-db.ts'

type Db = Awaited<ReturnType<typeof pgliteMeasureDb>>

const metric = (uid: string, pv: number, date = '2026-10-29') => ({ entity_uid: uid, scope: 'ab_test' as const, date, pv, click: 0, cv: 0, ad_cost: 0, sales: 0 })
const cv = (uid: string, at: number) => ({ id: at, uid, ab_test_uid: 'P', version_uid: 'V', media_id: null, amount: 0, occurred_at: at, status: 'approved' })
const log = (date: string, ip: string) => ({ team_id: 1, date, ip, referer: '', params: [], excluded: false, exclude_token: '' })

function sample(): State {
  return {
    ...createEmptyState(),
    metrics: [metric('A', 1), metric('B', 2)],
    conversions: [cv('NEW', 3), cv('MID', 2), cv('OLD', 1)] as unknown as State['conversions'],
    requestLogs: [log('2026-10-01', '1'), log('2026-10-01', '2'), log('2026-10-02', '3')],
    visitorTouches: [{ vid: 'visitor-1', ab_test_uid: 'P', version_uid: 'V', viewed_at: 1, clicked_at: null, converted_at: null }],
  }
}

async function roundTrip(db: Db, prev: State | null, next: State): Promise<Partial<State>> {
  await writeMeasureChanges(db, diffMeasurements(prev, next))
  return loadMeasurements(db)
}

describe('データベースへ1件ずつ書いて読み戻す', () => {
  let db: Db
  beforeEach(async () => {
    db = await pgliteMeasureDb()
    await ensureMeasureSchema(db)
  })
  afterEach(async () => {
    await db.close()
  })

  it('はじめて書いた全部を、同じ中身・同じ並び順で読み戻す', async () => {
    const state = sample()
    const loaded = await roundTrip(db, null, state)
    expect(loaded.metrics).toEqual(state.metrics)
    expect(loaded.conversions).toEqual(state.conversions)
    expect(loaded.requestLogs).toEqual(state.requestLogs)
    expect(loaded.visitorTouches).toEqual(state.visitorTouches)
    expect(loaded.heatmapStats).toEqual([])
  })

  it('数が増えた・新しい申し込みが前に足された・古いアクセスを削った、を書いても並び順が崩れない', async () => {
    const prev = sample()
    await roundTrip(db, null, prev)
    const next: State = {
      ...prev,
      metrics: [prev.metrics[0]!, { ...prev.metrics[1]!, pv: 9 }, metric('C', 1)],
      conversions: [cv('NEWEST', 4) as unknown as State['conversions'][number], ...prev.conversions],
      requestLogs: [...prev.requestLogs.slice(1), log('2026-10-03', '4')],
    }
    const loaded = await roundTrip(db, prev, next)
    expect(loaded.metrics).toEqual(next.metrics)
    expect(loaded.conversions?.map((c) => c.uid)).toEqual(['NEWEST', 'NEW', 'MID', 'OLD'])
    expect(loaded.requestLogs).toEqual(next.requestLogs)
  })

  it('消した記録はデータベースからも消える', async () => {
    const prev = sample()
    await roundTrip(db, null, prev)
    const loaded = await roundTrip(db, prev, { ...prev, visitorTouches: [], metrics: [prev.metrics[0]!] })
    expect(loaded.visitorTouches).toEqual([])
    expect(loaded.metrics).toEqual([prev.metrics[0]])
    expect((await measureKeysInDb(db)).get('metrics')).toEqual(['ab_test|A|2026-10-29'])
  })

  it('たくさんの記録（2,500件）も分けて書ける', async () => {
    const many: State = { ...createEmptyState(), metrics: Array.from({ length: 2500 }, (_, i) => metric(`P${String(i)}`, i)) }
    const loaded = await roundTrip(db, null, many)
    expect(loaded.metrics).toHaveLength(2500)
    expect(loaded.metrics?.[2499]).toEqual(many.metrics[2499])
  })

  it('目印のほかに、移したかどうかなどの合図を残せる', async () => {
    expect(await readMeasureMeta(db, 'source')).toBeNull()
    await writeMeasureMeta(db, 'source', 'db')
    await writeMeasureMeta(db, 'source', 'db')
    expect(await readMeasureMeta(db, 'source')).toBe('db')
  })

  it('書いている途中で失敗したら、その回の分は1件も残さない（半分だけ書かれない）', async () => {
    const prev = sample()
    await roundTrip(db, null, prev)
    const next = { ...prev, metrics: [...prev.metrics, metric('C', 1)] }
    const changes = diffMeasurements(prev, next)
    const broken = { ...db, transaction: (fn: Parameters<Db['transaction']>[0]) => db.transaction(async (tx) => {
      await fn(tx)
      throw new Error('途中で失敗')
    }) }
    await expect(writeMeasureChanges(broken, changes)).rejects.toThrow('途中で失敗')
    expect((await loadMeasurements(db)).metrics).toEqual(prev.metrics)
  })
})
