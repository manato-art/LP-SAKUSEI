/**
 * レポートの「ファネル」節（2026-09-15・実物の採取に合わせて追加）。
 *
 * 採取物（capture/clean/ab_tests__UID__reports/report-settings-modal の `_reportWrapper_1rrna_96`）:
 *   見出し「ファネル」＋日付select（日付/今日/昨日/過去3日間/過去7日間）＋期間
 *   タブ「詳細」「比較」
 *   本体は3列 = 「経路 」「PV数/割合」「ファネル分析」（凡例 PV / 離脱・目盛 0〜100(%)）
 *   まとめ = PV / CV / CVR
 * 採取時は一覧が空（その口座にファネルのステップが無かった）ため、行の中身は採れていない。
 * クローンは実測で持っている 表示→クリック→成果 の1本を出す。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  FUNNEL_DATE_PRESETS,
  funnelStages,
  hasRealFunnel,
  stepStages,
} from '../src/app/pages/report-funnel.ts'
import type { ReportKpi } from '../src/app/api.ts'

function kpi(patch: Partial<ReportKpi> = {}): ReportKpi {
  return {
    pv: 0, click: 0, cv: 0, ad_cost: 0, imp: 0, media_click: 0, media_cv: 0,
    sales: 0, gross_profit: 0, roas: null, roi: null, cvr: null, cpa: null,
    ctr: null, ctvr: null, media_ctr: null, mcpa: null,
    fver: null, sver: null, fsver: null, oar: null,
    ...patch,
  }
}

describe('ファネルの段', () => {
  it('表示→クリック→成果の3段を返す', () => {
    const stages = funnelStages(kpi({ pv: 100, click: 40, cv: 10 }))
    expect(stages.map((s) => s.name)).toEqual(['表示', 'クリック', '成果'])
    expect(stages.map((s) => s.count)).toEqual([100, 40, 10])
  })

  it('割合は最初の段（表示）を100%とする', () => {
    const stages = funnelStages(kpi({ pv: 100, click: 40, cv: 10 }))
    expect(stages.map((s) => s.share)).toEqual([1, 0.4, 0.1])
  })

  it('離脱は次の段へ進まなかったぶん（最後の段は離脱なし）', () => {
    const stages = funnelStages(kpi({ pv: 100, click: 40, cv: 10 }))
    expect(stages.map((s) => s.exitShare)).toEqual([0.6, 0.3, 0])
  })

  it('表示が0なら割合は出さない（0で割らない）', () => {
    const stages = funnelStages(kpi({ pv: 0, click: 0, cv: 0 }))
    expect(stages.map((s) => s.share)).toEqual([null, null, null])
    expect(stages.map((s) => s.exitShare)).toEqual([null, null, null])
  })

  it('クリックよりCVが多い取りこぼしでも割合が100%を超えない', () => {
    // 別ドメインのサンクスページなどで、クリックを取りこぼしたままCVだけ届くことがある
    const stages = funnelStages(kpi({ pv: 10, click: 2, cv: 5 }))
    expect(stages[2]?.share).toBe(0.5)
    expect(stages[1]?.exitShare).toBe(0)
  })
})

describe('ファネルの日付プリセット', () => {
  it('採取したselectと同じ並び（「7日間」は無い）', () => {
    expect(FUNNEL_DATE_PRESETS.map((p) => p.value)).toEqual([
      '',
      'today',
      'yesterday',
      'last_three_days',
      'last_seven_days',
    ])
    expect(FUNNEL_DATE_PRESETS.map((p) => p.label)).toEqual([
      '日付',
      '今日',
      '昨日',
      '過去3日間',
      '過去7日間',
    ])
  })
})


/**
 * 画面の組み立て（jsdomを使わないので、実装の形と採取物の文言で固定する）。
 */
describe('ファネル節の画面', () => {
  const view = readFileSync('src/app/pages/report-funnel-view.ts', 'utf8')
  const body = readFileSync('src/app/pages/report-v2.ts', 'utf8')
  const captured = readFileSync(
    'capture/clean/ab_tests__UID__reports/report-settings-modal/dom.html',
    'utf8',
  )

  it('採取物にある見出しと凡例をそのまま使う', () => {
    for (const label of ['経路', 'PV数/割合', 'ファネル分析', '詳細', '比較']) {
      expect(captured).toContain(label)
      expect(view).toContain(label)
    }
  })

  it('目盛は採取物どおり 0〜100(%)', () => {
    expect(captured).toContain('100(%)')
    expect(view).toContain("'100(%)'")
  })

  it('レポート本体に組み込まれている', () => {
    expect(body).toContain('buildFunnelReport(')
  })

  it('凡例は見出しと同じ行に置く（縦に積むと棒の高さが左の列とずれる）', () => {
    expect(view).toContain('rv2-funnel-headrow')
  })
})

/**
 * ステップを段として出す（2026-09-15）。
 * ステップが2つ以上あるページでは、表示→クリック→成果の代用ではなく実際のステップを出す。
 */
describe('ステップから作る段', () => {
  it('ステップの数だけ段を作り、最初のステップを100%とする', () => {
    const stages = stepStages([
      { name: 'ステップ1', pv: 100 },
      { name: '申込ページ', pv: 30 },
    ])
    expect(stages.map((s) => s.name)).toEqual(['ステップ1', '申込ページ'])
    expect(stages.map((s) => s.share)).toEqual([1, 0.3])
    expect(stages.map((s) => s.exitShare)).toEqual([0.7, 0])
  })

  it('次のステップのほうが多くても割合が負にならない', () => {
    const stages = stepStages([
      { name: 'A', pv: 10 },
      { name: 'B', pv: 25 },
    ])
    expect(stages[0]?.exitShare).toBe(0)
  })

  it('最初のステップが0なら割合は出さない', () => {
    const stages = stepStages([{ name: 'A', pv: 0 }, { name: 'B', pv: 0 }])
    expect(stages.map((s) => s.share)).toEqual([null, null])
  })

  it('ステップが1つだけならファネルとして扱わない', () => {
    expect(hasRealFunnel([{}])).toBe(false)
    expect(hasRealFunnel([{}, {}])).toBe(true)
  })
})
