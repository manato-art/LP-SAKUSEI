/**
 * レポート除外の判定（純粋関数）。
 *
 * 実物の説明どおりの意味づけにしている:
 *   - 条件に合ったアクセスは**レポート集計から外す**。ページ自体は普通に表示する。
 *   - ホワイトリストの条件に合ったアクセスは、アクセス拒否の対象から外す。
 *     こちらが優先され、やはりレポートには反映されない。
 */
import type { ReportExclusion, RequestLogEntry } from './types.ts'

/** IPアドレスらしい形か（IPv4 / IPv6 のどちらも受ける） */
export function isIpLike(value: string): boolean {
  const v = value.trim()
  if (v === '') return false
  // IPv4: 0-255 を4つ
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v)) {
    return v.split('.').every((part) => {
      const n = Number(part)
      // `01` のような先頭ゼロは弾く（元の文字列と数値表記が一致することを見る）
      return n >= 0 && n <= 255 && String(n) === part
    })
  }
  // IPv6: 16進の組み合わせ（省略記法 `::` も許す）
  return /^[0-9a-f:]+$/i.test(v) && v.includes(':')
}

/** 1件の記録が、その除外条件に当たるか */
export function matchesExclusion(log: RequestLogEntry, rule: ReportExclusion): boolean {
  // マッチタイプは採取物で見えた「完全一致」だけ
  if (rule.kind === 'ip') return log.ip === rule.value
  // チームはリクエスト記録のチームIDと突き合わせる
  return String(log.team_id) === rule.value
}

/**
 * そのアクセスをレポートから外すか。
 *
 * ホワイトリストに当たったものは「アクセス拒否の対象から外す」が、
 * 実物の説明どおり**レポートには反映しない**ので、どちらも除外として扱う。
 * 結合条件は採取物で見えたのが OR だけなので、1つでも当たれば除外。
 */
export function shouldExclude(
  log: RequestLogEntry,
  rules: readonly ReportExclusion[],
): boolean {
  return rules.some((rule) => matchesExclusion(log, rule))
}
