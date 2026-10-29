/**
 * テスト用のデータベース（PGlite＝Node の中で動く本物の Postgres）。本番の pg とおなじ形（MeasureDb）で渡す。
 */
import { PGlite } from '@electric-sql/pglite'
import type { MeasureDb, SqlRunner } from '../../mock-server/store/measure-db.ts'

export async function pgliteMeasureDb(): Promise<MeasureDb & { pglite: PGlite }> {
  const pglite = new PGlite()
  await pglite.waitReady
  const runner = (q: Pick<PGlite, 'query'>): SqlRunner => ({
    query: async (text, params) => ({ rows: (await q.query(text, params as unknown[] | undefined)).rows as never[] }),
  })
  return {
    pglite,
    ...runner(pglite),
    transaction: (fn) => pglite.transaction((tx) => fn(runner(tx))),
    close: () => pglite.close(),
  }
}
