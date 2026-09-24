/**
 * ヒートマップの SP / PC で数字が変わる（2026-09-24 点検29）。
 * 以前は枠の幅を変えるだけで、面・見出しの PV は全端末のままだった。
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { installDom } from './helpers/dom.ts'
import type { HeatmapVersionStat, ReportVersionRow } from '../src/app/api.ts'

function stat(pv: number): HeatmapVersionStat {
  return {
    version_uid: 'V1',
    version_name: 'Ver.A',
    param: '',
    bands: 4,
    pv,
    legacy_pv: 0,
    arrival: [1, 0.5, 0.25, 0],
    exit: [0, 0, 0, 1],
    attention: [0, 0, 0, 0],
    elementClick: [0, 0, 0, 0],
    clicks: [],
  }
}

beforeAll(() => {
  installDom()
})

describe('SP / PC の切り替え', () => {
  it('最初は SP の記録で出し、PC を押すと PC の記録に切り替わる', async () => {
    const { renderHeatmapColumns } = await import('../src/app/pages/heatmap-columns.ts')
    const loadDevice = vi.fn(async (device: 'sp' | 'pc') => ({
      versions: [stat(device === 'sp' ? 7 : 3)],
      coverage: [{ version_uid: 'V1', all: 12, sp: 7, tablet: 0, pc: 3 }],
      since: '2026-09-24',
      rows: [{ entity_uid: 'V1', pv: device === 'sp' ? 7 : 3, ctr: 0.5, cv: 1 } as unknown as ReportVersionRow],
      totals: { pv: 0, ctr: null, cv: 0 },
    }))
    const host = document.createElement('div')
    document.body.append(host)
    renderHeatmapColumns(
      host,
      [{ versionUid: 'V1', versionName: 'Ver.A', metric: 'exit', param: '', html: '', css: '', pv: 12, ctr: null, cv: 0 }],
      {
        stats: [stat(12)],
        totals: { pv: 12, ctr: null, cv: 0 },
        externalHtml: null,
        styleCss: '',
        range: { startDate: '2026-09-24', endDate: '2026-09-24' },
        fullPage: false,
        loadDevice,
      },
    )
    await vi.waitFor(() => expect(loadDevice).toHaveBeenCalledWith('sp'))
    await new Promise((r) => setTimeout(r, 0))
    const notes = (): string => [...host.querySelectorAll('.hm-col-note')].map((n) => n.textContent).join('\n')
    expect(notes()).toContain('それより前の 2 PV は端末が分からない')
    expect(host.querySelector('.hm-col-metric span')?.textContent).toContain('PV: 7')

    const pc = [...host.querySelectorAll('.hm-dev button')].find((b) => b.textContent === 'PC') as HTMLElement
    pc.dispatchEvent(new Event('click'))
    await vi.waitFor(() => expect(loadDevice).toHaveBeenCalledWith('pc'))
    await new Promise((r) => setTimeout(r, 0))
    expect(host.querySelector('.hm-col-metric span')?.textContent).toContain('PV: 3')
  })
})
