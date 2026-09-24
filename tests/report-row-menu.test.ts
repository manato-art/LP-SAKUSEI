/**
 * レポート一覧の行末「⋮」とアーカイブ列（2026-09-24 点検19）。
 * 以前は ⋮ に何も付いておらず（title「未実装」）、アーカイブ列は常に「-」だった。
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { installDom } from './helpers/dom.ts'
import type { ReportVersionRow } from '../src/app/api.ts'

function row(patch: Partial<ReportVersionRow> = {}): ReportVersionRow {
  return {
    scope: 'version',
    entity_uid: 'VER_1',
    name: 'Ver.A',
    status: '公開中',
    distribution_ratio: 100,
    pv: 1, click: 0, cv: 0, ad_cost: 0, imp: 0, media_click: 0, media_cv: 0,
    sales: 0, gross_profit: 0, roas: null, roi: null, cvr: null, cpa: null,
    ctr: null, ctvr: null, media_ctr: null, mcpa: null,
    fver: null, sver: null, fsver: null, oar: null,
    ...patch,
  }
}

beforeAll(() => {
  installDom()
})

describe('レポート一覧の行', () => {
  it('アーカイブ済みの Version は「アーカイブ済み」と出す', async () => {
    const { buildReportList } = await import('../src/app/pages/report-v2-tables.ts')
    const card = buildReportList({
      rows: [row({ archived: true })],
      range: { startDate: '2026-09-24', endDate: '2026-09-24' },
      abTestUid: 'AB1',
    })
    expect(card.querySelector('tbody td[data-label="アーカイブ"]')?.textContent).toBe('アーカイブ済み')
  })

  it('⋮ を押すと、ほかの画面にある操作が並ぶ（未実装とは書かない）', async () => {
    const { buildReportList } = await import('../src/app/pages/report-v2-tables.ts')
    const onPickVersion = vi.fn()
    const card = buildReportList({
      rows: [row()],
      range: { startDate: '2026-09-24', endDate: '2026-09-24' },
      abTestUid: 'AB1',
      onPickVersion,
    })
    const button = card.querySelector('.rv2-rowmenu') as HTMLElement
    expect(button.title).not.toContain('未実装')
    button.dispatchEvent(new Event('click'))
    const items = [...card.querySelectorAll('.rv2-rowmenu-wrap .rv2-sortmenu-item')]
    expect(items.map((i) => i.textContent)).toEqual([
      'このVersionだけで絞る',
      'ヒートマップを見る',
      'プレビューを開く（新しいタブ）',
      'エディタを開く',
    ])
    const heatmap = items[1] as HTMLAnchorElement
    expect(heatmap.getAttribute('href')).toBe('#/ab_tests/AB1/articles/htmls/heatmaps/comparisons')
    const preview = items[2] as HTMLAnchorElement
    expect(preview.getAttribute('href')).toContain('/preview/VER_1')
    expect(preview.getAttribute('target')).toBe('_blank')
    items[0]?.dispatchEvent(new Event('click'))
    expect(onPickVersion).toHaveBeenCalledWith('VER_1')
  })
})
