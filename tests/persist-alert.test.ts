/**
 * 保存に失敗した・直った・重くなってきたを、異常のお知らせと同じ送り先へ知らせる（2026-10-29）。
 *
 *   - 送り先と「使う／使わない」は異常のお知らせの設定に従う（切なら外へは送らない。管理画面の赤い帯では必ず出る）
 *   - 失敗は1時間に1通まで・直ったら1通・重くなってきたは1日1通まで（同じ知らせが何十通も届かない）
 *   - 送れなかったらログに残す（黙らない）
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPersistAlerter, persistAlertMessage } from '../mock-server/persist-alert.ts'
import type { PersistHealth } from '../mock-server/store/persistence.ts'
import type { AlertSettingState } from '../mock-server/store/types.ts'

/** 2026-10-29 14:05 JST に最後に保存できた */
const LAST_OK = Date.parse('2026-10-29T05:05:00Z')
const T0 = Date.parse('2026-10-29T05:10:00Z')
const HOUR = 60 * 60 * 1000

const health = (over: Partial<PersistHealth> = {}): PersistHealth => ({
  lastOkAt: LAST_OK,
  failures: 1,
  lastError: 'Invalid string length',
  bytes: 3_500_000,
  durationMs: 20,
  ...over,
})

const setting = (over: Partial<AlertSettingState> = {}): AlertSettingState => ({
  enabled: true,
  cv_silent_hours: 3,
  cpa_limit: 0,
  link_check: true,
  notify: [{ service: 'chatwork', destination_id: '123' }],
  ...over,
})

function alerter(over: Partial<AlertSettingState> = {}, failSend = false) {
  const sent: string[] = []
  let now = T0
  const handle = createPersistAlerter({
    setting: () => setting(over),
    send: async (_service, _id, text) => {
      if (failSend) throw new Error('送れません')
      sent.push(text)
    },
    now: () => now,
  })
  return { sent, handle, later: (ms: number) => (now += ms) }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('保存の知らせ', () => {
  it('異常のお知らせが切なら、外へは送らない', async () => {
    const a = alerter({ enabled: false })
    await a.handle({ kind: 'failed', health: health() })
    expect(a.sent).toEqual([])
  })

  it('送り先が無ければ送らない', async () => {
    const a = alerter({ notify: [] })
    await a.handle({ kind: 'failed', health: health() })
    expect(a.sent).toEqual([])
  })

  it('失敗は1時間に1通まで。直ったら1通', async () => {
    const a = alerter()
    await a.handle({ kind: 'failed', health: health() })
    await a.handle({ kind: 'failed', health: health({ failures: 2 }) })
    a.later(30 * 60 * 1000)
    await a.handle({ kind: 'failed', health: health({ failures: 3 }) })
    expect(a.sent).toHaveLength(1)
    a.later(31 * 60 * 1000)
    await a.handle({ kind: 'failed', health: health({ failures: 4 }) })
    expect(a.sent).toHaveLength(2)
    await a.handle({ kind: 'recovered', health: health({ failures: 0 }) })
    expect(a.sent).toHaveLength(3)
    expect(a.sent[2]).toContain('元に戻りました')
  })

  it('失敗を知らせていなければ、直ったの知らせも出さない', async () => {
    const a = alerter()
    await a.handle({ kind: 'recovered', health: health({ failures: 0 }) })
    expect(a.sent).toEqual([])
  })

  it('重くなってきたは1日1通まで（日本時間の日付で数える）', async () => {
    const a = alerter()
    const heavy = health({ failures: 0, bytes: 60 * 1024 * 1024, durationMs: 700 })
    await a.handle({ kind: 'heavy', health: heavy })
    a.later(HOUR)
    await a.handle({ kind: 'heavy', health: heavy })
    expect(a.sent).toHaveLength(1)
    a.later(24 * HOUR)
    await a.handle({ kind: 'heavy', health: heavy })
    expect(a.sent).toHaveLength(2)
  })

  it('送れなかったらログに残す（ほかの送り先へは送る）', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const a = alerter({}, true)
    await a.handle({ kind: 'failed', health: health() })
    expect(errors).toHaveBeenCalled()
  })
})

describe('知らせの文面', () => {
  it('失敗: 何回続けてか・最後に保存できた時刻（日本時間）・そのままだと消えること・連絡すること', () => {
    const text = persistAlertMessage({ kind: 'failed', health: health({ failures: 2 }) })
    expect(text).toContain('数字の保存に失敗しています')
    expect(text).toContain('2回続けて')
    expect(text).toContain('10月29日 14:05')
    expect(text).toContain('消えます')
    expect(text).toContain('担当者')
  })

  it('起動してから一度も保存できていないときは、そう書く', () => {
    expect(persistAlertMessage({ kind: 'failed', health: health({ lastOkAt: null }) })).toContain('まだ一度も保存できていません')
  })

  it('重くなってきた: 大きさ（MB）と保存1回にかかる秒', () => {
    const text = persistAlertMessage({ kind: 'heavy', health: health({ failures: 0, bytes: 60 * 1024 * 1024, durationMs: 700 }) })
    expect(text).toContain('60MB')
    expect(text).toContain('0.7秒')
  })
})
