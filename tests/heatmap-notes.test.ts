/**
 * ヒートマップの列に添える断り書き（2026-09-24 点検30）。
 * 到達の数え方を変えたので、古いタグの記録が混ざる期間はそう書く（数字を黙って混ぜない）。
 */
import { describe, expect, it } from 'vitest'
import { reachBasisNote } from '../src/app/pages/heatmap-notes.ts'

describe('到達の数え方の断り書き', () => {
  it('古い数え方の記録が無ければ何も出さない', () => {
    expect(reachBasisNote({ pv: 10, legacy_pv: 0 })).toBeNull()
  })

  it('古い数え方の記録が混ざっていれば件数を書く', () => {
    expect(reachBasisNote({ pv: 10, legacy_pv: 3 })).toBe(
      '10 PV のうち 3 PV は古い数え方（スクロールの進み具合）の記録です。この分は到達率が低めに出ます。',
    )
  })

  it('古いサーバーの応答（legacy_pv 無し）は出さない（分からないことを言わない）', () => {
    expect(reachBasisNote({ pv: 10 })).toBeNull()
  })
})
