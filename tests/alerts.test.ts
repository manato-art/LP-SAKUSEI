/**
 * 異常のお知らせ（2026-09-15・本人の依頼）。
 *
 * 配信を回していると、CVが止まったこと・CPAが跳ねたことに自分で画面を見に行くまで
 * 気づけない。条件に当たったらSlack（またはチャットワーク）へ1通送る。
 *
 * ⚠️ これは**実物のSquadBeyondには無い**、このシステムだけの機能。
 */
import { describe, expect, it } from 'vitest'
import { findAlerts, type AlertInput } from '../mock-server/alerts.ts'

const HOUR = 3600
/** 2026-09-15 12:00 JST */
const NOW = Math.floor(Date.UTC(2026, 8, 15, 3, 0) / 1000)

function input(patch: Partial<AlertInput> = {}): AlertInput {
  return {
    now: NOW,
    today: '2026-09-15',
    setting: {
      enabled: true,
      cv_silent_hours: 6,
      cpa_limit: 10000,
      notify: { service: 'slack', destination_id: 'C123' },
    },
    pages: [{ uid: 'AB1', title: '本命LP', ad_status: 'delivered' }],
    conversions: [],
    metrics: [],
    sentSlots: [],
    ...patch,
  }
}

describe('CVが止まった', () => {
  it('前は来ていたのに、決めた時間ずっと0件なら知らせる', () => {
    const alerts = findAlerts(
      input({
        // 8時間前に1件。それ以降は無い
        conversions: [{ ab_test_uid: 'AB1', occurred_at: NOW - 8 * HOUR }],
      }),
    )
    expect(alerts.map((a) => a.kind)).toEqual(['cv_stopped'])
    expect(alerts[0]?.message).toContain('本命LP')
    expect(alerts[0]?.message).toContain('6時間')
  })

  it('決めた時間の中にCVがあれば知らせない', () => {
    const alerts = findAlerts(
      input({ conversions: [{ ab_test_uid: 'AB1', occurred_at: NOW - 2 * HOUR }] }),
    )
    expect(alerts).toEqual([])
  })

  it('もともと1件もCVが無いページは知らせない（止まったのではない）', () => {
    expect(findAlerts(input({ conversions: [] }))).toEqual([])
  })

  it('ずっと前（7日より古い）のCVしか無いページも知らせない', () => {
    const alerts = findAlerts(
      input({ conversions: [{ ab_test_uid: 'AB1', occurred_at: NOW - 8 * 24 * HOUR }] }),
    )
    expect(alerts).toEqual([])
  })

  it('配信していないページは見ない', () => {
    const alerts = findAlerts(
      input({
        pages: [{ uid: 'AB1', title: '本命LP', ad_status: 'stopping' }],
        conversions: [{ ab_test_uid: 'AB1', occurred_at: NOW - 8 * HOUR }],
      }),
    )
    expect(alerts).toEqual([])
  })
})

describe('CPAが上がりすぎた', () => {
  it('その日のCPAが上限を超えたら知らせる', () => {
    const alerts = findAlerts(
      input({
        // 30,000円 / 2件 = 15,000円 > 上限10,000円
        metrics: [{ entity_uid: 'AB1', date: '2026-09-15', ad_cost: 30000, cv: 2 }],
        conversions: [{ ab_test_uid: 'AB1', occurred_at: NOW - 1 * HOUR }],
      }),
    )
    expect(alerts.map((a) => a.kind)).toEqual(['cpa_over'])
    expect(alerts[0]?.message).toContain('15,000')
  })

  it('上限以下なら知らせない', () => {
    const alerts = findAlerts(
      input({
        metrics: [{ entity_uid: 'AB1', date: '2026-09-15', ad_cost: 10000, cv: 2 }],
        conversions: [{ ab_test_uid: 'AB1', occurred_at: NOW - 1 * HOUR }],
      }),
    )
    expect(alerts).toEqual([])
  })

  it('CVが0のときは出さない（CPAが出ないだけで、跳ねたのではない）', () => {
    const alerts = findAlerts(
      input({
        metrics: [{ entity_uid: 'AB1', date: '2026-09-15', ad_cost: 30000, cv: 0 }],
      }),
    )
    expect(alerts.map((a) => a.kind)).not.toContain('cpa_over')
  })

  it('上限0は「見ない」', () => {
    const alerts = findAlerts(
      input({
        setting: {
          enabled: true,
          cv_silent_hours: 6,
          cpa_limit: 0,
          notify: { service: 'slack', destination_id: 'C123' },
        },
        metrics: [{ entity_uid: 'AB1', date: '2026-09-15', ad_cost: 999999, cv: 1 }],
        conversions: [{ ab_test_uid: 'AB1', occurred_at: NOW - 1 * HOUR }],
      }),
    )
    expect(alerts).toEqual([])
  })
})

/**
 * 同じページの同じ理由は**1日1回まで**（2026-09-15に1時間に1回から変更・本人の指示）。
 *
 * 1時間に1回だと、CVが丸1日止まっているページ1つで24通使う。
 * LINE公式アカウントの無料枠は月200通なので、数日で使い切って**その月は届かなくなる**。
 * 止まっていることは1日1回知れば足りる。
 */
describe('送りすぎない', () => {
  it('同じページの同じ理由は、同じ日に二度送らない', () => {
    const base = input({ conversions: [{ ab_test_uid: 'AB1', occurred_at: NOW - 8 * HOUR }] })
    const first = findAlerts(base)
    expect(first).toHaveLength(1)
    const again = findAlerts({ ...base, sentSlots: [first[0]?.slot ?? ''] })
    expect(again).toEqual([])
  })

  it('1時間たっても、同じ日のうちは送らない', () => {
    const base = input({ conversions: [{ ab_test_uid: 'AB1', occurred_at: NOW - 8 * HOUR }] })
    const first = findAlerts(base)
    const later = findAlerts({ ...base, now: NOW + HOUR, sentSlots: [first[0]?.slot ?? ''] })
    expect(later, '1日1通に収める').toEqual([])
  })

  it('日付が変われば送る', () => {
    const base = input({ conversions: [{ ab_test_uid: 'AB1', occurred_at: NOW - 8 * HOUR }] })
    const first = findAlerts(base)
    const nextDay = findAlerts({
      ...base,
      now: NOW + 24 * HOUR,
      today: '2026-09-16',
      sentSlots: [first[0]?.slot ?? ''],
    })
    expect(nextDay).toHaveLength(1)
  })

  it('合図に時刻を含めない（含めると時間ごとに鳴る）', () => {
    const base = input({ conversions: [{ ab_test_uid: 'AB1', occurred_at: NOW - 8 * HOUR }] })
    expect(findAlerts(base)[0]?.slot).toBe('AB1|cv_stopped|2026-09-15')
  })
})

describe('止めているとき', () => {
  it('お知らせを切っていれば何も出さない', () => {
    const alerts = findAlerts(
      input({
        setting: { enabled: false, cv_silent_hours: 6, cpa_limit: 10000, notify: { service: 'slack', destination_id: 'C1' } },
        conversions: [{ ab_test_uid: 'AB1', occurred_at: NOW - 8 * HOUR }],
      }),
    )
    expect(alerts).toEqual([])
  })

  it('送り先を決めていなければ何も出さない（送れないのに判定だけしても意味がない）', () => {
    const alerts = findAlerts(
      input({
        setting: { enabled: true, cv_silent_hours: 6, cpa_limit: 10000, notify: null },
        conversions: [{ ab_test_uid: 'AB1', occurred_at: NOW - 8 * HOUR }],
      }),
    )
    expect(alerts).toEqual([])
  })
})

/**
 * 見張りとの繋ぎ込み。
 * Slackと繋いでいなければ送信は失敗するが、**判定と「送った」記録は進む**ことを確かめる
 * （失敗のたびに同じ時間帯で鳴り続けないため）。
 */
describe('見張りから呼ぶ', () => {
  it('当たったぶんだけ数え、同じ時間帯には二度出さない', async () => {
    const { resetState, getState, setState } = await import('../mock-server/store/store.ts')
    const { runAlerts } = await import('../mock-server/task-runner.ts')
    const { jstNow } = await import('../mock-server/lib/jst.ts')

    resetState()
    const nowSec = Math.floor(Date.now() / 1000)
    setState((s) => ({
      ...s,
      abTests: [
        {
          ...(s.abTests[0] ?? ({} as never)),
          id: 1,
          team_id: 1,
          uid: 'AB_ALERT',
          title: '見張りの確認用',
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
          created_at: nowSec,
          updated_at: nowSec,
        } as never,
      ],
      conversions: [
        {
          id: 1,
          uid: 'CV_1',
          ab_test_uid: 'AB_ALERT',
          version_uid: '',
          media_id: null,
          amount: 0,
          // 8時間前＝既定の6時間より前なので「止まった」に当たる
          occurred_at: nowSec - 8 * 3600,
          status: 'counted',
        },
      ],
      alertSetting: {
        enabled: true,
        cv_silent_hours: 6,
        cpa_limit: 0,
        notify: [{ service: 'slack', destination_id: 'C1' }],
      },
      alertSentSlots: [],
    }))

    const first = await runAlerts(jstNow())
    expect(first).toBe(1)
    expect(getState().alertSentSlots).toHaveLength(1)

    // 同じ時間帯にもう一度回しても増えない
    const again = await runAlerts(jstNow())
    expect(again).toBe(0)
    expect(getState().alertSentSlots).toHaveLength(1)
  })
})
