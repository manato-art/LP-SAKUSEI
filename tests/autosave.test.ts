import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createAutosave } from '../src/app/pages/autosave.ts'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('自動保存（実物のエディタは自動保存が走る・findings §732）', () => {
  it('打つのをやめてから保存する（1文字ごとには保存しない）', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const autosave = createAutosave({ save, delayMs: 800 })
    autosave.schedule(); autosave.schedule(); autosave.schedule()
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(800)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('間隔が空けば2回とも保存する', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const autosave = createAutosave({ save, delayMs: 500 })
    autosave.schedule()
    await vi.advanceTimersByTimeAsync(500)
    autosave.schedule()
    await vi.advanceTimersByTimeAsync(500)
    expect(save).toHaveBeenCalledTimes(2)
  })

  it('flush は待たずに即保存する（画面を離れるときのため）', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const autosave = createAutosave({ save, delayMs: 9999 })
    autosave.schedule()
    await autosave.flush()
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('保存するものが無ければ flush しても保存しない', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const autosave = createAutosave({ save, delayMs: 500 })
    await autosave.flush()
    expect(save).not.toHaveBeenCalled()
  })

  it('保存中にもう一度打たれたら、終わってからもう一度保存する', async () => {
    let resolveFirst = (): void => {}
    const save = vi
      .fn()
      .mockImplementationOnce(() => new Promise<void>((r) => { resolveFirst = r }))
      .mockResolvedValue(undefined)
    const autosave = createAutosave({ save, delayMs: 100 })
    autosave.schedule()
    await vi.advanceTimersByTimeAsync(100)
    expect(save).toHaveBeenCalledTimes(1)
    autosave.schedule()
    resolveFirst()
    await vi.advanceTimersByTimeAsync(100)
    expect(save).toHaveBeenCalledTimes(2)
  })

  it('保存が失敗しても握りつぶさず、渡された報告先へ伝える', async () => {
    const onError = vi.fn()
    const save = vi.fn().mockRejectedValue(new Error('通信失敗'))
    const autosave = createAutosave({ save, delayMs: 10, onError })
    autosave.schedule()
    await vi.advanceTimersByTimeAsync(10)
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: '通信失敗' }))
  })

  it('stop のあとは保存しない（画面を切り替えたあとに古い内容を書かないため）', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const autosave = createAutosave({ save, delayMs: 100 })
    autosave.schedule()
    autosave.stop()
    await vi.advanceTimersByTimeAsync(500)
    expect(save).not.toHaveBeenCalled()
  })

  it('flush は保存できたかを返す（失敗しても「保存しました」と出していた・2026-09-24 点検11）', async () => {
    const ok = createAutosave({ save: vi.fn().mockResolvedValue(undefined), delayMs: 9999 })
    ok.schedule()
    await expect(ok.flush()).resolves.toBe(true)
    const ng = createAutosave({ save: vi.fn().mockRejectedValue(new Error('x')), delayMs: 9999, onError: vi.fn() })
    ng.schedule()
    await expect(ng.flush()).resolves.toBe(false)
  })

  it('まだ保存していない変更があるかが分かる（画面を閉じる前に知らせるため）', async () => {
    const autosave = createAutosave({ save: vi.fn().mockResolvedValue(undefined), delayMs: 100 })
    expect(autosave.isPending()).toBe(false)
    autosave.schedule()
    expect(autosave.isPending()).toBe(true)
    await vi.advanceTimersByTimeAsync(100)
    expect(autosave.isPending()).toBe(false)
  })

  it('失敗が続くときは、やり直しの間をあけていく（通信が切れている間に 0.9秒ごとに叩き続けない）', async () => {
    const onError = vi.fn()
    const save = vi.fn().mockRejectedValue(new Error('通信失敗'))
    const autosave = createAutosave({ save, delayMs: 100, onError })
    autosave.schedule()
    await vi.advanceTimersByTimeAsync(100)
    expect(save).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(100)
    expect(save).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(100)
    expect(save).toHaveBeenCalledTimes(2)
    expect(autosave.isPending()).toBe(true)
  })
})
