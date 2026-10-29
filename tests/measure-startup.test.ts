/**
 * 起動時に、数字の記録のデータベースを使い始める（2026-10-29・store/measure-startup.ts）。
 *
 *   試しの期間（json）: state.json が正。今の記録をデータベースへ写し、以後は両方に書く。データベースの失敗はログだけ
 *   切り替え（db）: 写しを残してからデータベースへ写し、以後 state.json には数字を書かない。失敗は赤い帯・知らせ
 *   切り替えたあとに立ち上がり直したら: データベースから読み戻す（MEASURE_SOURCE を戻しても、自動では戻らない＝数字が消えない）
 *   切り替えたのに、つながらなかったら: 数字は state.json へ書いて守り、赤い帯で知らせる
 *
 * persistence.ts / store.ts は DATA_DIR を読み込み時に読むので、テストごとに vi.resetModules＋一時ディレクトリで読み直す。
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyState } from '../mock-server/store/seed-empty.ts'
import type { MeasureDb } from '../mock-server/store/measure-db.ts'
import type { State } from '../mock-server/store/types.ts'
import { pgliteMeasureDb } from './helpers/pglite-db.ts'

const metric = (uid: string, pv: number) => ({ entity_uid: uid, scope: 'ab_test' as const, date: '2026-10-29', pv, click: 0, cv: 0, ad_cost: 0, sales: 0 })

function savedState(dir: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(dir, 'state.json'), 'utf8')) as Record<string, unknown>
}

/** その DATA_DIR で、サーバーを立ち上げ直したのと同じ読み込みをする */
async function boot(dir: string) {
  vi.resetModules()
  process.env['DATA_DIR'] = dir
  const store = await import('../mock-server/store/store.ts')
  const persistence = await import('../mock-server/store/persistence.ts')
  const startup = await import('../mock-server/store/measure-startup.ts')
  return { ...store, ...persistence, ...startup }
}

describe('起動時に数字のデータベースを使い始める', () => {
  let dir: string
  let db: Awaited<ReturnType<typeof pgliteMeasureDb>>
  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'sb-measure-start-'))
    const initial: State = { ...createEmptyState(), metrics: [metric('A', 5)] }
    writeFileSync(join(dir, 'state.json'), JSON.stringify(initial))
    db = await pgliteMeasureDb()
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    await db.close()
    rmSync(dir, { recursive: true, force: true })
    delete process.env['DATA_DIR']
  })

  it('試しの期間: データベースへ写し、以後の変わった分も写す。state.json には今までどおり全部を書く', async () => {
    const app = await boot(dir)
    expect(await app.startMeasurementStore(db, 'json')).toBe('json')
    app.setState((s) => ({ ...s, metrics: [...s.metrics, metric('B', 1)] }))
    await app.flushPersistNow()
    const { loadMeasurements } = await import('../mock-server/store/measure-db.ts')
    expect((await loadMeasurements(db)).metrics.map((m) => m.entity_uid)).toEqual(['A', 'B'])
    expect((savedState(dir)['metrics'] as unknown[]).length).toBe(2)
  })

  it('切り替え: 写しを残してから移し、state.json には数字を書かない', async () => {
    const app = await boot(dir)
    expect(await app.startMeasurementStore(db, 'db')).toBe('db')
    await app.flushPersistNow()
    expect(readdirSync(dir).some((f) => /^state-before-db-.*\.json$/.test(f))).toBe(true)
    expect(savedState(dir)).not.toHaveProperty('metrics')
    const { loadMeasurements, readMeasureMeta } = await import('../mock-server/store/measure-db.ts')
    expect((await loadMeasurements(db)).metrics.map((m) => m.entity_uid)).toEqual(['A'])
    expect(await readMeasureMeta(db, 'source')).toBe('db')
  })

  it('切り替えたあとに立ち上がり直したら、データベースから読み戻す（MEASURE_SOURCE を戻しても数字は消えない）', async () => {
    const first = await boot(dir)
    await first.startMeasurementStore(db, 'db')
    first.setState((s) => ({ ...s, metrics: [...s.metrics, metric('B', 2)] }))
    await first.flushPersistNow()

    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const again = await boot(dir)
    expect(again.getState().metrics).toEqual([])
    expect(await again.startMeasurementStore(db, 'json')).toBe('db')
    expect(again.getState().metrics.map((m) => m.entity_uid)).toEqual(['A', 'B'])
    expect(errors).toHaveBeenCalled()
    // 読み戻したあと、何も変わっていなければデータベースへは書かない（全部を書き直さない）
    const write = vi.spyOn(db, 'transaction')
    await again.flushPersistNow()
    expect(write).not.toHaveBeenCalled()
  })

  it('試しの期間はデータベースの失敗をログだけにする（赤い帯は出さない）', async () => {
    const app = await boot(dir)
    await app.startMeasurementStore(db, 'json')
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(db, 'transaction').mockRejectedValue(new Error('つながらない'))
    app.setState((s) => ({ ...s, metrics: [...s.metrics, metric('C', 1)] }))
    await app.flushPersistNow()
    expect(errors).toHaveBeenCalled()
    expect(app.persistHealth().failures).toBe(0)
    expect(app.measureDbStatus().failures).toBeGreaterThan(0)
  })

  it('切り替えたあとはデータベースの失敗が赤い帯・知らせになり、直ったら消える', async () => {
    const app = await boot(dir)
    await app.startMeasurementStore(db, 'db')
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const events: string[] = []
    app.onPersistEvent((e) => events.push(e.kind))
    const failing = vi.spyOn(db, 'transaction').mockRejectedValueOnce(new Error('つながらない'))
    app.setState((s) => ({ ...s, metrics: [...s.metrics, metric('C', 1)] }))
    await app.flushPersistNow()
    expect(app.persistHealth().failures).toBeGreaterThan(0)
    expect(app.persistHealth().lastError).toContain('データベース')
    failing.mockRestore()
    app.setState((s) => ({ ...s, metrics: [...s.metrics, metric('D', 1)] }))
    await app.flushPersistNow()
    expect(app.persistHealth().failures).toBe(0)
    expect(events).toEqual(['failed', 'recovered'])
    const { loadMeasurements } = await import('../mock-server/store/measure-db.ts')
    expect((await loadMeasurements(db)).metrics.map((m) => m.entity_uid)).toEqual(['A', 'C', 'D'])
  })

  it('切り替えるつもりで、つながらなかったら: 数字は state.json へ書いて守り、赤い帯で知らせる', async () => {
    const app = await boot(dir)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const broken: MeasureDb = { ...db, query: () => Promise.reject(new Error('つながらない')) }
    expect(await app.startMeasurementStore(broken, 'db', { attempts: 2, waitMs: 1 })).toBeNull()
    expect(app.persistHealth().failures).toBeGreaterThan(0)
    app.setState((s) => ({ ...s, metrics: [...s.metrics, metric('E', 1)] }))
    await app.flushPersistNow()
    expect((savedState(dir)['metrics'] as unknown[]).length).toBe(2)
    expect(existsSync(join(dir, 'state.json'))).toBe(true)
  })
})
