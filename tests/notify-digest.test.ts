/**
 * 通知設定の「CV発生通知」「デイリーレポート」を実際に動かす（2026-09-24 点検28）。
 *
 * 以前は保存されるだけで、どこからも読まれていなかった。
 *  - CV発生通知: 新しいCVを15分に1通までにまとめ、ページごとの件数を送る（LINEは月200通の枠なので1件ずつ送らない）
 *  - デイリーレポート: 毎朝9時（JST）に前日の PV / CLICK / CV / CVR / 配信金額 をページごとに1通で（数字があったページだけ）
 *  - 送り先は「異常のお知らせ」の送り先（notifyList）
 *  - 以前の保存値（cv_notify=true）は何もしていなかったので、動くスイッチは新しい値（既定オフ）
 */
import { describe, expect, it } from 'vitest'
import { cvDigest, dailyDigest, EMPTY_NOTIFICATION_RUNS } from '../mock-server/notify-digest.ts'
import { jstNow } from '../mock-server/lib/jst.ts'

// 2026-09-24 12:00 JST
const NOW_MS = Date.UTC(2026, 8, 24, 3, 0)
const NOW = Math.floor(NOW_MS / 1000)
const pages = [
  { uid: 'AB1', title: '本命LP' },
  { uid: 'AB2', title: 'サブLP' },
]

describe('CV発生通知（15分に1通までにまとめる）', () => {
  it('はじめて動くときは、それまでのCVを送らずに目印だけ置く', () => {
    const out = cvDigest({
      now: NOW,
      isOn: true,
      pages,
      conversions: [{ id: 10, ab_test_uid: 'AB1', occurred_at: NOW - 60 }],
      runs: EMPTY_NOTIFICATION_RUNS,
    })
    expect(out.message).toBeNull()
    expect(out.runs.cv_max_id).toBe(10)
  })

  it('新しいCVをページごとの件数にまとめて1通にする', () => {
    const out = cvDigest({
      now: NOW,
      isOn: true,
      pages,
      conversions: [
        { id: 13, ab_test_uid: 'AB2', occurred_at: NOW - 30 },
        { id: 12, ab_test_uid: 'AB1', occurred_at: NOW - 40 },
        { id: 11, ab_test_uid: 'AB1', occurred_at: NOW - 50 },
        { id: 10, ab_test_uid: 'AB1', occurred_at: NOW - 3600 },
      ],
      runs: { ...EMPTY_NOTIFICATION_RUNS, cv_max_id: 10, cv_last_sent_at: NOW - 16 * 60 },
    })
    expect(out.message).toBe('【新しいCV 3件】\n本命LP 2件\nサブLP 1件')
    expect(out.runs.cv_max_id).toBe(13)
    expect(out.runs.cv_last_sent_at).toBe(NOW)
  })

  it('前に送ってから15分たっていなければ送らない（CVは次にまとめて送る）', () => {
    const out = cvDigest({
      now: NOW,
      isOn: true,
      pages,
      conversions: [{ id: 11, ab_test_uid: 'AB1', occurred_at: NOW - 30 }],
      runs: { ...EMPTY_NOTIFICATION_RUNS, cv_max_id: 10, cv_last_sent_at: NOW - 5 * 60 },
    })
    expect(out.message).toBeNull()
    expect(out.runs.cv_max_id).toBe(10)
  })

  it('新しいCVが無ければ送らない', () => {
    const out = cvDigest({
      now: NOW,
      isOn: true,
      pages,
      conversions: [{ id: 10, ab_test_uid: 'AB1', occurred_at: NOW - 3600 }],
      runs: { ...EMPTY_NOTIFICATION_RUNS, cv_max_id: 10, cv_last_sent_at: null },
    })
    expect(out.message).toBeNull()
  })

  it('切っているあいだのCVは、あとでオンにしても送らない（目印を進めておく）', () => {
    const out = cvDigest({
      now: NOW,
      isOn: false,
      pages,
      conversions: [{ id: 20, ab_test_uid: 'AB1', occurred_at: NOW - 30 }],
      runs: { ...EMPTY_NOTIFICATION_RUNS, cv_max_id: 10 },
    })
    expect(out.message).toBeNull()
    expect(out.runs.cv_max_id).toBe(20)
  })
})

describe('デイリーレポート（毎朝9時に前日ぶん）', () => {
  const metrics = [
    { entity_uid: 'AB1', scope: 'ab_test' as const, date: '2026-09-23', pv: 1000, click: 120, cv: 6, ad_cost: 30000, sales: 0 },
    { entity_uid: 'AB2', scope: 'ab_test' as const, date: '2026-09-23', pv: 0, click: 0, cv: 0, ad_cost: 0, sales: 0 },
    { entity_uid: 'AB1', scope: 'ab_test' as const, date: '2026-09-24', pv: 50, click: 5, cv: 1, ad_cost: 0, sales: 0 },
  ]

  it('9時を過ぎたら前日ぶんを1通（数字があったページだけ）', () => {
    const out = dailyDigest({ now: jstNow(new Date(NOW_MS)), isOn: true, pages, metrics, runs: EMPTY_NOTIFICATION_RUNS })
    expect(out.message).toBe(
      '【デイリーレポート】2026-09-23\n本命LP｜PV 1,000 / CLICK 120 / CV 6 / CVR 5.00% / 配信金額 30,000円',
    )
    expect(out.runs.daily_sent_for).toBe('2026-09-24')
  })

  it('同じ日に二度送らない', () => {
    const out = dailyDigest({
      now: jstNow(new Date(NOW_MS)),
      isOn: true,
      pages,
      metrics,
      runs: { ...EMPTY_NOTIFICATION_RUNS, daily_sent_for: '2026-09-24' },
    })
    expect(out.message).toBeNull()
  })

  it('9時前は送らない', () => {
    // 2026-09-24 08:30 JST
    const early = jstNow(new Date(Date.UTC(2026, 8, 23, 23, 30)))
    expect(dailyDigest({ now: early, isOn: true, pages, metrics, runs: EMPTY_NOTIFICATION_RUNS }).message).toBeNull()
  })

  it('前日に数字のあるページが無ければ送らない（その日は送ったことにする）', () => {
    const out = dailyDigest({ now: jstNow(new Date(NOW_MS)), isOn: true, pages, metrics: [], runs: EMPTY_NOTIFICATION_RUNS })
    expect(out.message).toBeNull()
    expect(out.runs.daily_sent_for).toBe('2026-09-24')
  })

  it('切っていれば送らない', () => {
    expect(
      dailyDigest({ now: jstNow(new Date(NOW_MS)), isOn: false, pages, metrics, runs: EMPTY_NOTIFICATION_RUNS }).message,
    ).toBeNull()
  })
})
