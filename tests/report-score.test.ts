/**
 * 定期レポートの総合スコア（2026-09-15・本人の依頼）。
 *
 * 「どの記事がどのくらいのスコアか」を1通で分かるようにするための点数。
 * CVR・CTR・ファーストビュー通過率を**他ページと比べて**0〜100にまとめる。
 *
 * 点数は作り物なので、作り物だと分かる形でしか出さない:
 *  - 比べる相手が1つしか無ければ出さない（順位も差も無いのに点だけ出ると信じてしまう）
 *  - PVが少なすぎるページには出さない（PV3でCV1なら100点になってしまう）
 *  - 材料が無い軸は「0点」ではなく**その軸を外して**残りで出す（0は嘘になる）
 */
import { describe, expect, it } from 'vitest'
import {
  MIN_PV_FOR_SCORE,
  SCORE_WEIGHTS,
  scoreAll,
  type ScoreInput,
} from '../mock-server/report-score.ts'

function row(patch: Partial<ScoreInput> = {}): ScoreInput {
  return { pv: 1000, cvr: 0.02, ctr: 0.2, fv_pass: 0.6, ...patch }
}

describe('総合スコア', () => {
  it('いちばん良いページが100点、いちばん悪いページが0点', () => {
    const scores = scoreAll([
      row({ cvr: 0.04, ctr: 0.3, fv_pass: 0.8 }),
      row({ cvr: 0.01, ctr: 0.1, fv_pass: 0.4 }),
    ])
    expect(scores).toEqual([100, 0])
  })

  it('真ん中のページは真ん中あたりの点になる', () => {
    const scores = scoreAll([
      row({ cvr: 0.04, ctr: 0.3, fv_pass: 0.8 }),
      row({ cvr: 0.025, ctr: 0.2, fv_pass: 0.6 }),
      row({ cvr: 0.01, ctr: 0.1, fv_pass: 0.4 }),
    ])
    expect(scores[0]).toBe(100)
    expect(scores[2]).toBe(0)
    expect(scores[1]).toBeGreaterThan(30)
    expect(scores[1]).toBeLessThan(70)
  })

  it('CVRがいちばん重い（CVRだけ良いページが、CTRだけ良いページに勝つ）', () => {
    expect(SCORE_WEIGHTS.cvr).toBeGreaterThan(SCORE_WEIGHTS.ctr)
    const [cvrGood, ctrGood] = scoreAll([
      row({ cvr: 0.04, ctr: 0.1, fv_pass: 0.4 }),
      row({ cvr: 0.01, ctr: 0.3, fv_pass: 0.4 }),
    ])
    expect(cvrGood).toBeGreaterThan(ctrGood ?? 0)
  })

  it('全部横並びなら全部おなじ点（どれかを上にする理由が無い）', () => {
    const scores = scoreAll([row(), row(), row()])
    expect(new Set(scores).size).toBe(1)
  })

  it('比べる相手が1つしか無ければ点を出さない', () => {
    expect(scoreAll([row()])).toEqual([null])
    expect(scoreAll([])).toEqual([])
  })

  it(`PVが${MIN_PV_FOR_SCORE}件に満たないページには点を出さない`, () => {
    const scores = scoreAll([
      row({ pv: MIN_PV_FOR_SCORE }),
      row({ pv: MIN_PV_FOR_SCORE - 1, cvr: 0.5 }),
      row({ pv: 5000, cvr: 0.001 }),
    ])
    expect(scores[1], 'PVが少ないページは点を出さない').toBeNull()
    expect(scores[0]).not.toBeNull()
    expect(scores[2]).not.toBeNull()
  })

  it('PVが少ないページは、他ページの点数計算にも混ぜない', () => {
    // PV3でCVR50%のページを混ぜると、まともなページが全部0点側に潰れてしまう
    const withNoise = scoreAll([
      row({ cvr: 0.04 }),
      row({ cvr: 0.01 }),
      row({ pv: 3, cvr: 0.5 }),
    ])
    const withoutNoise = scoreAll([row({ cvr: 0.04 }), row({ cvr: 0.01 })])
    expect(withNoise.slice(0, 2)).toEqual(withoutNoise)
  })

  it('材料が無い軸は0点にせず、その軸を外して残りで出す', () => {
    // ヒートマップをまだ計っていないページ（fv_pass が無い）
    const scores = scoreAll([
      row({ cvr: 0.04, ctr: 0.3, fv_pass: null }),
      row({ cvr: 0.01, ctr: 0.1, fv_pass: 0.9 }),
    ])
    // fv_pass を0として扱っていたら1ページ目は満点を落とすが、外せば満点のまま
    expect(scores[0]).toBe(100)
  })

  it('軸が1つも無いページには点を出さない', () => {
    const scores = scoreAll([
      row({ cvr: null, ctr: null, fv_pass: null }),
      row({ cvr: 0.01 }),
      row({ cvr: 0.02 }),
    ])
    expect(scores[0]).toBeNull()
  })

  it('点は整数で0〜100に収まる', () => {
    const scores = scoreAll([
      row({ cvr: 0.0333, ctr: 0.1777, fv_pass: 0.6123 }),
      row({ cvr: 0.0111, ctr: 0.2999, fv_pass: 0.4321 }),
      row({ cvr: 0.0222, ctr: 0.2111, fv_pass: 0.7654 }),
    ])
    for (const s of scores) {
      expect(Number.isInteger(s)).toBe(true)
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(100)
    }
  })
})
