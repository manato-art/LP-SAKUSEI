/**
 * 本番URLの発行と「90日閲覧なし」の決まり（2026-10-30 本人）。画面とサーバーで同じ決まりを使う。
 *
 *   - 「本番URLは発行ボタンを押さない限り表示しない」「発行するのは、LP編集するページで」
 *   - 発行する前の本番URLは開かない（確かめはプレビューで）・発行できるのは管理者だけ・複製した写しは発行前から
 *   - 札は発行しても準備中のまま、本物の人が初めて見に来たら配信中（mock-server/store/page-visit.ts）
 *   - 「90日以上新規がいなかったら 90日閲覧なし っていうマーク」
 *
 * 前からあるページ（issued の項目が無い）は発行済みとして扱う（配信中の広告のURLを止めない）。
 */

/** 発行済みか（項目が無い前からあるページは発行済み） */
export function isIssued(page: { issued?: boolean }): boolean {
  return page.issued !== false
}

/** 本物の人が来ていない日数がこれ以上なら「90日閲覧なし」 */
export const NO_VISIT_DAYS = 90

/** 一覧に出す印の文字 */
export const NO_VISIT_LABEL = `${NO_VISIT_DAYS}日閲覧なし`

/** UNIX秒 → 日本の日付（YYYY-MM-DD） */
export function jstDateKeyOf(unixSeconds: number): string {
  return new Date(unixSeconds * 1000 + 9 * 3600 * 1000).toISOString().slice(0, 10)
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

/**
 * 90日閲覧なしか。発行前のページには付けない（まだ誰にも見せていない）。
 * 最後に本物の人が来た日が無ければ、発行した日（前からあるページは作った日）から数える。
 */
export function isNoVisitForLong(
  page: { issued?: boolean; last_visit_date?: string | null; issued_at?: number | null; created_at: number },
  today: string,
): boolean {
  if (!isIssued(page)) return false
  const since = page.last_visit_date ?? jstDateKeyOf(page.issued_at ?? page.created_at)
  return daysBetween(since, today) >= NO_VISIT_DAYS
}
