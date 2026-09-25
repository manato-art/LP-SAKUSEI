/**
 * クリックの点を、押された回数で色分けする（2026-09-25・指示185「クリックもただのオレンジじゃなくて
 * 回数によって色分けして欲しい。視覚的にわかりやすく」）。
 *
 * 以前は全部の点が同じ薄いオレンジで、同じ場所を何回も押されても（ボタン）、1回だけの所と見分けがつかなかった。
 * 点ごとに「近く（24px以内）で押された回数」を数え、少ない＝青 → 多い＝赤 の色にする（面の色と同じ並び）。
 * 多い点ほど少し大きく、上に重ねる。列の上に色の見方を出す。
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'
import { installDom } from './helpers/dom.ts'
import { paintLpLayer } from '../src/app/pages/heatmap-lp-layer.ts'
import type { HeatmapVersionStat } from '../src/app/api.ts'

function lpDocument(width: number, height: number): Document {
  const { document } = parseHTML('<!doctype html><html><head></head><body></body></html>')
  Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, get: () => height })
  Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, get: () => width })
  return document as unknown as Document
}

beforeAll(() => {
  installDom()
})

describe('クリックの点の色', () => {
  it('同じ場所を何回も押された点は赤、1回だけの点は青（数えた回数も持つ）', () => {
    const doc = lpDocument(400, 2000)
    paintLpLayer(doc, {
      stops: null,
      // ボタン（上から1000px・真ん中）を4回、ほかの所を1回
      dots: [
        { x: 0.5, y: 0.5, cx: 0 },
        { x: 0.5, y: 0.5, cx: 2 },
        { x: 0.5, y: 0.502, cx: -3 },
        { x: 0.5, y: 0.498, cx: 1 },
        { x: 0.2, y: 0.1, cx: -120 },
      ],
      hideHeat: false,
    })
    const dots = [...doc.querySelectorAll<HTMLElement>('[data-dot]')]
    const lonely = dots.find((d) => d.dataset['count'] === '1')!
    const busy = dots.filter((d) => d.dataset['count'] === '4')
    expect(busy).toHaveLength(4)
    expect(lonely.style.cssText).toContain('hsl(240')
    expect(busy[0]!.style.cssText).toContain('hsl(0')
    // 多い点ほど大きく、あとに（上に）置く
    expect(parseFloat(busy[0]!.style.width)).toBeGreaterThan(parseFloat(lonely.style.width))
    expect(dots.indexOf(lonely)).toBe(0)
  })

  it('回数は「倍」で色が進む（最多25回のとき、2回・6回の点も1回の青とは違う色になる）', () => {
    const doc = lpDocument(400, 4000)
    const at = (y: number, n: number) => Array.from({ length: n }, () => ({ x: 0.5, y, cx: 0 }))
    paintLpLayer(doc, { stops: null, dots: [...at(0.1, 1), ...at(0.3, 2), ...at(0.5, 6), ...at(0.8, 25)], hideHeat: false })
    const hueOf = (count: string) =>
      Number(/hsl\((\d+)/.exec([...doc.querySelectorAll<HTMLElement>('[data-dot]')].find((d) => d.dataset['count'] === count)!.style.cssText)?.[1])
    expect(hueOf('1')).toBe(240)
    expect(hueOf('2')).toBeLessThanOrEqual(190)
    expect(hueOf('6')).toBeLessThanOrEqual(110)
    expect(hueOf('25')).toBe(0)
  })

  it('全部が1回ずつなら、全部同じ（少ない側の）色', () => {
    const doc = lpDocument(400, 2000)
    paintLpLayer(doc, {
      stops: null,
      dots: [
        { x: 0.1, y: 0.1, cx: -150 },
        { x: 0.9, y: 0.9, cx: 150 },
      ],
      hideHeat: false,
    })
    const colors = [...doc.querySelectorAll<HTMLElement>('[data-dot]')].map((d) => /hsl\([^)]*\)/.exec(d.style.cssText)?.[0])
    expect(new Set(colors).size).toBe(1)
  })
})

describe('色の見方', () => {
  it('クリック数の線のときだけ、列の上に「青＝少ない → 赤＝多い」を出す', async () => {
    const { renderHeatmapColumns } = await import('../src/app/pages/heatmap-columns.ts')
    const bands = 10
    const stat: HeatmapVersionStat = {
      version_uid: 'V1', version_name: 'A', param: '', bands, pv: 5, legacy_pv: 0,
      arrival: new Array<number>(bands).fill(1), exit: new Array<number>(bands).fill(0.1),
      attention: new Array<number>(bands).fill(0), elementClick: [0, 2, 0, 0, 0, 0, 0, 0, 0, 0],
      clicks: [{ x: 0.5, y: 0.15, cx: 0 }, { x: 0.5, y: 0.15, cx: 0 }],
    }
    const host = document.createElement('div')
    document.body.append(host)
    renderHeatmapColumns(
      host,
      [{ versionUid: 'V1', versionName: 'A', metric: 'click', param: '', html: '', css: '', pv: 5, ctr: null, cv: 0 }],
      { stats: [stat], totals: { pv: 5, ctr: null, cv: 0 }, externalHtml: null, styleCss: '', range: { startDate: '2026-09-25', endDate: '2026-09-25' }, fullPage: false },
    )
    const legend = host.querySelector<HTMLElement>('.hm-click-legend')
    expect(legend?.hidden).toBe(false)
    expect(legend?.textContent).toContain('押された回数')
    const select = host.querySelector<HTMLSelectElement>('.hm-line-select')!
    select.value = 'arrival'
    select.dispatchEvent(new Event('change'))
    expect(legend?.hidden).toBe(true)
  })
})
