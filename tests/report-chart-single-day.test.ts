/**
 * クリエイティブレポートのグラフは、期間が1日だけでも点を出す（2026-09-25・指示184「グラフが表示されない」）。
 *
 * 折れ線（polyline）は2点以上ないと何も描かれず、1点のときの面も幅0になる。点の印を描いていなかったので、
 * 期間が「今日」だけ（既定）だと、目盛りだけで中身が何も見えなかった。点ごとに印を描き、1点のときは値も添える。
 * 図は横幅に合わせて横に引き伸ばす作りなので、丸を図の中に描くと楕円になる。点と値は図の上に重ねて置く。
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { installDom } from './helpers/dom.ts'
import type { ReportDailyRow } from '../src/app/api.ts'

function day(date: string, cvr: number | null): ReportDailyRow {
  return {
    date, pv: 100, click: 30, cv: 20, ad_cost: 0, imp: 0, media_click: 0, media_cv: 0,
    sales: 0, gross_profit: 0, roas: null, roi: null, cvr, cpa: null,
    ctr: 0.3, ctvr: 0.2, media_ctr: null, mcpa: null, fver: null, sver: null, fsver: null, oar: null,
  } as ReportDailyRow
}

beforeAll(() => {
  installDom()
})

async function chartOf(daily: ReportDailyRow[], tab: string): Promise<Element | null> {
  const { buildCreativeReport } = await import('../src/app/pages/report-v2-chart.ts')
  const card = buildCreativeReport({
    daily,
    range: { startDate: daily[0]!.date, endDate: daily[daily.length - 1]!.date },
    onDownloadCsv: () => undefined,
  })
  document.body.append(card)
  const button = [...card.querySelectorAll<HTMLElement>('.rv2-tab')].find((b) => b.textContent === tab)
  button?.click()
  return card.querySelector('.rv2-chart-wrap')
}

describe('1日だけのグラフ', () => {
  it('点の印を1つ描き、その値を添える', async () => {
    const wrap = await chartOf([day('2026-09-25', 0.6452)], 'CVR')
    expect(wrap?.querySelector('svg.rv2-chart')).not.toBeNull()
    const dots = [...wrap!.querySelectorAll<HTMLElement>('.rv2-chart-dot')]
    expect(dots).toHaveLength(1)
    // 1点は横の真ん中（図の横幅 720 の中で、左の余白 66・右の余白 12 の間の真ん中）
    expect(dots[0]!.style.left).toBe(`${(((66 + (720 - 66 - 12) / 2) / 720) * 100).toFixed(3)}%`)
    expect(wrap!.querySelector('.rv2-chart-value')?.textContent).toBe('64.52%')
  })

  it('2日以上なら、線に加えて日ごとの点も描く（値の文字は出さない）', async () => {
    const wrap = await chartOf([day('2026-09-24', 0.5), day('2026-09-25', 0.6)], 'CVR')
    expect(wrap!.querySelectorAll('.rv2-chart-dot')).toHaveLength(2)
    expect(wrap!.querySelector('.rv2-chart-value')).toBeNull()
  })
})
