/**
 * 異常のお知らせを**複数の送り先**へ配る（2026-09-15・本人の依頼）。
 *
 * 「チャットワークとLINEにも飛ばしたい」＝送り先は1つではない。
 * 1つへ送れなくても、残りへは必ず届くようにする（届かないことは画面では追えない）。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AlertNotify } from '../mock-server/alerts.ts'

/** 送信は差し替える。条件を確かめるのに本物のSlack/LINEへ投げる必要は無い。 */
const spy = vi.hoisted(() => ({
  sent: [] as { service: string; id: string; text: string }[],
  /** ここに入れたサービスへの送信は失敗させる */
  failing: new Set<string>(),
}))

vi.mock('../mock-server/notify.ts', () => ({
  NotifyError: class NotifyError extends Error {},
  sendNotification: (service: string, id: string, text: string): Promise<void> => {
    spy.sent.push({ service, id, text })
    return spy.failing.has(service)
      ? Promise.reject(new Error(`${service}へ送れませんでした`))
      : Promise.resolve()
  },
}))

const { runAlerts } = await import('../mock-server/task-runner.ts')
const { jstNow } = await import('../mock-server/lib/jst.ts')
const { getState, resetState, setState } = await import('../mock-server/store/store.ts')

const NOW = (): number => Math.floor(Date.now() / 1000)

/** CVが8時間前で止まっている配信中のページを1つ置く */
function seedStoppedPage(notify: AlertNotify[]): void {
  resetState()
  const now = NOW()
  setState((s) => ({
    ...s,
    abTests: [
      {
        ...(s.abTests[0] ?? ({} as never)),
        id: 1,
        team_id: 1,
        uid: 'AB_FANOUT',
        title: '配り先の確認用',
        memo: '',
        media_id: null,
        folder_id: null,
        ad_status: 'delivered',
        editor_version: 2,
        delivery_type: 'same_url',
        conversion_unit_price: 0,
        conversion_setting: { id: 1, conversion_condition: 'click' },
        affiliate_service_provider: null,
        product_genres: [],
        gender: null,
        age_from: null,
        age_to: null,
        archived: false,
        created_at: now,
        updated_at: now,
      } as never,
    ],
    conversions: [
      {
        id: 1,
        uid: 'CV_1',
        ab_test_uid: 'AB_FANOUT',
        version_uid: '',
        media_id: null,
        amount: 0,
        occurred_at: now - 8 * 3600,
        status: 'counted',
      },
    ],
    alertSetting: { enabled: true, cv_silent_hours: 6, cpa_limit: 0, notify },
    alertSentSlots: [],
  }))
}

beforeEach(() => {
  spy.sent.length = 0
  spy.failing.clear()
})

describe('複数の送り先へ配る', () => {
  it('決めた送り先すべてへ同じ知らせを送る', async () => {
    seedStoppedPage([
      { service: 'chatwork', destination_id: '123456' },
      { service: 'line', destination_id: '' },
    ])

    expect(await runAlerts(jstNow())).toBe(1)
    expect(spy.sent.map((s) => s.service)).toEqual(['chatwork', 'line'])
    expect(new Set(spy.sent.map((s) => s.text)).size, '本文は同じ').toBe(1)
    expect(spy.sent[0]?.text).toContain('CVが止まっています')
  })

  it('1つへ送れなくても残りへは送る', async () => {
    spy.failing.add('chatwork')
    seedStoppedPage([
      { service: 'chatwork', destination_id: '123456' },
      { service: 'line', destination_id: '' },
    ])

    await runAlerts(jstNow())
    expect(spy.sent.map((s) => s.service)).toEqual(['chatwork', 'line'])
  })

  it('送り先が無ければ何もしない（記録も残さない＝決めた後に鳴る）', async () => {
    seedStoppedPage([])

    expect(await runAlerts(jstNow())).toBe(0)
    expect(spy.sent).toHaveLength(0)
    expect(getState().alertSentSlots).toHaveLength(0)
  })

  it('同じ時間帯に二度回しても、送り先の数にかかわらず1回ぶんだけ', async () => {
    seedStoppedPage([
      { service: 'slack', destination_id: 'C1' },
      { service: 'line', destination_id: 'U1' },
    ])

    await runAlerts(jstNow())
    expect(spy.sent).toHaveLength(2)
    expect(getState().alertSentSlots, '記録は知らせ1件ぶん').toHaveLength(1)

    await runAlerts(jstNow())
    expect(spy.sent, '二度目は送らない').toHaveLength(2)
  })
})
