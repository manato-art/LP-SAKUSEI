/**
 * ヒートマップの色の面とクリックの点は LP の中に、LP と同じ高さで重ねる（2026-09-25・数値面分析テスト）。
 *
 * 以前は LP の外（スマホ枠）に置いていて、クリックの点は全部が枠のいちばん上に重なり、
 * 色の面は LP の 0〜100% を枠の高さ 667px に押し込んでいた（LPをスクロールしても面は動かなかった）。
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'
import { installDom } from './helpers/dom.ts'
import { paintLpLayer } from '../src/app/pages/heatmap-lp-layer.ts'

function lpDocument(height: number): Document {
  const { document } = parseHTML('<!doctype html><html><head></head><body><p>LP</p></body></html>')
  Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, get: () => height })
  return document as unknown as Document
}

beforeAll(() => {
  installDom()
})

describe('LPの中に重ねる面と点', () => {
  it('点はLPの高さに対する位置（4000pxのLPで y=0.5 なら上から2000px）', () => {
    const doc = lpDocument(4000)
    const height = paintLpLayer(doc, {
      stops: null,
      dots: [
        { x: 0.25, y: 0.5 },
        { x: 0.5, y: 0.1 },
      ],
      hideHeat: false,
    })
    expect(height).toBe(4000)
    const layer = doc.getElementById('sb-heatmap-layer') as HTMLElement
    expect(layer.style.height).toBe('4000px')
    const dots = [...layer.querySelectorAll('[data-dot]')] as HTMLElement[]
    expect(dots.map((d) => d.style.top)).toEqual(['2000.0px', '400.0px'])
    expect(dots[0]?.style.left).toBe('25.00%')
  })

  it('面の色の位置もLPの高さで決める（上下にぼかしの余白40pxを足した位置）', () => {
    const doc = lpDocument(1000)
    paintLpLayer(doc, {
      stops: [
        { at: 0, color: 'red' },
        { at: 0.5, color: 'blue' },
      ],
      dots: [],
      hideHeat: false,
    })
    const heat = doc.querySelector('[data-heat]') as HTMLElement
    expect(heat.style.cssText).toContain('red 40.0px')
    expect(heat.style.cssText).toContain('blue 540.0px')
  })

  it('描き直すと前の層は消える（重ねて濃くならない）・熟読箇所を隠すと面だけ消える', () => {
    const doc = lpDocument(1000)
    const spec = { stops: [{ at: 0.5, color: 'red' }], dots: [{ x: 0.5, y: 0.5 }], hideHeat: false }
    paintLpLayer(doc, spec)
    paintLpLayer(doc, spec)
    expect(doc.querySelectorAll('#sb-heatmap-layer')).toHaveLength(1)
    paintLpLayer(doc, { ...spec, hideHeat: true })
    expect(doc.querySelector('[data-heat]')).toBeNull()
    expect(doc.querySelectorAll('[data-dot]')).toHaveLength(1)
  })

  it('何も描かないときは層を置かない', () => {
    const doc = lpDocument(1000)
    paintLpLayer(doc, { stops: [{ at: 0.5, color: 'red' }], dots: [], hideHeat: false })
    paintLpLayer(doc, { stops: null, dots: [], hideHeat: false })
    expect(doc.getElementById('sb-heatmap-layer')).toBeNull()
  })
})

describe('点の大きさ', () => {
  it('LPを縮めて見せるとき用に、点の直径を変えられる（真ん中に置く）', () => {
    const doc = lpDocument(1000)
    paintLpLayer(doc, { stops: null, dots: [{ x: 0.5, y: 0.5 }], dotSize: 26, hideHeat: false })
    const dot = doc.querySelector('[data-dot]') as HTMLElement
    expect(dot.style.width).toBe('26px')
    expect(dot.style.margin).toBe('-13px 0 0 -13px')
  })
})
