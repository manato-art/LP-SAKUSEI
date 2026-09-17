/**
 * 予約の日時が来たら切り替えて知らせる（2026-09-16・本人の依頼）。
 *
 * 30秒ごとの見張り（task-runner）から呼ばれる。**先に「完了」にしてから知らせる**
 * （送信が遅くても、次の見張りが同じ予約をもう一度実行しないため）。
 * 知らせる先は異常のお知らせと同じ。お知らせが切なら、切り替えだけして知らせない。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const spy = vi.hoisted(() => ({ sent: [] as string[] }))

vi.mock('../mock-server/notify.ts', () => ({
  NotifyError: class NotifyError extends Error {},
  sendNotification: (_service: string, _id: string, text: string): Promise<void> => {
    spy.sent.push(text)
    return Promise.resolve()
  },
}))

const { runScheduledSwitches } = await import('../mock-server/scheduled-switch-runner.ts')
const { getState, resetState, setState } = await import('../mock-server/store/store.ts')

/** 2026-09-30 23:59 JST */
const AT = new Date(Date.UTC(2026, 8, 30, 14, 59))

function seed(options: { alerts?: boolean } = {}): void {
  resetState()
  setState((s) => ({
    ...s,
    abTests: [{ ...(s.abTests[0] ?? ({} as never)), id: 1, uid: 'AB1', title: '本命LP' } as never],
    articles: [{ id: 11, uid: 'ART1', ab_test_id: 1, memo: '', archived: false, style_applied: false, created_at: 0, updated_timestamp: 0 }],
    versions: [
      { ...(s.versions[0] ?? ({} as never)), id: 101, uid: 'SALE', name: 'セールLP', article_id: 11, distribution_ratio: 100, archived: false } as never,
      { ...(s.versions[0] ?? ({} as never)), id: 102, uid: 'NORMAL', name: '通常LP', article_id: 11, distribution_ratio: 0, archived: false } as never,
    ],
    scheduledSwitches: [
      {
        uid: 'SW1',
        article_uid: 'ART1',
        run_at: '2026-09-30T23:59',
        ratios: [
          { version_uid: 'SALE', ratio: 0 },
          { version_uid: 'NORMAL', ratio: 100 },
        ],
        status: 'pending',
        note: '',
        created_at: 0,
        done_at: null,
      },
    ],
    alertSetting: {
      enabled: options.alerts ?? true,
      cv_silent_hours: 6,
      cpa_limit: 0,
      link_check: false,
      notify: [{ service: 'line', destination_id: '' }],
    },
  }))
}

beforeEach(() => {
  spy.sent.length = 0
})

describe('予約の日時が来たら切り替える', () => {
  it('配信割合を切り替えて、どう変わったかを知らせる', async () => {
    seed()
    expect(await runScheduledSwitches(AT)).toBe(1)

    expect(getState().versions.map((v) => v.distribution_ratio)).toEqual([0, 100])
    expect(getState().scheduledSwitches[0]?.status).toBe('done')
    expect(spy.sent).toHaveLength(1)
    expect(spy.sent[0]).toContain('予約どおり切り替えました')
    expect(spy.sent[0]).toContain('本命LP')
    expect(spy.sent[0]).toContain('セールLP 100% → 0%')
    expect(spy.sent[0]).toContain('通常LP 0% → 100%')
  })

  it('まだ時刻が来ていなければ何もしない', async () => {
    seed()
    expect(await runScheduledSwitches(new Date(AT.getTime() - 60_000))).toBe(0)
    expect(getState().versions.map((v) => v.distribution_ratio)).toEqual([100, 0])
  })

  it('見張りが2回回っても、1回しか実行しない', async () => {
    seed()
    await runScheduledSwitches(AT)
    await runScheduledSwitches(AT)
    expect(spy.sent).toHaveLength(1)
  })

  it('お知らせが切なら、切り替えだけして知らせない', async () => {
    seed({ alerts: false })
    await runScheduledSwitches(AT)
    expect(getState().versions.map((v) => v.distribution_ratio)).toEqual([0, 100])
    expect(spy.sent).toHaveLength(0)
  })

  it('実行できなかったときも、そう知らせる', async () => {
    seed()
    setState((s) => ({ ...s, versions: s.versions.filter((v) => v.uid !== 'NORMAL') }))
    await runScheduledSwitches(AT)
    expect(getState().scheduledSwitches[0]?.status).toBe('failed')
    expect(spy.sent[0]).toContain('切り替えられませんでした')
  })
})
