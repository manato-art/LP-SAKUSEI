/**
 * ヒートマップの列に添える断り書き（2026-09-24）。
 *
 * 数字の出どころが途中で変わったとき、黙って混ぜると読み違える。
 * 列の見出しの下に1行で書く文言をここで作る（画面の組み立てとは分ける）。
 */

/**
 * 到達の数え方の新旧。
 *
 * 2026-09-24 に計測タグの到達を「スクロールの進み具合」から「画面の下端がページの何割まで来たか」に変えた。
 * 古いタグの記録（スクロールしないと最初の画面すら到達にならない）は到達率が低めに出る。
 * 記録そのものは書き換えないので、混ざっている期間はそう書く。
 */
export function reachBasisNote(stat: { pv: number; legacy_pv?: number }): string | null {
  const legacy = stat.legacy_pv ?? 0
  if (legacy <= 0) return null
  return (
    `${stat.pv.toLocaleString('ja-JP')} PV のうち ${legacy.toLocaleString('ja-JP')} PV は` +
    '古い数え方（スクロールの進み具合）の記録です。この分は到達率が低めに出ます。'
  )
}
