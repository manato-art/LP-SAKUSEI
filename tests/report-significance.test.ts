/**
 * Version の勝ち負けの判定（2026-09-24・E「有意差判定」）。
 *
 * 方法: 2つの割合の差の z 検定（両側・プールした割合で標準誤差を出す標準的なやり方）。
 * 比べるのは CVR（CV ÷ CLICK・SquadBeyond の定義）。基準はコントロールの Version（ページを作ったときの最初の Version）。
 * 95%（p < 0.05）で「差あり」。CLICK が30未満、または CV・CVしなかった数の見込みが5未満のときは
 * 正規分布で近似できないので「サンプル不足」とする。
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { installDom } from './helpers/dom.ts'
import { compareCvr, normalCdf, significanceRows } from '../src/app/pages/report-significance.ts'

describe('標準正規分布の累積', () => {
  it('よく知られた値と合う', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6)
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 4)
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 4)
  })
})

describe('CVR の差の z 検定', () => {
  it('10%（20/200）と18%（36/200）は差あり（z≈2.306・p≈0.021）', () => {
    const out = compareCvr({ cv: 20, click: 200 }, { cv: 36, click: 200 })
    expect(out.kind).toBe('tested')
    if (out.kind !== 'tested') return
    expect(out.z).toBeCloseTo(2.3056, 3)
    expect(out.pValue).toBeCloseTo(0.0211, 3)
    expect(out.verdict).toBe('better')
  })

  it('5%（50/1000）と6%（60/1000）は差なし（p≈0.327）', () => {
    const out = compareCvr({ cv: 50, click: 1000 }, { cv: 60, click: 1000 })
    expect(out.kind).toBe('tested')
    if (out.kind !== 'tested') return
    expect(out.pValue).toBeCloseTo(0.3267, 3)
    expect(out.verdict).toBe('no_difference')
  })

  it('負けているときは worse', () => {
    const out = compareCvr({ cv: 36, click: 200 }, { cv: 20, click: 200 })
    expect(out.kind === 'tested' && out.verdict).toBe('worse')
  })

  it('CLICK が30未満・CVの見込みが5未満ならサンプル不足', () => {
    expect(compareCvr({ cv: 2, click: 20 }, { cv: 5, click: 25 }).kind).toBe('too_small')
    expect(compareCvr({ cv: 1, click: 100 }, { cv: 2, click: 100 }).kind).toBe('too_small')
  })
})

describe('Version ごとの判定', () => {
  const base = { cv: 0, click: 0, name: '', entity_uid: '' }
  it('コントロールを基準に、ほかの Version を比べる', () => {
    const rows = significanceRows([
      { ...base, name: 'Ver.A', entity_uid: 'A', is_control: true, cv: 20, click: 200 },
      { ...base, name: 'Ver.B', entity_uid: 'B', is_control: false, cv: 36, click: 200 },
    ])
    expect(rows.baseline?.name).toBe('Ver.A')
    expect(rows.results.map((r) => [r.name, r.label])).toEqual([['Ver.B', '勝ち（95%で差あり）']])
  })

  it('コントロールが表に無ければ判定しない', () => {
    const rows = significanceRows([{ ...base, name: 'Ver.B', entity_uid: 'B', is_control: false, cv: 1, click: 10 }])
    expect(rows.baseline).toBeNull()
  })
})

describe('画面', () => {
  beforeAll(() => {
    installDom()
  })

  it('判定と、方法の説明を出す', async () => {
    const { buildSignificanceCard } = await import('../src/app/pages/report-significance.ts')
    const kpi = {
      pv: 0, ad_cost: 0, imp: 0, media_click: 0, media_cv: 0, sales: 0, gross_profit: 0,
      roas: null, roi: null, cvr: null, cpa: null, ctr: null, ctvr: null, media_ctr: null, mcpa: null,
      fver: null, sver: null, fsver: null, oar: null, scope: 'version', status: '', distribution_ratio: 50,
    }
    const card = buildSignificanceCard([
      { ...kpi, name: 'Ver.A', entity_uid: 'A', is_control: true, cv: 20, click: 200 },
      { ...kpi, name: 'Ver.B', entity_uid: 'B', is_control: false, cv: 36, click: 200 },
    ])
    const text = card.textContent ?? ''
    expect(text).toContain('勝ち（95%で差あり）')
    expect(text).toContain('z 検定')
  })
})

describe('レポートの API と画面の配線', () => {
  it('Version の行にコントロールかどうかを載せ、レポート一覧の下に判定の枠を置く', async () => {
    const { readFileSync } = await import('node:fs')
    expect(readFileSync('mock-server/routes/report-rows.ts', 'utf8')).toContain('is_control: version.is_control')
    const body = readFileSync('src/app/pages/report-v2.ts', 'utf8')
    expect(body.indexOf('buildSignificanceCard(')).toBeGreaterThan(body.indexOf('buildReportList({'))
  })
})
