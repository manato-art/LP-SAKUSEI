/**
 * Version の行の配信金額は「-」（2026-09-24 点検22）。
 *
 * 配信金額はページにしか入らないので、Version・広告の行では「分からない」。
 * ¥0 と出すと「お金をかけずにCVした」ように読め、CPA も ¥0 に見えていた。
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { installDom } from './helpers/dom.ts'
import type { ReportVersionRow } from '../src/app/api.ts'

function row(patch: Partial<ReportVersionRow> = {}): ReportVersionRow {
  return {
    scope: 'version',
    entity_uid: 'V1',
    name: 'Ver.A',
    status: '公開中',
    distribution_ratio: 100,
    pv: 100, click: 10, cv: 2, ad_cost: 0, imp: 0, media_click: 0, media_cv: 0,
    sales: 0, gross_profit: 0, roas: null, roi: null, cvr: 0.2, cpa: null,
    ctr: 0.1, ctvr: 0.02, media_ctr: null, mcpa: null,
    fver: null, sver: null, fsver: null, oar: null,
    cost_known: false,
    ...patch,
  }
}

beforeAll(() => {
  installDom()
})

describe('配信金額が分からない行', () => {
  it('レポート一覧の配信金額は「-」', async () => {
    const { buildReportList } = await import('../src/app/pages/report-v2-tables.ts')
    const card = buildReportList({ rows: [row()], range: { startDate: '2026-09-24', endDate: '2026-09-24' } })
    const cell = card.querySelector('tbody td[data-label="配信金額"]')
    expect(cell?.textContent).toBe('-')
  })

  it('Branch Operation の配信金額・CPAは「-」。絞り込んだ合計も「-」', async () => {
    const { buildBranchOperation } = await import('../src/app/pages/report-v2-tables.ts')
    const card = buildBranchOperation({
      rows: [row()],
      totals: { ...row(), ad_cost: 30000, cpa: 15000 },
      onDownloadCsv: () => undefined,
    })
    const lines = [...card.querySelectorAll('tbody tr')]
    const versionLine = lines[1]
    expect(versionLine?.querySelector('td[data-label="配信金額"]')?.textContent).toBe('-')
    expect(versionLine?.querySelector('td[data-label="CPA"]')?.textContent).toBe('-')
  })

  it('クリエイティブの広告の行も、足したあと CPA を ¥0 にしない', async () => {
    const { creativeParameterRows } = await import('../src/app/pages/report-creative-rows.ts')
    const child = row({ scope: 'parameter', entity_uid: 'V1|utm_source=fb', name: 'utm_source=fb' })
    const out = creativeParameterRows([row({ creative_children: [child] }), row({ entity_uid: 'V2', creative_children: [child] })])
    expect(out[0]?.cpa).toBeNull()
    expect(out[0]?.cost_known).toBe(false)
  })
})
