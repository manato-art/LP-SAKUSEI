/**
 * 定期レポートの総合スコア（2026-09-15・本人の依頼）。
 *
 * 「どの記事がどのくらいのスコアか」を1通で分かるようにするための点数。
 * CVR・CTR・ファーストビュー通過率を**他ページと比べて**0〜100にまとめる。
 *
 * ⚠️ これは実物のSquadBeyondには無い、こちらで決めた点数。
 * 作り物なので、作り物だと分かる形でしか出さない:
 *  - 比べる相手が1つしか無ければ出さない（順位も差も無いのに点だけ出ると信じてしまう）
 *  - PVが少なすぎるページには出さない（PV3でCV1なら100点になってしまう）
 *  - 材料が無い軸は「0点」ではなく**その軸を外して**残りで出す（0は嘘になる）
 *
 * 材料の定義そのものは増やしていない。CVR・CTRは `store/metrics.ts` の `deriveKpi`、
 * ファーストビュー通過率は同じく `deriveKpi` の `fver`（FV離脱率）の裏返し。
 */

/** 点の重み。CVRがいちばん重い（最後に欲しいのはCVなので）。 */
export const SCORE_WEIGHTS = { cvr: 0.5, ctr: 0.25, fv_pass: 0.25 } as const

/**
 * これに満たないPVのページには点を出さない。
 * 少ない分母の比率は跳ねるので、点にすると順位が毎日ひっくり返る。
 */
export const MIN_PV_FOR_SCORE = 100

export interface ScoreInput {
  pv: number
  cvr: number | null
  ctr: number | null
  /** ファーストビューを通過した割合（＝ 1 − FV離脱率）。計っていなければ null */
  fv_pass: number | null
}

type Axis = keyof typeof SCORE_WEIGHTS

const AXES: readonly Axis[] = ['cvr', 'ctr', 'fv_pass']

/** その軸の値を、比べる相手の中での位置（0〜1）に直す */
function normalize(value: number, values: readonly number[]): number {
  const min = Math.min(...values)
  const max = Math.max(...values)
  // 全部同じなら、どれかを上にする理由が無い
  return max === min ? 0.5 : (value - min) / (max - min)
}

/**
 * 並べたページぶんの点を返す（入力と同じ並び）。
 * 点を出せないものは `null`。
 */
export function scoreAll(rows: readonly ScoreInput[]): (number | null)[] {
  // PVが少ないページは、点を出さないだけでなく**比べる母数にも入れない**。
  // 入れると、跳ねた比率が上限になって、まともなページが全部下に潰れる。
  const scorable = rows.map((r) => r.pv >= MIN_PV_FOR_SCORE)
  const compared = rows.filter((_, i) => scorable[i] === true)
  if (compared.length < 2) return rows.map(() => null)

  const valuesOf = (axis: Axis): number[] =>
    compared.map((r) => r[axis]).filter((v): v is number => v !== null)

  const axisValues = new Map<Axis, number[]>(AXES.map((axis) => [axis, valuesOf(axis)]))

  return rows.map((row, i) => {
    if (scorable[i] !== true) return null
    let sum = 0
    let weight = 0
    for (const axis of AXES) {
      const value = row[axis]
      const others = axisValues.get(axis) ?? []
      // 材料が無い軸は外す。0点にすると「悪い」と言ったことになる
      if (value === null || others.length === 0) continue
      sum += SCORE_WEIGHTS[axis] * normalize(value, others)
      weight += SCORE_WEIGHTS[axis]
    }
    if (weight === 0) return null
    return Math.round((sum / weight) * 100)
  })
}
