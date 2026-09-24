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

/** `2026-09-24` → `9/24` */
function shortDate(key: string): string {
  const [, m, d] = key.split('-')
  return `${Number(m)}/${Number(d)}`
}

/**
 * SP / PC の切り替えの断り書き（2026-09-24・点検29）。
 *
 * 端末は 2026-09-24 から記録している。それより前の記録には端末が無いので、SP・PC のどちらにも入らない。
 * タブレットは SP・PC のどちらでもないので入れない（どちらかに寄せると、画面の幅が違う人の位置が混ざる）。
 * 広告で絞った列は、端末ごとの記録を広告に分けていないので切り替えられない。
 */
export function deviceNoteLines(input: {
  device: 'sp' | 'pc'
  param: string
  coverage: { all: number; sp: number; tablet: number; pc: number } | null
  since: string | null | undefined
}): string[] {
  if (input.param !== '') return ['広告で絞った列は端末で分けられません（SP・PCを合わせた数字です）。']
  const coverage = input.coverage
  if (coverage === null) return []
  const lines: string[] = []
  const unknown = Math.max(0, coverage.all - coverage.sp - coverage.tablet - coverage.pc)
  if (unknown > 0) {
    lines.push(
      input.since === null || input.since === undefined
        ? `端末の記録はまだありません。この ${unknown.toLocaleString('ja-JP')} PV は端末が分からないため、SP・PCのどちらにも入っていません。`
        : `端末の記録は ${shortDate(input.since)} からです。それより前の ${unknown.toLocaleString('ja-JP')} PV は端末が分からないため、SP・PCのどちらにも入っていません。`,
    )
  }
  if (coverage.tablet > 0) {
    lines.push(`タブレットの ${coverage.tablet.toLocaleString('ja-JP')} PV は SP・PC のどちらにも入れていません。`)
  }
  return lines
}
