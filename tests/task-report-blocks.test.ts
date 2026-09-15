/**
 * 定期レポートの本文（2026-09-15・本人の依頼で作り直し）。
 *
 * 「どの記事がどのくらいのスコアで、詳細はどんな感じか」＋ヒートマップを1通で。
 * 何を載せるかは設定で切り替えられる。
 *
 * 装飾は付けない。チャットワークもLINEもMarkdownを解釈しないので、
 * `**太字**` を書くと記号がそのまま出る。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { buildTaskReport } from '../mock-server/task-report.ts'
import { DEFAULT_REPORT_ITEMS, type ReportItems } from '../mock-server/report-items.ts'
import { getState, resetState, setState } from '../mock-server/store/store.ts'
import type { DailyMetric, HeatmapStat } from '../mock-server/store/types.ts'

/** 2026-09-15 12:00 JST */
const NOW = new Date(Date.UTC(2026, 8, 15, 3, 0))
const YESTERDAY = '2026-09-14'
const DAY_BEFORE = '2026-09-13'

function metric(patch: Partial<DailyMetric> & { entity_uid: string }): DailyMetric {
  return {
    scope: 'ab_test',
    date: YESTERDAY,
    pv: 0,
    click: 0,
    cv: 0,
    ad_cost: 0,
    sales: 0,
    ...patch,
  }
}

/** 20分割で、ちょうど50%のところで離脱が多いページ */
function heatmap(patch: Partial<HeatmapStat> & { ab_test_uid: string; version_uid: string }): HeatmapStat {
  const exit = new Array<number>(20).fill(0)
  exit[10] = 20
  exit[0] = 10
  return {
    date: YESTERDAY,
    bands: 20,
    pv: 100,
    fv_bands: 1,
    offer_band: 12,
    reach: new Array<number>(20).fill(50),
    exit,
    dwell_ms: new Array<number>(20).fill(0),
    dwell_n: new Array<number>(20).fill(0),
    clicks: [],
    ...patch,
  }
}

/** 2ページ・各2Versionの土台を置く */
function seed(): void {
  resetState()
  setState((s) => ({
    ...s,
    abTests: [
      { ...(s.abTests[0] ?? ({} as never)), id: 1, uid: 'AB1', title: '本命LP', ad_status: 'delivered' } as never,
      { ...(s.abTests[0] ?? ({} as never)), id: 2, uid: 'AB2', title: '検証用LP', ad_status: 'delivered' } as never,
    ],
    articles: [
      { id: 11, uid: 'ART1', ab_test_id: 1, memo: '', archived: false, style_applied: false, created_at: 0, updated_timestamp: 0 },
      { id: 12, uid: 'ART2', ab_test_id: 2, memo: '', archived: false, style_applied: false, created_at: 0, updated_timestamp: 0 },
    ],
    versions: [
      { ...(s.versions[0] ?? ({} as never)), id: 101, uid: 'V1A', article_id: 11, name: 'A案' } as never,
      { ...(s.versions[0] ?? ({} as never)), id: 102, uid: 'V1B', article_id: 11, name: 'B案' } as never,
      { ...(s.versions[0] ?? ({} as never)), id: 103, uid: 'V2A', article_id: 12, name: 'ひとつめ' } as never,
    ],
    metrics: [
      // 本命LP: よく回っている
      metric({ entity_uid: 'AB1', pv: 1240, click: 310, cv: 10, ad_cost: 42000 }),
      metric({ entity_uid: 'AB1', date: DAY_BEFORE, pv: 1000, click: 250, cv: 8, ad_cost: 40000 }),
      metric({ entity_uid: 'V1A', scope: 'version', pv: 620, click: 180, cv: 7 }),
      metric({ entity_uid: 'V1B', scope: 'version', pv: 620, click: 130, cv: 3 }),
      // 検証用LP: 振るわない
      metric({ entity_uid: 'AB2', pv: 380, click: 61, cv: 1, ad_cost: 38000 }),
      metric({ entity_uid: 'AB2', date: DAY_BEFORE, pv: 500, click: 90, cv: 6, ad_cost: 30000 }),
      metric({ entity_uid: 'V2A', scope: 'version', pv: 380, click: 61, cv: 1 }),
    ],
    heatmapStats: [
      heatmap({ ab_test_uid: 'AB1', version_uid: 'V1A' }),
      heatmap({ ab_test_uid: 'AB1', version_uid: 'V1B' }),
    ],
  }))
}

const items = (patch: Partial<ReportItems> = {}): ReportItems => ({ ...DEFAULT_REPORT_ITEMS, ...patch })

beforeEach(seed)

describe('レポート本文', () => {
  it('CVの多い順に並べる', () => {
    const body = buildTaskReport('毎朝のレポート', 'yesterday', NOW, items())
    expect(body.indexOf('本命LP')).toBeLessThan(body.indexOf('検証用LP'))
    expect(body).toContain('[毎朝のレポート]')
    expect(body).toContain(YESTERDAY)
  })

  it('点数は出さない（本人の判断で外した。相対評価で読み取れることが少なかった）', () => {
    const body = buildTaskReport('朝', 'yesterday', NOW, items())
    expect(body).not.toMatch(/\d+点/)
  })

  it('Versionの内訳を出す。いちばんCVRが高い案に印を付ける', () => {
    const body = buildTaskReport('朝', 'yesterday', NOW, items())
    expect(body).toContain('A案')
    expect(body).toContain('B案')
    const aLine = body.split('\n').find((l) => l.includes('A案')) ?? ''
    expect(aLine, 'CVRが高いのはA案').toContain('★')
  })

  it('Versionの内訳をしまえる', () => {
    const body = buildTaskReport('朝', 'yesterday', NOW, items({ versions: false }))
    expect(body).not.toContain('A案')
  })

  it('ヒートマップの要点を出す（通知に絵は送れないので文で）', () => {
    const body = buildTaskReport('朝', 'yesterday', NOW, items())
    expect(body).toContain('50%')
    expect(body).toMatch(/離脱/)
  })

  it('ヒートマップを計っていないページには、その行を出さない（0%と書かない）', () => {
    const body = buildTaskReport('朝', 'yesterday', NOW, items())
    const section = body.slice(body.indexOf('検証用LP'))
    expect(section).not.toMatch(/離脱が多い/)
  })

  it('前日比を出す', () => {
    const body = buildTaskReport('朝', 'yesterday', NOW, items())
    expect(body).toMatch(/PV \+240|PV \+24%/)
    expect(body).toContain('前の期間')
  })

  it('前日比をしまえる', () => {
    const body = buildTaskReport('朝', 'yesterday', NOW, items({ compare: false }))
    expect(body).not.toContain('前の期間')
  })

  it('広告費とCPAを出す。取り込んでいなければ「未取込」と書く（0円と書かない）', () => {
    setState((s) => ({
      ...s,
      metrics: s.metrics.map((m) => (m.entity_uid === 'AB2' ? { ...m, ad_cost: 0 } : m)),
    }))
    const body = buildTaskReport('朝', 'yesterday', NOW, items())
    expect(body).toContain('42,000円')
    expect(body.slice(body.indexOf('検証用LP'))).toContain('未取込')
  })

  it('合計CPAに、広告費を取り込んでいないページのCVを混ぜない', () => {
    // AB2は広告費0＝未取込。そのCVまで分母に入れるとCPAが安く見える
    setState((s) => ({
      ...s,
      metrics: s.metrics.map((m) => (m.entity_uid === 'AB2' ? { ...m, ad_cost: 0 } : m)),
    }))
    const body = buildTaskReport('朝', 'yesterday', NOW, items())
    const total = body.split('\n').find((l) => l.includes('広告費') && l.includes('CPA')) ?? ''
    // 42,000円 ÷ CV10 = 4,200円。CV11で割ると3,818円になってしまう
    expect(total).toContain('4,200円')
    expect(total, '除いたことを書く').toContain('未取込')
  })

  it('アクセスが1件も無ければ、無いとだけ書く', () => {
    setState((s) => ({ ...s, metrics: [], heatmapStats: [] }))
    const body = buildTaskReport('朝', 'yesterday', NOW, items())
    expect(body).toContain('計測されたアクセスはありませんでした')
  })

  it('装飾記号を混ぜない（チャットワークもLINEもMarkdownを読まない）', () => {
    const body = buildTaskReport('朝', 'yesterday', NOW, items())
    expect(body).not.toMatch(/\*\*|^#|`/m)
  })

  it('設定を渡さなければ既定（全部入り）で組む', () => {
    expect(buildTaskReport('朝', 'yesterday', NOW)).toBe(
      buildTaskReport('朝', 'yesterday', NOW, DEFAULT_REPORT_ITEMS),
    )
  })

  it('状態は読むだけで変えない', () => {
    const before = JSON.stringify(getState().metrics)
    buildTaskReport('朝', 'yesterday', NOW, items())
    expect(JSON.stringify(getState().metrics)).toBe(before)
  })
})
