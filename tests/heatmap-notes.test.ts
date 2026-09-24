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

describe('ヒートマップの SP / PC の断り書き（2026-09-24 点検29）', () => {
  it('広告で絞った列は端末で分けられないと書く', async () => {
    const { deviceNoteLines } = await import('../src/app/pages/heatmap-notes.ts')
    expect(deviceNoteLines({ device: 'sp', param: 'utm_source=fb', coverage: null, since: '2026-09-24' })).toEqual([
      '広告で絞った列は端末で分けられません（SP・PCを合わせた数字です）。',
    ])
  })

  it('端末を記録する前の PV と、タブレットの PV が入っていないことを書く', async () => {
    const { deviceNoteLines } = await import('../src/app/pages/heatmap-notes.ts')
    expect(
      deviceNoteLines({
        device: 'sp',
        param: '',
        coverage: { all: 10, sp: 4, tablet: 1, pc: 2 },
        since: '2026-09-24',
      }),
    ).toEqual([
      '端末の記録は 9/24 からです。それより前の 3 PV は端末が分からないため、SP・PCのどちらにも入っていません。',
      'タブレットの 1 PV は SP・PC のどちらにも入れていません。',
    ])
  })

  it('全部の PV に端末があり、タブレットも無ければ何も書かない', async () => {
    const { deviceNoteLines } = await import('../src/app/pages/heatmap-notes.ts')
    expect(
      deviceNoteLines({ device: 'pc', param: '', coverage: { all: 5, sp: 3, tablet: 0, pc: 2 }, since: '2026-09-24' }),
    ).toEqual([])
  })

  it('端末の記録がまだ無ければそう書く', async () => {
    const { deviceNoteLines } = await import('../src/app/pages/heatmap-notes.ts')
    expect(
      deviceNoteLines({ device: 'sp', param: '', coverage: { all: 5, sp: 0, tablet: 0, pc: 0 }, since: null }),
    ).toEqual(['端末の記録はまだありません。この 5 PV は端末が分からないため、SP・PCのどちらにも入っていません。'])
  })
})
