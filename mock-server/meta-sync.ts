/**
 * Meta の媒体実績を1ページぶん取り込む（2026-09-24）。
 *
 * 手で押す取り込み（`POST /ab_tests/:uid/meta_sync`）と、見張りの自動取り込み（task-runner）の
 * **両方がここを通す**（取り込み方を2か所に書かない）。
 * 値は出どころ meta として入る（CSV で入れた他媒体の値は消さない・store/media-sources.ts）。
 * 出どころ不明の古い値は残して足す（Meta から来たか CSV から来たか分からないので消さない）。
 * 結果は成功も失敗も取り込み記録（store/media-imports.ts）に残す。
 */
import { fetchMetaInsights, type MetaFetchResult } from './meta-insights.ts'
import { setMediaMetrics } from './store/media-sources.ts'
import { recordMediaImport } from './store/media-imports.ts'
import { getState, setState } from './store/store.ts'

export type MetaSyncResult =
  | { ok: true; days: number }
  | { ok: false; reason: 'not_linked' | 'no_token' | 'request_failed'; message: string }

export async function syncMetaMedia(input: {
  abTestUid: string
  since: string
  until: string
  trigger: 'manual' | 'auto'
  /** テストで外へ取りに行かないために差し替える */
  fetcher?: typeof fetchMetaInsights
}): Promise<MetaSyncResult> {
  const abTest = getState().abTests.find((t) => t.uid === input.abTestUid)
  const level = abTest?.meta_level
  const objectId = abTest?.meta_object_id ?? ''
  if (abTest === undefined || level === undefined || objectId === '') {
    return { ok: false, reason: 'not_linked', message: 'この beyondページにMeta広告が紐付いていません。' }
  }
  const fetcher = input.fetcher ?? fetchMetaInsights
  const result: MetaFetchResult = await fetcher({ level, objectId, since: input.since, until: input.until })
  const at = Date.now()
  if (!result.ok) {
    setState((s) => ({
      ...s,
      mediaImports: recordMediaImport(s.mediaImports, {
        ab_test_uid: input.abTestUid,
        source: 'meta',
        at,
        trigger: input.trigger,
        ok: false,
        error: result.message,
      }),
    }))
    return { ok: false, reason: result.reason, message: result.message }
  }
  setState((s) => {
    let metrics = s.metrics
    for (const row of result.rows) {
      metrics = setMediaMetrics({ ...s, metrics }, input.abTestUid, 'ab_test', row.date, 'meta', {
        ad_cost: row.ad_cost,
        imp: row.imp,
        media_click: row.media_click,
        media_cv: row.media_cv,
      })
    }
    return {
      ...s,
      metrics,
      mediaImports: recordMediaImport(s.mediaImports, {
        ab_test_uid: input.abTestUid,
        source: 'meta',
        at,
        trigger: input.trigger,
        ok: true,
        days: result.rows.length,
      }),
    }
  })
  return { ok: true, days: result.rows.length }
}
