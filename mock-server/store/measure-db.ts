/**
 * 数字の記録をデータベース（Postgres）へ1件ずつ書く・読む（2026-10-29 本人「OK進めて」）。
 *
 * 表は1つ（measure_rows）。記録の種類（collection）と目印（key）で1行、中身は JSON のまま持つ（jsonb）。
 * seq は入れた順の番号で、書き直しても変わらない。読むときの並び順に使う（measure-rows.ts の order）。
 * 1回に書く分（変わった記録・消えた記録）は1つのまとまり（transaction）にする＝途中で失敗したら1件も残らない。
 * 本番は pg（DATABASE_URL）、テストは PGlite（本物と同じ Postgres が Node の中で動く）。どちらも MeasureDb の形で渡す。
 */
import pg from 'pg'
import { MEASURE_COLLECTIONS, MEASURE_KEYS, type MeasureChange, type MeasureKey, type MeasureOrder } from './measure-rows.ts'
import type { State } from './types.ts'

export interface SqlRunner {
  query<R = Record<string, unknown>>(text: string, params?: readonly unknown[]): Promise<{ rows: R[] }>
}

export interface MeasureDb extends SqlRunner {
  /** fn の中の書き込みを1つのまとまりにする（失敗したら全部なかったことにする） */
  transaction<T>(fn: (tx: SqlRunner) => Promise<T>): Promise<T>
  close(): Promise<void>
}

/** 1回の命令で書く件数（Postgres は1回の命令の値が65,535個まで。1件3個なので余裕をもって） */
const BATCH = 1000

const ORDER_SQL: Readonly<Record<MeasureOrder, string>> = {
  append: 'seq ASC',
  prepend: 'seq DESC',
  'by-date': "data->>'date' ASC, seq ASC",
}

export async function ensureMeasureSchema(db: SqlRunner): Promise<void> {
  await db.query(
    `CREATE TABLE IF NOT EXISTS measure_rows (
      collection text NOT NULL,
      key text NOT NULL,
      seq bigserial,
      data jsonb NOT NULL,
      PRIMARY KEY (collection, key)
    )`,
  )
  await db.query('CREATE INDEX IF NOT EXISTS measure_rows_order ON measure_rows (collection, seq)')
  await db.query('CREATE TABLE IF NOT EXISTS measure_meta (name text PRIMARY KEY, value text NOT NULL)')
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** 同じ目印が2件あると、データベースには1件しか残らない＝記録が消える。黙って捨てずに止める */
function assertUniqueKeys(change: MeasureChange): void {
  const seen = new Set<string>()
  for (const { key } of change.upserts) {
    if (seen.has(key)) throw new Error(`記録の目印が重なっています（${change.collection}・${key}）`)
    seen.add(key)
  }
}

/** 変わった記録・消えた記録を書く（1つのまとまりで） */
export async function writeMeasureChanges(db: MeasureDb, changes: readonly MeasureChange[]): Promise<void> {
  if (changes.length === 0) return
  for (const change of changes) assertUniqueKeys(change)
  await db.transaction(async (tx) => {
    for (const change of changes) {
      for (const keys of chunks(change.deletes, BATCH)) {
        await tx.query('DELETE FROM measure_rows WHERE collection = $1 AND key = ANY($2::text[])', [change.collection, keys])
      }
      for (const batch of chunks(change.upserts, BATCH)) {
        const values = batch.map((_, i) => `($${String(i * 3 + 1)}, $${String(i * 3 + 2)}, $${String(i * 3 + 3)}::jsonb)`)
        const params = batch.flatMap(({ key, row }) => [change.collection, key, JSON.stringify(row)])
        await tx.query(
          `INSERT INTO measure_rows (collection, key, data) VALUES ${values.join(', ')}
           ON CONFLICT (collection, key) DO UPDATE SET data = EXCLUDED.data`,
          params,
        )
      }
    }
  })
}

/** しまってある記録を、元の並び順で読み戻す */
export async function loadMeasurements(db: SqlRunner): Promise<Pick<State, MeasureKey>> {
  const out: Partial<Record<MeasureKey, unknown[]>> = {}
  for (const collection of MEASURE_KEYS) {
    const { rows } = await db.query<{ data: unknown }>(
      `SELECT data FROM measure_rows WHERE collection = $1 ORDER BY ${ORDER_SQL[MEASURE_COLLECTIONS[collection].order]}`,
      [collection],
    )
    out[collection] = rows.map((r) => r.data)
  }
  return out as Pick<State, MeasureKey>
}

/** しまってある記録の目印（種類ごと）。読み戻さずに、消えた記録を見つけるのに使う */
export async function measureKeysInDb(db: SqlRunner): Promise<Map<MeasureKey, string[]>> {
  const { rows } = await db.query<{ collection: MeasureKey; key: string }>(
    'SELECT collection, key FROM measure_rows ORDER BY collection, seq',
  )
  const out = new Map<MeasureKey, string[]>()
  for (const r of rows) out.set(r.collection, [...(out.get(r.collection) ?? []), r.key])
  return out
}

export async function readMeasureMeta(db: SqlRunner, name: string): Promise<string | null> {
  const { rows } = await db.query<{ value: string }>('SELECT value FROM measure_meta WHERE name = $1', [name])
  return rows[0]?.value ?? null
}

export async function writeMeasureMeta(db: SqlRunner, name: string, value: string): Promise<void> {
  await db.query(
    'INSERT INTO measure_meta (name, value) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value',
    [name, value],
  )
}

/** 本番のデータベース（Railway の Postgres・DATABASE_URL） */
export function pgMeasureDb(connectionString: string): MeasureDb {
  const pool = new pg.Pool({ connectionString, max: 4, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 30_000 })
  // 使っていない接続が切れたとき。サーバーは落とさず、ログに残す（次に書くときに作り直される）
  pool.on('error', (error) => {
    console.error('[db] データベースとの接続で問題が起きました:', error.message)
  })
  const runner = (client: Pick<pg.Pool, 'query'> | pg.PoolClient): SqlRunner => ({
    query: async <R,>(text: string, params?: readonly unknown[]) =>
      ({ rows: (await client.query(text, params as unknown[] | undefined)).rows as R[] }),
  })
  return {
    ...runner(pool),
    transaction: async (fn) => {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const result = await fn(runner(client))
        await client.query('COMMIT')
        return result
      } catch (error) {
        await client.query('ROLLBACK').catch((rollbackError: unknown) => {
          console.error('[db] 書き込みの取り消しに失敗しました:', (rollbackError as Error).message)
        })
        throw error
      } finally {
        client.release()
      }
    },
    close: () => pool.end(),
  }
}
