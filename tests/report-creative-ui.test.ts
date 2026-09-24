/**
 * クリエイティブレポートの画面（2026-09-24 点検19）。
 * 配信中 / 停止中・平均 / 合計・Parameter検索・比較の印が、実際に表示を変える。
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { installDom } from './helpers/dom.ts'
import type { ReportDailyRow, ReportVersionRow } from '../src/app/api.ts'

function kpi() {
  return {
    pv: 0, click: 0, cv: 0, ad_cost: 0, imp: 0, media_click: 0, media_cv: 0,
    sales: 0, gross_profit: 0, roas: null, roi: null, cvr: null, cpa: null,
    ctr: null, ctvr: null, media_ctr: null, mcpa: null,
    fver: null, sver: null, fsver: null, oar: null,
  }
}
function param(name: string, pv: number): ReportVersionRow {
  return { ...kpi(), scope: 'parameter', entity_uid: name, name, status: '', distribution_ratio: 0, pv, cost_known: false }
}
const versions: ReportVersionRow[] = [
  {
    ...kpi(), scope: 'version', entity_uid: 'A', name: 'Ver.A', status: '準備中', distribution_ratio: 60,
    creative_children: [param('utm_source=fb', 10)],
    daily_lp: [{ date: '2026-09-23', pv: 10, click: 1, cv: 0, sales: 0 }],
  },
  {
    ...kpi(), scope: 'version', entity_uid: 'B', name: 'Ver.B', status: '準備中', distribution_ratio: 0,
    creative_children: [param('utm_source=ig', 4)],
    daily_lp: [{ date: '2026-09-24', pv: 4, click: 0, cv: 0, sales: 0 }],
  },
]
const daily: ReportDailyRow[] = [
  { ...kpi(), date: '2026-09-23', pv: 10, ad_cost: 1000 },
  { ...kpi(), date: '2026-09-24', pv: 4, ad_cost: 500 },
]

beforeAll(() => {
  installDom()
})

async function build(): Promise<HTMLElement> {
  const { buildCreativeReport } = await import('../src/app/pages/report-v2-chart.ts')
  const card = buildCreativeReport({
    daily,
    range: { startDate: '2026-09-23', endDate: '2026-09-24' },
    rows: versions,
    onDownloadCsv: () => undefined,
  })
  document.body.append(card)
  return card
}

const names = (card: HTMLElement): string[] =>
  [...card.querySelectorAll('.rv2-creative-param-name')].map((n) => n.textContent ?? '')
const chip = (card: HTMLElement, text: string): HTMLElement =>
  [...card.querySelectorAll('.rv2-chip')].find((c) => c.textContent === text) as HTMLElement

describe('クリエイティブの絞り込み', () => {
  it('配信中にすると、配信している Version に来た広告だけになる', async () => {
    const card = await build()
    expect(names(card)).toEqual(['utm_source=fb', 'utm_source=ig'])
    chip(card, '配信中').dispatchEvent(new Event('click'))
    expect(names(card)).toEqual(['utm_source=fb'])
    chip(card, '停止中').dispatchEvent(new Event('click'))
    expect(names(card)).toEqual(['utm_source=ig'])
  })

  it('Parameter検索で名前を絞れる（使えない状態にしない）', async () => {
    const card = await build()
    const search = card.querySelector('input[placeholder="Parameter検索"]') as HTMLInputElement
    expect(search.disabled).toBe(false)
    search.value = 'ig'
    search.dispatchEvent(new Event('input'))
    expect(names(card)).toEqual(['utm_source=ig'])
  })

  it('平均 / 合計でグラフの横の値が変わる', async () => {
    const card = await build()
    const legend = (): string => card.querySelector('.rv2-legend')?.textContent ?? ''
    expect(legend()).toContain('1日平均 ¥ 750')
    chip(card, '合計').dispatchEvent(new Event('click'))
    expect(legend()).toContain('期間の合計 ¥ 1,500')
  })

  it('「比較」に印を付けた広告が右の枠に並ぶ', async () => {
    const card = await build()
    expect(card.querySelector('.rv2-compare')).toBeNull()
    const box = card.querySelector('.rv2-creative-param-pick input') as HTMLInputElement
    box.checked = true
    box.dispatchEvent(new Event('change'))
    const table = card.querySelector('.rv2-compare')
    expect(table?.textContent).toContain('utm_source=fb')
  })
})
