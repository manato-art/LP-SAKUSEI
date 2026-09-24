/**
 * ページ一覧の描き直し（2026-09-24 点検）: ラベル・行・合計行が、選んでいる絞り込み・並びと食い違わない。
 * 採取した実物の一覧（folders__detail.html）を linkedom で開き、実物の行を使って確かめる。
 */
import { readFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AbTest } from '../src/app/api.ts'
import type { PageContext } from '../src/app/pages/folders-shared.ts'

const html = readFileSync('src/app/fragments/folders__detail.html', 'utf8')
const g = globalThis as unknown as Record<string, unknown>
const saved = { document: g['document'], fetch: g['fetch'], HTMLElement: g['HTMLElement'] }
let totalRequests: string[] = []

function setup(): HTMLElement {
  const { document, window } = parseHTML(`<!doctype html><html><body>${html}</body></html>`)
  Object.defineProperty(globalThis, 'document', { value: document, configurable: true, writable: true })
  g['HTMLElement'] = (window as unknown as Record<string, unknown>)['HTMLElement']
  totalRequests = []
  g['fetch'] = vi.fn(async (url: string) => {
    totalRequests.push(url)
    return { ok: true, status: 200, json: async () => ({ reports_total: { pv: 0, click: 0, cv: 0, ad_cost: 0, imp: 0, media_click: 0, media_cv: 0, sales: 0, ctr: null, cvr: null, ctvr: null, cpa: null, mcpa: null, media_ctr: null, roas: null } }) }
  })
  const main = document.querySelector('.e11hwzd00') as unknown as HTMLElement
  // 実物の行を3つだけ残し、ページの uid を付ける（一覧が行を作るときと同じ目印）
  const container = main.querySelector('.efy50tl18') as HTMLElement
  const rows = [...container.children].filter((c) => c.querySelector('[data-testid="list-menu-item"]') !== null) as HTMLElement[]
  rows.slice(3).forEach((r) => r.remove())
  ;['A', 'B', 'C'].forEach((uid, i) => {
    ;(rows[i] as HTMLElement).dataset['abTestUid'] = uid
  })
  return main
}

const page = (uid: string, title: string, updated: number, status: string): AbTest => ({
  uid,
  title,
  id: uid.charCodeAt(0),
  ad_status: status,
  editor_version: 2,
  folder_id: 1,
  media: null,
  created_at: updated,
  updated_at: updated,
})

const context = (): PageContext => ({
  folders: [],
  folder: null,
  folderUid: 'FOLDER_0001',
  abTests: [page('A', 'りんご', 1, 'prepared'), page('B', 'いちご', 3, 'finished'), page('C', 'ぶどう', 2, 'delivered')],
  relationCounts: [],
})

const order = (main: HTMLElement): string[] =>
  [...(main.querySelector('.efy50tl18')?.children ?? [])]
    .map((c) => (c as HTMLElement).dataset['abTestUid'])
    .filter((uid): uid is string => uid !== undefined)

const shown = (main: HTMLElement): string[] =>
  [...(main.querySelector('.efy50tl18')?.children ?? [])]
    .filter((c) => (c as HTMLElement).dataset['abTestUid'] !== undefined && (c as HTMLElement).style.display !== 'none')
    .map((c) => (c as HTMLElement).dataset['abTestUid'] as string)

afterEach(() => {
  Object.defineProperty(globalThis, 'document', { value: saved.document, configurable: true, writable: true })
  g['fetch'] = saved.fetch
  g['HTMLElement'] = saved.HTMLElement
})

describe('一覧の描き直し', () => {
  it('既定は更新順（新しい順）で、ラベルは「更新順」「配信ステータス：すべて」', async () => {
    const main = setup()
    const { refreshListView } = await import('../src/app/pages/folders-list-controls.ts')
    const { updateListState } = await import('../src/app/pages/folders-list-state.ts')
    updateListState({ status: 'all', sort: 'updated', pageQuery: null })
    refreshListView(main, context())
    expect(order(main)).toEqual(['B', 'C', 'A'])
    expect(main.textContent).toContain('配信ステータス：すべて')
    expect(main.textContent).not.toContain('配信ステータス：終了以外')
  })

  it('選んだ絞り込みは、描き直した一覧にも効き、ラベルも合う。合計は出ている行だけ', async () => {
    const main = setup()
    const { refreshListView } = await import('../src/app/pages/folders-list-controls.ts')
    const { updateListState } = await import('../src/app/pages/folders-list-state.ts')
    updateListState({ status: 'except_finished', sort: 'name', pageQuery: null })
    refreshListView(main, context())
    expect(shown(main)).toEqual(['C', 'A'])
    expect(order(main)).toEqual(['B', 'C', 'A'])
    expect(main.textContent).toContain('配信ステータス：終了以外')
    expect(main.textContent).toContain('名前順')
    await Promise.resolve()
    expect(totalRequests.at(-1)).toContain('/folders/FOLDER_0001/ab_tests/reports_total?')
    expect(decodeURIComponent(totalRequests.at(-1) ?? '')).toContain('ab_test_uids=C,A')
  })

  it('合計行に採取物のフェイク値（1,031 など）を残さない', async () => {
    const main = setup()
    const { refreshListView } = await import('../src/app/pages/folders-list-controls.ts')
    refreshListView(main, context())
    const total = main.querySelector('.en4zj406')?.textContent ?? ''
    expect(total).not.toContain('1,031')
    expect(total).not.toContain('10.31%')
  })
})
