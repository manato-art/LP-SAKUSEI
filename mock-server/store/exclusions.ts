/**
 * レポート除外の判定（純粋関数）。
 *
 * 実物の説明どおりの意味づけにしている:
 *   - 条件に合ったアクセスは**レポート集計から外す**。ページ自体は普通に表示する。
 *   - ホワイトリストの条件に合ったアクセスは、アクセス拒否の対象から外す。
 *     こちらが優先され、やはりレポートには反映されない。
 *
 * 選択肢は実物のプルダウンを開いて確認したもの（2026-09-08）。
 *   除外対象   … IPアドレス / リファラ / パラメータ / チーム
 *   マッチタイプ … 完全一致 / 部分一致 / 前方一致 / 後方一致
 *   結合条件   … AND / OR
 */
import type {
  ExclusionCondition,
  ExclusionMatch,
  ReportExclusion,
  RequestLogEntry,
} from './types.ts'

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

/** マッチタイプごとの文字列比較 */
export function matchesText(actual: string, expected: string, how: ExclusionMatch): boolean {
  switch (how) {
    case 'exact':
      return actual === expected
    case 'partial':
      return expected !== '' && actual.includes(expected)
    case 'prefix':
      return expected !== '' && actual.startsWith(expected)
    case 'suffix':
      return expected !== '' && actual.endsWith(expected)
  }
}

/** 記録の中で、その除外対象が指す値たち（パラメータは複数ありうる） */
function valuesOf(log: RequestLogEntry, kind: ExclusionCondition['kind']): readonly string[] {
  switch (kind) {
    case 'email':
      // メールは値そのものではなく、ブラウザに残った目印で判定する（下の matchesCondition）
      return []
    case 'ip':
      return [log.ip]
    case 'referer':
      return [log.referer]
    case 'param':
      return log.params
    case 'team':
      return [String(log.team_id)]
  }
}

/**
 * 1行ぶんの条件に当たるか。
 * @param ruleToken メールアドレスの判定に使う（そのルールの目印がブラウザにあるか）
 */
export function matchesCondition(
  log: RequestLogEntry,
  cond: ExclusionCondition,
  ruleToken = '',
): boolean {
  if (cond.kind === 'email') {
    // 値（メールアドレス）そのものは届かない。除外リンクを開いたブラウザかどうかで見る。
    return log.exclude_token !== '' && log.exclude_token === ruleToken
  }
  return valuesOf(log, cond.kind).some((actual) =>
    matchesText(actual, cond.value, cond.match_type),
  )
}

/**
 * ルール1件に当たるか。
 *
 * 実物は行ごとに AND / OR を選べる。結合は**左から順に**評価する
 * （AND を先に束ねる優先順位は実物から確認できていないので、
 * 見えているとおりの素直な並び順で処理する）。
 */
export function matchesExclusion(log: RequestLogEntry, rule: ReportExclusion): boolean {
  const conds = rule.conditions
  if (conds.length === 0) return false
  let result = matchesCondition(log, conds[0] as ExclusionCondition, rule.exclude_token)
  for (let i = 1; i < conds.length; i++) {
    const cond = conds[i] as ExclusionCondition
    // 繋ぎ方は「前の行」に書かれているものを使う
    const join = (conds[i - 1] as ExclusionCondition).join
    const hit = matchesCondition(log, cond, rule.exclude_token)
    result = join === 'and' ? result && hit : result || hit
  }
  return result
}

/**
 * そのアクセスをレポートから外すか。
 *
 * ホワイトリストに当たったものは「アクセス拒否の対象から外す」が、
 * 実物の説明どおり**レポートには反映しない**ので、どちらも除外として扱う。
 */
export function shouldExclude(
  log: RequestLogEntry,
  rules: readonly ReportExclusion[],
): boolean {
  return rules.some((rule) => matchesExclusion(log, rule))
}
