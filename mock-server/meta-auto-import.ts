/**
 * Meta の配信金額の自動取り込み（2026-09-24・点検32・E「Meta費用の自動取り込み」）。
 *
 * 以前は配信金額が「手で押した取り込み」でしか入らず、CPA上限のお知らせが実質鳴らなかった。
 * 見張り（task-runner・30秒ごと）に相乗りし、Meta と紐付いたページを**1時間に1回**、
 * 昨日と今日のぶん（JST）取り込む。Meta の前日の数字は後から確定していくので昨日も取り直す。
 *
 * 取り込みは手で押す取り込みと同じ道（meta-sync.ts）を通す。
 * 失敗は取り込み記録（mediaImports・画面の「広告データ取得日時」に出る）と
 * サーバーのログの両方に残す（黙って捨てない）。
 */
import { jstNow } from './lib/jst.ts'
import { fetchMetaInsights } from './meta-insights.ts'
import { syncMetaMedia } from './meta-sync.ts'
import { getState } from './store/store.ts'

/** 同じページを取り込み直すまでの間隔 */
export const META_AUTO_IMPORT_INTERVAL_MS = 60 * 60 * 1000

/** 取り込み中のページ（見張りが重なっても同じページを同時に取りに行かない） */
const inFlight = new Set<string>()

/**
 * 取り込むべきページを取り込む。取り込みに行ったページ数を返す。
 * @param nowMs 今（UNIXミリ秒）
 * @param fetcher テストで外へ取りに行かないために差し替える
 */
export async function runMetaAutoImport(
  nowMs: number = Date.now(),
  fetcher: typeof fetchMetaInsights = fetchMetaInsights,
): Promise<number> {
  const state = getState()
  const today = jstNow(new Date(nowMs)).date
  const yesterday = jstNow(new Date(nowMs - 86_400_000)).date
  const due = state.abTests.filter((page) => {
    if (page.meta_level === undefined || (page.meta_object_id ?? '') === '') return false
    if (inFlight.has(page.uid)) return false
    const last = state.mediaImports.find((r) => r.ab_test_uid === page.uid && r.source === 'meta')
    // 手で取り込んだ直後も含めて、1時間以内に取りに行ったページは待つ（失敗したときも同じ・叩き続けない）
    return last === undefined || nowMs - last.last_attempt_at >= META_AUTO_IMPORT_INTERVAL_MS
  })
  for (const page of due) {
    inFlight.add(page.uid)
    try {
      const result = await syncMetaMedia({
        abTestUid: page.uid,
        since: yesterday,
        until: today,
        trigger: 'auto',
        fetcher,
        at: nowMs,
      })
      if (!result.ok) {
        console.error(`[meta-auto-import] ${page.uid} を取り込めませんでした: ${result.message}`)
      }
    } finally {
      inFlight.delete(page.uid)
    }
  }
  return due.length
}
