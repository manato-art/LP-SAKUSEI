/**
 * 除いたボットの件数（2026-09-16・本人の依頼）。
 *
 * 「ボットは含めていません」と画面に出すだけだと、本当に除けているのか確かめようがない。
 * 期間内に除いた件数を添えて出すために、ページ×日ごとに数えておく。
 * 数えるのは表示（pv）のときだけ（クリックやヒートマップの送信で二重に数えない）。
 */
import { isWithin, toDateKey } from './metrics.ts'

export interface BotHit {
  ab_test_uid: string
  /** JSTの日付（YYYY-MM-DD） */
  date: string
  count: number
}

/** 持っておく日数。レポートの期間ボタンが最長1年なので、少し余裕を持たせる */
export const BOT_HIT_DAYS = 400

/** 1件足す（同じページ・同じ日は1行に足し込む）。古い行はここで捨てる。 */
export function recordBotHit(
  hits: readonly BotHit[],
  abTestUid: string,
  date: string,
): BotHit[] {
  const limit = new Date(`${date}T00:00:00Z`)
  limit.setUTCDate(limit.getUTCDate() - BOT_HIT_DAYS)
  const oldest = toDateKey(limit)
  const kept = hits.filter((h) => h.date >= oldest)
  const found = kept.some((h) => h.ab_test_uid === abTestUid && h.date === date)
  return found
    ? kept.map((h) =>
        h.ab_test_uid === abTestUid && h.date === date ? { ...h, count: h.count + 1 } : h,
      )
    : [...kept, { ab_test_uid: abTestUid, date, count: 1 }]
}

/** 期間内に除いた件数。ページを指定しなければ全ページぶん（両端を含む） */
export function botHitCount(
  hits: readonly BotHit[],
  filter: { abTestUids?: readonly string[]; start: string; end: string },
): number {
  const pages = filter.abTestUids === undefined ? null : new Set(filter.abTestUids)
  return hits
    .filter((h) => (pages === null || pages.has(h.ab_test_uid)) && isWithin(h.date, filter.start, filter.end))
    .reduce((sum, h) => sum + h.count, 0)
}
