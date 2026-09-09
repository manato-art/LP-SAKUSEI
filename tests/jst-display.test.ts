import { describe, it, expect } from 'vitest'

/**
 * 画面に出る日時は、見ている場所に関係なく**日本時間**で出す。
 *
 * サーバーは記録も集計もJSTで日付を切る（mock-server/store/metrics.ts）。
 * 画面がブラウザのローカル時刻で組み立てると、
 * 本番(Railway=UTC)や海外から開いたときに時刻が9時間ずれる。
 *
 * このテストは vitest.config.ts の設定で TZ=UTC で走る（＝本番と同じ条件）。
 */
describe('画面に出す日時（JST固定）', () => {
  it('日本時間の朝8時は「8時」と出す', async () => {
    const { jstParts } = await import('../src/app/jst.ts')
    // 2026-09-09 08:00:00 JST = 2026-09-08 23:00:00 UTC
    const p = jstParts(new Date('2026-09-08T23:00:00Z'))
    expect(p).toEqual({ year: 2026, month: 9, day: 9, hour: 8, minute: 0, second: 0 })
  })

  it('日本時間の深夜0時台も、その日として扱う', async () => {
    const { jstParts, jstDateKey } = await import('../src/app/jst.ts')
    // 2026-09-09 00:30:15 JST = 2026-09-08 15:30:15 UTC
    const at = new Date('2026-09-08T15:30:15Z')
    expect(jstParts(at)).toEqual({ year: 2026, month: 9, day: 9, hour: 0, minute: 30, second: 15 })
    expect(jstDateKey(at)).toBe('2026-09-09')
  })

  it('サーバー側の日付キーと必ず一致する', async () => {
    const { jstDateKey } = await import('../src/app/jst.ts')
    const { toDateKey } = await import('../mock-server/store/metrics.ts')
    for (let h = 0; h < 24; h++) {
      const t = new Date(Date.UTC(2026, 8, 9, h, 0, 0))
      expect(jstDateKey(t)).toBe(toDateKey(t))
    }
  })
})

describe('各画面の日時表示', () => {
  // 2026-09-09 08:05:07 JST = 2026-09-08 23:05:07 UTC
  const morning = new Date('2026-09-08T23:05:07Z')

  it('ページ詳細パネルの「2026年9月9日 8時05分」', async () => {
    const { formatAbsoluteTime } = await import('../src/app/pages/folders-detail-panel.ts')
    expect(formatAbsoluteTime(Math.floor(morning.getTime() / 1000))).toBe('2026年9月9日 8時05分')
  })

  it('エディタの保存時刻「08:05」（12時間より前は時刻表示）', async () => {
    const { formatSaveTime } = await import('../src/app/pages/editor-layout.ts')
    // 必ず「12時間以上前」の分岐に入るよう、十分に古い日時を渡す
    // 2020-01-15 08:05 JST = 2020-01-14 23:05 UTC
    expect(formatSaveTime(new Date('2020-01-14T23:05:00Z'))).toBe('08:05')
  })

  it('CV発生時刻「2026/09/09 08:05:07」', async () => {
    const { cvTime } = await import('../src/app/pages/sidebar-data.ts')
    expect(cvTime(Math.floor(morning.getTime() / 1000))).toBe('2026/09/09 08:05:07')
  })

  it('履歴の日付「1/15」（7日より前は絶対日付）', async () => {
    const { formatTimestamp } = await import('../src/app/pages/folders-history.ts')
    // 2020-01-15 08:05 JST = 2020-01-14 23:05 UTC
    expect(formatTimestamp(new Date('2020-01-14T23:05:00Z').getTime())).toBe('1/15')
  })
})

/**
 * 日付文字列 → 計算 → 日付文字列 の往復。
 *
 * `new Date('2026-09-09T00:00:00')` はタイムゾーン指定が無いと**ローカル時刻**として
 * 解釈される。日付キーをJSTに固定した以上、ここでローカル解釈を挟むと1日ずれる。
 */
describe('期間の計算（文字列の往復）', () => {
  it('直前の同じ日数の期間が1日ずれない', async () => {
    const { previousRange } = await import('../src/app/pages/report-v2.ts')
    // 9/3〜9/9（7日間）の直前は 8/27〜9/2
    expect(previousRange({ startDate: '2026-09-03', endDate: '2026-09-09' })).toEqual({
      startDate: '2026-08-27',
      endDate: '2026-09-02',
    })
  })

  it('1日だけの期間の直前は、その前日', async () => {
    const { previousRange } = await import('../src/app/pages/report-v2.ts')
    expect(previousRange({ startDate: '2026-09-09', endDate: '2026-09-09' })).toEqual({
      startDate: '2026-09-08',
      endDate: '2026-09-08',
    })
  })

  it('月をまたいでもずれない', async () => {
    const { previousRange } = await import('../src/app/pages/report-v2.ts')
    // 3月は31日 → 直前の31日間は 1/29〜2/28（2026年の2月は28日まで）
    expect(previousRange({ startDate: '2026-03-01', endDate: '2026-03-31' })).toEqual({
      startDate: '2026-01-29',
      endDate: '2026-02-28',
    })
  })
})

describe('ダッシュボードの期間', () => {
  it('「今月」の起点が、日本時間の月初になる', async () => {
    const { dashboardRange } = await import('../src/app/pages/sidebar-data.ts')
    // 2026-09-01 00:30 JST = 2026-08-31 15:30 UTC（UTCではまだ8月）
    const at = new Date('2026-08-31T15:30:00Z')
    expect(dashboardRange(-1, at).startDate).toBe('2026-09-01')
  })

  it('「過去7日」も日本時間の日付で問い合わせる', async () => {
    const { dashboardRange } = await import('../src/app/pages/sidebar-data.ts')
    // 2026-09-09 08:00 JST = 2026-09-08 23:00 UTC
    const at = new Date('2026-09-08T23:00:00Z')
    expect(dashboardRange(7, at).endDate).toBe('2026-09-09')
  })
})
