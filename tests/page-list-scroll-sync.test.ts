/**
 * ページ一覧の数字の列を横に送ったら、見出し・合計・ほかの行も同じだけ送る（2026-10-27 一覧の作り直し）。
 * それまでは行ごとに別々に送られ、列がずれていた。
 */
import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'
import { syncKpiScroll } from '../src/app/pages/folders-list-scroll-sync.ts'

describe('数字の列の横の送り', () => {
  it('どこか1か所を送ると、ほかの見出し・合計・行も同じ位置になる', () => {
    const { document, Event } = parseHTML(
      '<div id="area"><div class="el51yfs3"></div><div class="en4zj402"></div><div class="e14sgd471"></div><div class="e14sgd471"></div><div class="other"></div></div>',
    )
    const area = document.getElementById('area') as unknown as HTMLElement
    syncKpiScroll(area, new AbortController().signal)
    const [header, totals, row1, row2] = [...area.querySelectorAll<HTMLElement>('.el51yfs3, .en4zj402, .e14sgd471')]
    if (row1 === undefined) throw new Error('行が無い')
    row1.scrollLeft = 120
    // 本物の scroll は伝わらない（画面側は capture で受ける）。linkedom は capture の段を持たないので、伝わる形で送る
    row1.dispatchEvent(new Event('scroll', { bubbles: true }))
    expect([header?.scrollLeft, totals?.scrollLeft, row2?.scrollLeft]).toEqual([120, 120, 120])
    expect((area.querySelector('.other') as unknown as HTMLElement).scrollLeft ?? 0).not.toBe(120)
  })
})
