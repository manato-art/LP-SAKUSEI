/**
 * 数字の保存に失敗したら黙らない（2026-10-29 本人「まずはこれやろ」＝保存に失敗したらすぐ知らせる）。
 *
 * 以前は保存（state.json を丸ごと書き直す）に失敗しても何も言わずに捨てていた。データが大きくなると
 * 保存そのものができなくなり（手元の測定では10商材・3か月ぶんで失敗）、気づかないまま次に立ち上がり直したとき、
 * 最後に保存できたときより後の数字が消える。
 *   - 失敗したら記録に残し、知らせの合図を出し、新しい書き込みが無くても少しあとで試し直す
 *   - 別名に書いてから置き換える（書きかけで止まっても、前に保存できたファイルが壊れない）
 *   - サーバーを止める前に、待たずに書ける
 *   - 大きくなってきたら（重くなってきたら）分かる
 */
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { State } from '../mock-server/store/types.ts'

type Persistence = typeof import('../mock-server/store/persistence.ts')

function fakeState(count: number): State {
  return { abTests: Array.from({ length: count }, (_, i) => ({ uid: `AB_${i}` })), folders: [] } as unknown as State
}

/** 文字にできない値（BigInt）を混ぜると、保存（JSON にする所）で失敗する */
function unsavableState(): State {
  return { ...fakeState(9), broken: 1n } as unknown as State
}

async function loadPersistence(dir: string): Promise<Persistence> {
  vi.resetModules()
  process.env['DATA_DIR'] = dir
  return import('../mock-server/store/persistence.ts')
}

const savedCount = (dir: string): number =>
  (JSON.parse(readFileSync(join(dir, 'state.json'), 'utf8')) as { abTests: unknown[] }).abTests.length

describe('数字の保存に失敗したら黙らない', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sb-persist-health-'))
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    rmSync(dir, { recursive: true, force: true })
    delete process.env['DATA_DIR']
  })

  it('保存できたら、いつ・どれだけの大きさで・何ミリ秒かかったかを覚え、書きかけのファイルを残さない', async () => {
    const p = await loadPersistence(dir)
    p.schedulePersist(fakeState(2))
    p.flushPersistNow()
    expect(savedCount(dir)).toBe(2)
    expect(readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toEqual([])
    const health = p.persistHealth()
    expect(health.failures).toBe(0)
    expect(health.lastOkAt).not.toBeNull()
    expect(health.bytes).toBeGreaterThan(0)
    expect(health.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('失敗したら、合図を出し・回数と理由を覚え・ログに出す。前に保存できた state.json は壊れない', async () => {
    const p = await loadPersistence(dir)
    p.schedulePersist(fakeState(3))
    p.flushPersistNow()
    const events: string[] = []
    p.onPersistEvent((event) => events.push(event.kind))
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    p.schedulePersist(unsavableState())
    p.flushPersistNow()

    expect(events).toEqual(['failed'])
    expect(p.persistHealth().failures).toBe(1)
    expect(p.persistHealth().lastError).not.toBe('')
    expect(errors).toHaveBeenCalled()
    expect(savedCount(dir)).toBe(3)
    expect(existsSync(join(dir, 'state.json.tmp'))).toBe(false)
  })

  it('失敗のあと保存できたら「直った」の合図を出し、回数を0に戻す', async () => {
    const p = await loadPersistence(dir)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const events: string[] = []
    p.onPersistEvent((event) => events.push(event.kind))
    p.schedulePersist(unsavableState())
    p.flushPersistNow()
    p.schedulePersist(fakeState(4))
    p.flushPersistNow()
    expect(events).toEqual(['failed', 'recovered'])
    expect(p.persistHealth().failures).toBe(0)
    expect(savedCount(dir)).toBe(4)
  })

  it('新しい書き込みが来なくても、失敗した内容を少しあとで試し直す', async () => {
    vi.useFakeTimers()
    const p = await loadPersistence(dir)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    p.schedulePersist(unsavableState())
    p.flushPersistNow()
    expect(p.persistHealth().failures).toBe(1)
    await vi.advanceTimersByTimeAsync(p.PERSIST_RETRY_MS)
    expect(p.persistHealth().failures).toBe(2)
  })

  it('試し直しを待っているあいだに新しい書き込みが来たら、いつもの間隔（0.4秒）で書く', async () => {
    vi.useFakeTimers()
    const p = await loadPersistence(dir)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    p.schedulePersist(unsavableState())
    p.flushPersistNow()
    p.schedulePersist(fakeState(6))
    await vi.advanceTimersByTimeAsync(500)
    expect(p.persistHealth().failures).toBe(0)
    expect(savedCount(dir)).toBe(6)
  })

  it('知らせを受ける側が失敗しても、保存は止まらない', async () => {
    const p = await loadPersistence(dir)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    p.onPersistEvent(() => {
      throw new Error('知らせの処理の失敗')
    })
    p.schedulePersist(unsavableState())
    p.flushPersistNow()
    p.schedulePersist(fakeState(5))
    p.flushPersistNow()
    expect(savedCount(dir)).toBe(5)
  })

  it('立ち上がり直したあとは、読み戻した state.json を書いた時刻を「最後に保存できた時刻」にする', async () => {
    const first = await loadPersistence(dir)
    first.schedulePersist(fakeState(7))
    first.flushPersistNow()
    const savedAt = statSync(join(dir, 'state.json')).mtimeMs
    const restarted = await loadPersistence(dir)
    expect(restarted.persistHealth().lastOkAt).toBeNull()
    expect(restarted.loadPersistedState()?.abTests).toHaveLength(7)
    expect(restarted.persistHealth().lastOkAt).toBe(savedAt)
  })

  it('大きくなってきた（50MB 以上・保存1回に0.5秒以上）は「重くなってきた」と分かる', async () => {
    const p = await loadPersistence(dir)
    expect(p.isHeavySave({ bytes: 60 * 1024 * 1024, durationMs: 10 })).toBe(true)
    expect(p.isHeavySave({ bytes: 1024, durationMs: 600 })).toBe(true)
    expect(p.isHeavySave({ bytes: 3_500_000, durationMs: 20 })).toBe(false)
  })
})
