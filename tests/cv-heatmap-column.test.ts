/**
 * ヒートマップの「CV」の列＝申し込んだ人だけのヒートマップ（2026-09-25・本人「CVボタンは作り直して…」）。
 *
 * 以前のCVの列は「画面のどこで起きたかを記録していない」ので色も線も出さなかった（見出しの件数だけ）。
 * 今は申し込んだ人の記録（segment=cv）で、到達率・離脱率・滞在時間・クリックを他の列と同じ形で出す。既定は到達率。
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { installDom } from './helpers/dom.ts'
import type { HeatmapVersionStat } from '../src/app/api.ts'

function stat(pv: number, reachTo: number): HeatmapVersionStat {
  const bands = 10
  return {
    version_uid: 'V1',
    version_name: 'A',
    param: '',
    bands,
    pv,
    legacy_pv: 0,
    arrival: Array.from({ length: bands }, (_, i) => (i <= reachTo ? 1 : 0)),
    exit: Array.from({ length: bands }, (_, i) => (i === reachTo ? 1 : 0)),
    attention: new Array<number>(bands).fill(0),
    elementClick: new Array<number>(bands).fill(0),
    clicks: [],
  }
}

beforeAll(() => {
  installDom()
})

async function renderCvColumn(cvStats: readonly HeatmapVersionStat[] | undefined) {
  const { renderHeatmapColumns } = await import('../src/app/pages/heatmap-columns.ts')
  const host = document.createElement('div')
  document.body.append(host)
  renderHeatmapColumns(
    host,
    [{ versionUid: 'V1', versionName: 'A', metric: 'cv', param: '', html: '', css: '', pv: 10, ctr: 0.3, cv: 2 }],
    {
      // ふつうのヒートマップは10人・全員が最後まで見た
      stats: [stat(10, 9)],
      ...(cvStats === undefined ? {} : { cvStats }),
      totals: { pv: 10, ctr: 0.3, cv: 2 },
      externalHtml: null,
      styleCss: '',
      range: { startDate: '2026-09-25', endDate: '2026-09-25' },
      fullPage: false,
    },
  )
  await new Promise((r) => setTimeout(r, 0))
  return host
}

describe('CVの列', () => {
  it('既定のラインは到達率（申し込んだ人がどこまで読んだか）', async () => {
    const { defaultModeFor } = await import('../src/app/pages/heatmap-columns.ts')
    expect(defaultModeFor('cv')).toBe('arrival')
  })

  it('申し込んだ人の記録で線を出す（ふつうのヒートマップの記録ではなく）', async () => {
    // 申し込んだ2人は、LPの半分（バンド4）まで読んでいた
    const host = await renderCvColumn([stat(2, 4)])
    const pills = [...host.querySelectorAll('.hm-pill')].map((p) => p.textContent)
    expect(pills[0]).toBe('2人 100%到達')
    expect(pills[10]).toBe('1%未満到達') // 50%
    const notes = [...host.querySelectorAll('.hm-col-note')].map((n) => n.textContent).join('\n')
    expect(notes).toContain('申し込んだ人だけ（2人）')
  })

  it('申し込んだ人の記録がまだ無ければ、そうと書く', async () => {
    const host = await renderCvColumn([])
    expect(host.querySelector('.hm-empty')?.textContent).toContain('申し込んだ人のヒートマップはまだありません')
  })
})

describe('CVの列の端末の断り書き', () => {
  it('申し込んだ人の人数で書く（全員の人数ではなく）', async () => {
    const { renderHeatmapColumns } = await import('../src/app/pages/heatmap-columns.ts')
    const host = document.createElement('div')
    document.body.append(host)
    renderHeatmapColumns(
      host,
      [{ versionUid: 'V1', versionName: 'A', metric: 'cv', param: '', html: '', css: '', pv: 62, ctr: 0.3, cv: 5 }],
      {
        stats: [stat(62, 9)],
        cvStats: [stat(5, 4)],
        totals: { pv: 62, ctr: 0.3, cv: 5 },
        externalHtml: null,
        styleCss: '',
        range: { startDate: '2026-09-25', endDate: '2026-09-25' },
        fullPage: false,
        loadDevice: async () => ({
          versions: [stat(30, 9)],
          cvVersions: [stat(3, 4)],
          coverage: [{ version_uid: 'V1', all: 62, sp: 30, tablet: 21, pc: 11 }],
          cvCoverage: [{ version_uid: 'V1', all: 5, sp: 3, tablet: 1, pc: 1 }],
          since: '2026-09-24',
          rows: [],
          totals: { pv: 0, ctr: null, cv: 0 },
        }),
      },
    )
    await new Promise((r) => setTimeout(r, 10))
    const notes = [...host.querySelectorAll('.hm-col-note')].map((n) => n.textContent).join('\n')
    expect(notes).toContain('申し込んだ人だけ（3人）')
    expect(notes).toContain('タブレットの 1 人')
    expect(notes).not.toContain('21')
  })
})
