/**
 * Meta の配信金額を自動で取り込む（2026-09-24 点検32・E）。
 *
 * 以前は配信金額が「手で押した取り込み」でしか入らず、CPA上限のお知らせが実質鳴らなかった。
 * 見張り（task-runner）が1時間に1回、Meta と紐付いたページの昨日と今日を取り込む。
 * 手で押す取り込みと同じ道（meta-sync.ts）を通す。失敗は取り込み記録に理由ごと残す（黙って捨てない）。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getState, resetState, setState } from '../mock-server/store/store.ts'
import { runMetaAutoImport } from '../mock-server/meta-auto-import.ts'
import { createAbTest } from '../mock-server/store/actions.ts'
import type { MetaFetchResult } from '../mock-server/meta-insights.ts'

const NOW = Date.UTC(2026, 8, 24, 3, 0) // 2026-09-24 12:00 JST
let PAGE = ''

function seedPage(linked: boolean): void {
  setState((s) => {
    const out = createAbTest(s, { title: 'Meta紐付けページ', memo: '', media_id: 1, folder_id: null })
    PAGE = out.abTest.uid
    return {
      ...out.state,
      abTests: out.state.abTests.map((t) =>
        t.uid === PAGE && linked ? { ...t, meta_level: 'campaign' as const, meta_object_id: '1234567890' } : t,
      ),
    }
  })
}

beforeEach(() => {
  resetState()
})

describe('Meta の自動取り込み', () => {
  it('紐付いたページの昨日と今日を取り込み、配信金額に入れる', async () => {
    seedPage(true)
    const fetcher = vi.fn(
      async (): Promise<MetaFetchResult> => ({
        ok: true,
        rows: [{ date: '2026-09-24', ad_cost: 4200, imp: 900, media_click: 30, media_cv: 1 }],
      }),
    )
    const count = await runMetaAutoImport(NOW, fetcher)
    expect(count).toBe(1)
    expect(fetcher).toHaveBeenCalledWith({ level: 'campaign', objectId: '1234567890', since: '2026-09-23', until: '2026-09-24' })
    const row = getState().metrics.find((m) => m.entity_uid === PAGE && m.date === '2026-09-24')
    expect(row?.ad_cost).toBe(4200)
    const record = getState().mediaImports.find((r) => r.ab_test_uid === PAGE)
    expect(record).toMatchObject({ source: 'meta', trigger: 'auto', last_error: null, last_days: 1 })
  })

  it('紐付いていないページは取りに行かない', async () => {
    seedPage(false)
    const fetcher = vi.fn(async (): Promise<MetaFetchResult> => ({ ok: true, rows: [] }))
    expect(await runMetaAutoImport(NOW, fetcher)).toBe(0)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('1時間以内に取り込んだページはもう一度取りに行かない', async () => {
    seedPage(true)
    const fetcher = vi.fn(async (): Promise<MetaFetchResult> => ({ ok: true, rows: [] }))
    await runMetaAutoImport(NOW, fetcher)
    await runMetaAutoImport(NOW + 30 * 60 * 1000, fetcher)
    expect(fetcher).toHaveBeenCalledTimes(1)
    await runMetaAutoImport(NOW + 61 * 60 * 1000, fetcher)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('失敗したら理由を取り込み記録に残す（例外で見張りを止めない）', async () => {
    seedPage(true)
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const fetcher = vi.fn(
      async (): Promise<MetaFetchResult> => ({ ok: false, reason: 'request_failed', message: 'Meta API 500: boom' }),
    )
    await runMetaAutoImport(NOW, fetcher)
    const record = getState().mediaImports.find((r) => r.ab_test_uid === PAGE)
    expect(record?.last_error).toBe('Meta API 500: boom')
    expect(record?.last_success_at).toBeNull()
    expect(errors).toHaveBeenCalled()
    errors.mockRestore()
  })
})
