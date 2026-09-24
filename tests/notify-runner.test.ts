/**
 * CV発生通知・デイリーレポートを送る見張り（2026-09-24 点検28）。
 * 送り先は「異常のお知らせ」の送り先。送れなかった理由は記録に残す（画面で見える・黙らない）。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getState, resetState, setState } from '../mock-server/store/store.ts'
import { runNotificationDigests } from '../mock-server/notify-runner.ts'

// 2026-09-24 12:00 JST
const NOW_MS = Date.UTC(2026, 8, 24, 3, 0)
const NOW = Math.floor(NOW_MS / 1000)

function seed(opts: { cv: boolean; daily: boolean; notify: unknown }): void {
  resetState()
  setState((s) => ({
    ...s,
    abTests: [{ ...(s.abTests[0] ?? {}), id: 900, uid: 'AB1', title: '本命LP' } as (typeof s.abTests)[number]],
    notificationSettings: s.notificationSettings.map((n) =>
      n.scope === 'member' ? { ...n, cv_digest: opts.cv, daily_digest: opts.daily } : n,
    ),
    alertSetting: { ...s.alertSetting, notify: opts.notify as typeof s.alertSetting.notify },
    conversions: [{ id: 5, uid: 'CV5', ab_test_uid: 'AB1', version_uid: '', media_id: null, amount: 0, occurred_at: NOW - 60, status: '承認' }],
    metrics: [{ entity_uid: 'AB1', scope: 'ab_test', date: '2026-09-23', pv: 10, click: 2, cv: 1, ad_cost: 500, sales: 0 }],
    notificationRuns: { ...s.notificationRuns, cv_max_id: 4, daily_sent_for: null },
  }))
}

beforeEach(() => {
  resetState()
})

describe('送る見張り', () => {
  it('送り先すべてへ、CV発生通知とデイリーレポートを送る', async () => {
    seed({ cv: true, daily: true, notify: [{ service: 'slack', destination_id: 'C1' }, { service: 'line', destination_id: '' }] })
    const send = vi.fn(async () => undefined)
    await runNotificationDigests(NOW_MS, send)
    const texts = send.mock.calls.map((c) => (c as unknown[])[2] as string)
    expect(texts.filter((t) => t.startsWith('【新しいCV 1件】'))).toHaveLength(2)
    expect(texts.filter((t) => t.startsWith('【デイリーレポート】2026-09-23'))).toHaveLength(2)
    expect(getState().notificationRuns.cv_max_id).toBe(5)
    expect(getState().notificationRuns.daily_sent_for).toBe('2026-09-24')
  })

  it('スイッチが切れていれば送らない', async () => {
    seed({ cv: false, daily: false, notify: [{ service: 'slack', destination_id: 'C1' }] })
    const send = vi.fn(async () => undefined)
    await runNotificationDigests(NOW_MS, send)
    expect(send).not.toHaveBeenCalled()
  })

  it('送り先が無ければ送らない', async () => {
    seed({ cv: true, daily: true, notify: [] })
    const send = vi.fn(async () => undefined)
    await runNotificationDigests(NOW_MS, send)
    expect(send).not.toHaveBeenCalled()
  })

  it('送れなかった理由を記録に残す（ほかの送り先へは送る）', async () => {
    seed({ cv: true, daily: false, notify: [{ service: 'line', destination_id: '' }, { service: 'slack', destination_id: 'C1' }] })
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const send = vi.fn(async (service: string) => {
      if (service === 'line') throw new Error('LINEの今月の送信上限に達しました')
    })
    await runNotificationDigests(NOW_MS, send)
    expect(send).toHaveBeenCalledTimes(2)
    expect(getState().notificationRuns.cv_last_error).toContain('LINEの今月の送信上限に達しました')
    errors.mockRestore()
  })
})

describe('保存を書きすぎない', () => {
  it('何も変わらない見張りでは状態を書き直さない（30秒ごとに重い保存をしない）', async () => {
    const { getRevision } = await import('../mock-server/store/store.ts')
    seed({ cv: false, daily: false, notify: [] })
    await runNotificationDigests(NOW_MS, vi.fn(async () => undefined))
    const before = getRevision()
    await runNotificationDigests(NOW_MS + 30_000, vi.fn(async () => undefined))
    expect(getRevision()).toBe(before)
  })
})
