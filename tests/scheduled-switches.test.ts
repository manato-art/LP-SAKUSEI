/**
 * 配信の切り替え予約（2026-09-16・本人の依頼）。
 *
 * 「9/30 23:59 にセールLPから通常LPへ」「明日9時に配信開始」を予約できるようにする。
 * 既存の「Versionオプション設定 → 日付別・時間別」は日単位・毎日くり返しなので、
 * **日時ちょうど（分単位）の切り替え**はそれでは表せない。その足りない部分だけを足す。
 *
 * 仕組みは「決めた日時に、配信割合をこの値にする」の1つだけ。
 *   開始＝0%→100% ／ 停止＝→0% ／ 切り替え＝A 100%→0%・B 0%→100%
 * （配信割合0%のVersionは絶対に配信しない＝既存の決まり）
 */
import { describe, expect, it } from 'vitest'
import {
  applySwitch,
  dueSwitches,
  validateSwitchInput,
  type ScheduledSwitch,
} from '../mock-server/store/scheduled-switches.ts'
import { createEmptyState } from '../mock-server/store/seed-empty.ts'
import type { State } from '../mock-server/store/types.ts'

const NOW = '2026-09-16T12:00'

function stateWith(versions: { uid: string; name: string; ratio: number; archived?: boolean }[]): State {
  const base = createEmptyState()
  return {
    ...base,
    abTests: [{ ...(base.abTests[0] ?? ({} as never)), id: 1, uid: 'AB1', title: '本命LP' } as never],
    articles: [{ id: 11, uid: 'ART1', ab_test_id: 1, memo: '', archived: false, style_applied: false, created_at: 0, updated_timestamp: 0 }],
    versions: versions.map(
      (v, i) =>
        ({
          ...(base.versions[0] ?? ({} as never)),
          id: 100 + i,
          uid: v.uid,
          name: v.name,
          article_id: 11,
          distribution_ratio: v.ratio,
          archived: v.archived ?? false,
        }) as never,
    ),
  }
}

const twoVersions = stateWith([
  { uid: 'SALE', name: 'セールLP', ratio: 100 },
  { uid: 'NORMAL', name: '通常LP', ratio: 0 },
])

const switchTo = (ratios: Record<string, number>, runAt = '2026-09-30T23:59') => ({
  run_at: runAt,
  ratios: Object.entries(ratios).map(([version_uid, ratio]) => ({ version_uid, ratio })),
})

describe('予約を受け付ける', () => {
  it('未来の日時で、そのステップの全Versionの割合が合計100%なら受け付ける', () => {
    const out = validateSwitchInput(twoVersions, 'ART1', switchTo({ SALE: 0, NORMAL: 100 }), NOW)
    expect(out).toEqual({ ok: true, value: switchTo({ SALE: 0, NORMAL: 100 }) })
  })

  it('全部0%（配信を止める）も受け付ける', () => {
    expect(validateSwitchInput(twoVersions, 'ART1', switchTo({ SALE: 0, NORMAL: 0 }), NOW).ok).toBe(true)
  })

  it('合計が100%でも0%でもなければ受け付けない（中途半端な配信になる）', () => {
    const out = validateSwitchInput(twoVersions, 'ART1', switchTo({ SALE: 30, NORMAL: 30 }), NOW)
    expect(out.ok).toBe(false)
  })

  it('過去や今の日時は受け付けない（すぐ実行されて予約の意味が無い）', () => {
    expect(validateSwitchInput(twoVersions, 'ART1', switchTo({ SALE: 0, NORMAL: 100 }, NOW), NOW).ok).toBe(false)
    expect(validateSwitchInput(twoVersions, 'ART1', switchTo({ SALE: 0, NORMAL: 100 }, '2026-09-01T09:00'), NOW).ok).toBe(false)
  })

  it('日時の形がおかしければ受け付けない', () => {
    expect(validateSwitchInput(twoVersions, 'ART1', switchTo({ SALE: 0, NORMAL: 100 }, '9/30 23:59'), NOW).ok).toBe(false)
  })

  it('そのステップのVersionが1つでも抜けていたら受け付けない（切り替え後の状態が決まらない）', () => {
    expect(validateSwitchInput(twoVersions, 'ART1', switchTo({ NORMAL: 100 }), NOW).ok).toBe(false)
  })

  it('別のステップのVersionや、知らないVersionは受け付けない', () => {
    expect(validateSwitchInput(twoVersions, 'ART1', switchTo({ SALE: 0, NORMAL: 100, OTHER: 0 }), NOW).ok).toBe(false)
  })

  it('アーカイブ済みのVersionは数えない（入れなくてよい）', () => {
    const state = stateWith([
      { uid: 'SALE', name: 'セールLP', ratio: 100 },
      { uid: 'NORMAL', name: '通常LP', ratio: 0 },
      { uid: 'OLD', name: '旧LP', ratio: 0, archived: true },
    ])
    expect(validateSwitchInput(state, 'ART1', switchTo({ SALE: 0, NORMAL: 100 }), NOW).ok).toBe(true)
  })

  it('割合は0〜100の整数だけ', () => {
    expect(validateSwitchInput(twoVersions, 'ART1', switchTo({ SALE: -10, NORMAL: 110 }), NOW).ok).toBe(false)
    expect(validateSwitchInput(twoVersions, 'ART1', switchTo({ SALE: 0.5, NORMAL: 99.5 }), NOW).ok).toBe(false)
  })
})

function pending(patch: Partial<ScheduledSwitch> = {}): ScheduledSwitch {
  return {
    uid: 'SW1',
    article_uid: 'ART1',
    ...switchTo({ SALE: 0, NORMAL: 100 }),
    status: 'pending',
    note: '',
    created_at: 0,
    done_at: null,
    ...patch,
  }
}

describe('実行する時刻が来たか', () => {
  it('予約の日時を過ぎた、まだ実行していない予約だけ', () => {
    const switches = [
      pending({ uid: 'A', run_at: '2026-09-16T11:59' }),
      pending({ uid: 'B', run_at: '2026-09-16T12:00' }),
      pending({ uid: 'C', run_at: '2026-09-16T12:01' }),
      pending({ uid: 'D', run_at: '2026-09-16T11:00', status: 'done' }),
      pending({ uid: 'E', run_at: '2026-09-16T11:00', status: 'canceled' }),
    ]
    expect(dueSwitches(switches, NOW).map((s) => s.uid)).toEqual(['A', 'B'])
  })
})

describe('切り替える', () => {
  it('配信割合を予約どおりにして、予約を「完了」にする', () => {
    const state = { ...twoVersions, scheduledSwitches: [pending()] }
    const out = applySwitch(state, 'SW1', '2026-09-30T23:59')

    expect(out.outcome).toBe('done')
    expect(out.state.versions.map((v) => [v.uid, v.distribution_ratio])).toEqual([
      ['SALE', 0],
      ['NORMAL', 100],
    ])
    expect(out.state.scheduledSwitches[0]).toMatchObject({ status: 'done', done_at: '2026-09-30T23:59' })
    expect(out.changes).toEqual([
      { name: 'セールLP', before: 100, after: 0 },
      { name: '通常LP', before: 0, after: 100 },
    ])
  })

  it('元の状態は書き換えない', () => {
    const state = { ...twoVersions, scheduledSwitches: [pending()] }
    applySwitch(state, 'SW1', '2026-09-30T23:59')
    expect(state.versions.map((v) => v.distribution_ratio)).toEqual([100, 0])
    expect(state.scheduledSwitches[0]?.status).toBe('pending')
  })

  it('予約したVersionが消えていたら、何も変えずに「実行できなかった」にする（半分だけ切り替えない）', () => {
    const state = {
      ...stateWith([{ uid: 'SALE', name: 'セールLP', ratio: 100 }]),
      scheduledSwitches: [pending()],
    }
    const out = applySwitch(state, 'SW1', '2026-09-30T23:59')
    expect(out.outcome).toBe('failed')
    expect(out.state.versions[0]?.distribution_ratio).toBe(100)
    expect(out.state.scheduledSwitches[0]?.status).toBe('failed')
    expect(out.state.scheduledSwitches[0]?.note).toContain('見つかりません')
  })

  it('サーバーが止まっていて予定より遅れたときは、遅れて実行したと書く', () => {
    const state = { ...twoVersions, scheduledSwitches: [pending({ run_at: '2026-09-30T23:59' })] }
    const out = applySwitch(state, 'SW1', '2026-10-01T00:30')
    expect(out.outcome).toBe('done')
    expect(out.state.scheduledSwitches[0]?.note).toContain('遅れ')
  })

  it('すでに実行した予約は二度実行しない', () => {
    const state = { ...twoVersions, scheduledSwitches: [pending({ status: 'done' })] }
    const out = applySwitch(state, 'SW1', '2026-09-30T23:59')
    expect(out.outcome).toBe('skipped')
    expect(out.state).toBe(state)
  })
})
