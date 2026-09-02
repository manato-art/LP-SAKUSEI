/**
 * 永続化アーカイブ（作業中データを消える前に守る保険・2026-09-03の記事消失事故の再発防止）。
 *
 * - 破壊操作（reset）の直前は**強制で**1世代アーカイブされる。
 * - state.json が壊れていたら**最新アーカイブへフォールバック**して復元できる。
 * - 世代数は上限で頭打ち（溜め続けて重くならない）。
 *
 * persistence.ts は DATA_DIR を**モジュール読込時**に読むので、テストごとに
 * `vi.resetModules()`＋一時ディレクトリで動的 import する。
 */
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { State } from '../mock-server/store/types.ts'

type Persistence = typeof import('../mock-server/store/persistence.ts')

function fakeState(count: number): State {
  const abTests = Array.from({ length: count }, (_, i) => ({ uid: `AB_${i}` }))
  return { abTests, folders: [] } as unknown as State
}

async function loadPersistence(dir: string): Promise<Persistence> {
  vi.resetModules()
  process.env['DATA_DIR'] = dir
  return import('../mock-server/store/persistence.ts')
}

describe('永続化アーカイブ（作業中データの保険）', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sb-persist-'))
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
    delete process.env['DATA_DIR']
  })

  it('破壊操作の直前アーカイブは強制で残る（reset前の退避）', async () => {
    const p = await loadPersistence(dir)
    p.archiveBeforeDestruction(fakeState(3))
    const archives = readdirSync(join(dir, 'archives'))
    expect(archives).toHaveLength(1)
    expect(archives[0]).toMatch(/^state-.*\.json$/)
  })

  it('state.jsonが壊れていても最新アーカイブへフォールバックして復元できる', async () => {
    const p = await loadPersistence(dir)
    p.archiveBeforeDestruction(fakeState(5))
    writeFileSync(join(dir, 'state.json'), '{ this is broken json')
    const loaded = p.loadPersistedState()
    expect(loaded).not.toBeNull()
    expect(loaded?.abTests).toHaveLength(5)
  })

  it('世代数は上限（6）で頭打ち＝溜め続けない', async () => {
    const p = await loadPersistence(dir)
    for (let i = 0; i < 9; i += 1) {
      p.archiveBeforeDestruction(fakeState(i + 1))
      await new Promise((r) => setTimeout(r, 20)) // ISO時刻(ms)を確実にずらす
    }
    const archives = readdirSync(join(dir, 'archives'))
    expect(archives.length).toBeLessThanOrEqual(6)
    expect(archives.length).toBeGreaterThan(0)
  })

  it('DATA_DIR未設定ならアーカイブしない（ローカル/テストは従来どおり）', async () => {
    vi.resetModules()
    delete process.env['DATA_DIR']
    const p: Persistence = await import('../mock-server/store/persistence.ts')
    expect(p.persistenceEnabled()).toBe(false)
    p.archiveBeforeDestruction(fakeState(2)) // 何も起きない（例外も出ない）
    expect(existsSync(join(dir, 'archives'))).toBe(false)
  })
})
