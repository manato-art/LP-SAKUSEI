/**
 * お知らせのテスト（2026-09-17・本人の依頼「これのテストしたい」）。
 *
 * 本番のページや数字に触れずに、お知らせがどう届くかを確かめられるようにする。
 *  - 見本を送る: CV停止・CPA超え・リンク切れ・予約実行の4種類を、「テスト」と明記して1通にまとめて送る。
 *    文面は**本物と同じ組み立て関数から作る**（見本と実物で文面がずれないように）
 *  - いま見張っている対象: CVを見ているページ・リンクの本数・これからの予約の数。
 *    以前「実は何も見張っていなかった」不具合があったので、見張り先が本番のページに向いていることを画面で確かめる
 */
import { describe, expect, it } from 'vitest'
import { alertCoverage, buildAlertSamples } from '../mock-server/alert-test.ts'
import { createEmptyState } from '../mock-server/store/seed-empty.ts'
import type { State } from '../mock-server/store/types.ts'

/** 2026-09-17 12:00 JST */
const NOW_MS = Date.UTC(2026, 8, 17, 3, 0)

describe('見本の文面', () => {
  const text = buildAlertSamples({ cv_silent_hours: 12, cpa_limit: 8000 }, NOW_MS)

  it('テストであることを先頭に書く（本物の異常と取り違えない）', () => {
    expect(text.split('\n')[0]).toContain('テスト')
    expect(text).toContain('実際の異常ではありません')
  })

  it('4種類の本物と同じ見出しが入っている', () => {
    expect(text).toContain('【CVが止まっています】')
    expect(text).toContain('【CPAが上限を超えました】')
    expect(text).toContain('【リンクが開けません】')
    expect(text).toContain('【予約どおり切り替えました】')
  })

  it('今の設定の時間と上限で書く（届いたときの見え方をそのまま確かめられる）', () => {
    expect(text).toContain('直近12時間')
    expect(text).toContain('上限 8,000円')
  })

  it('CPAの上限が0（見ていない）でも、例の上限を置いて見本は出す', () => {
    const zero = buildAlertSamples({ cv_silent_hours: 6, cpa_limit: 0 }, NOW_MS)
    expect(zero).toContain('【CPAが上限を超えました】')
    expect(zero).toMatch(/上限 [\d,]+円/)
  })

  it('LINEの1通の上限（5000文字）に収まる', () => {
    expect(text.length).toBeLessThan(5000)
  })
})

describe('いま見張っている対象', () => {
  const DAY = 24 * 3600

  function state(): State {
    const base = createEmptyState()
    const now = Math.floor(NOW_MS / 1000)
    return {
      ...base,
      abTests: [
        { ...(base.abTests[0] ?? ({} as never)), id: 1, uid: 'LIVE', title: '本命LP', ad_status: 'prepared' } as never,
        { ...(base.abTests[0] ?? ({} as never)), id: 2, uid: 'OLD', title: '昔のLP', ad_status: 'prepared' } as never,
        { ...(base.abTests[0] ?? ({} as never)), id: 3, uid: 'DONE', title: '終わったLP', ad_status: 'finished' } as never,
      ],
      articles: [{ id: 11, uid: 'ART1', ab_test_id: 1, memo: '', archived: false, style_applied: false, created_at: 0, updated_timestamp: 0 }],
      versions: [
        {
          ...(base.versions[0] ?? ({} as never)),
          id: 101,
          uid: 'V1',
          article_id: 11,
          status: '公開中',
          distribution_ratio: 100,
          archived: false,
          html: '<a href="https://shop.example.test/cart?sb_tracking=true">買う</a><a href="https://form.example.test/apply?sb_tracking=true">申込</a>',
        } as never,
      ],
      conversions: [
        { id: 1, uid: 'C1', ab_test_uid: 'LIVE', version_uid: '', media_id: null, amount: 0, occurred_at: now - 2 * 3600, status: 'counted' },
        { id: 2, uid: 'C2', ab_test_uid: 'OLD', version_uid: '', media_id: null, amount: 0, occurred_at: now - 30 * DAY, status: 'counted' },
        { id: 3, uid: 'C3', ab_test_uid: 'DONE', version_uid: '', media_id: null, amount: 0, occurred_at: now - 3600, status: 'counted' },
      ],
      metrics: [{ entity_uid: 'LIVE', scope: 'ab_test', date: '2026-09-17', pv: 50, click: 5, cv: 1, ad_cost: 0, sales: 0 }],
      scheduledSwitches: [
        { uid: 'S1', article_uid: 'ART1', run_at: '2026-09-30T23:59', ratios: [], status: 'pending', note: '', created_at: 0, done_at: null },
        { uid: 'S2', article_uid: 'ART1', run_at: '2026-09-01T09:00', ratios: [], status: 'done', note: '', created_at: 0, done_at: '2026-09-01T09:00' },
      ],
      alertSetting: { enabled: false, cv_silent_hours: 6, cpa_limit: 0, link_check: true, notify: [{ service: 'line', destination_id: '' }] },
    }
  }

  it('CVを見ているのは、直近7日にCVがあって「停止中」「終了」でないページ', () => {
    expect(alertCoverage(state(), NOW_MS).cv_pages).toEqual(['本命LP'])
  })

  it('リンクは、直近7日に見られているページの計測リンクの本数', () => {
    const coverage = alertCoverage(state(), NOW_MS)
    expect(coverage.link_pages).toBe(1)
    expect(coverage.link_count).toBe(2)
  })

  it('これからの予約の数（実行済みは数えない）', () => {
    expect(alertCoverage(state(), NOW_MS).pending_switches).toBe(1)
  })

  it('設定の状態もそのまま返す（切のままだと鳴らないことが分かるように）', () => {
    expect(alertCoverage(state(), NOW_MS)).toMatchObject({ enabled: false, destinations: 1, cpa_limit: 0, link_check: true })
  })
})
