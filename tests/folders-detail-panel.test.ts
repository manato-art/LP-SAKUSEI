/**
 * ページ一覧の右の詳細パネル（2026-09-24 点検）。
 *
 * 行にカーソルを当てるとパネルはそのページの内容に描き直されるのに、
 * 「コピー」「パラメータ付きURLの発行」は最初に配線したときの1件目のURLを、
 * 鉛筆（その場編集）は1件目のページを書き換えていた。どれも「いまパネルに出ているページ」に効かせる。
 * 配信タイプは生の値（same_url）が出ていた → 日本語の表示名にする。
 *
 * DOM は linkedom で、採取した実物のパネル（folders__detail.html）を使って確かめる。
 */
import { readFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AbTest, Folder } from '../src/app/api.ts'
import type { PageContext } from '../src/app/pages/folders-shared.ts'

const html = readFileSync('src/app/fragments/folders__detail.html', 'utf8')
const g = globalThis as unknown as Record<string, unknown>
const saved: Record<string, unknown> = {}
const GLOBALS = ['document', 'window', 'Node', 'NodeFilter', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'location', 'navigator', 'fetch', 'requestAnimationFrame', 'HashChangeEvent', 'dispatchEvent']

let writes: string[] = []
let requests: { url: string; body: string }[] = []

function setupDom(): HTMLElement {
  const { document, window } = parseHTML(`<!doctype html><html><body>${html}</body></html>`)
  for (const key of GLOBALS) saved[key] = g[key]
  const w = window as unknown as Record<string, unknown>
  Object.defineProperty(globalThis, 'document', { value: document, configurable: true, writable: true })
  Object.defineProperty(globalThis, 'window', { value: window, configurable: true, writable: true })
  g['Node'] = w['Node']
  // linkedom は NodeFilter を持たないので、使う定数だけ用意する（ブラウザと同じ値）
  g['NodeFilter'] = { SHOW_TEXT: 4 }
  g['HTMLElement'] = w['HTMLElement']
  g['HTMLInputElement'] = w['HTMLInputElement']
  g['HTMLSelectElement'] = w['HTMLSelectElement']
  Object.defineProperty(globalThis, 'location', { value: { origin: 'http://localhost:5173', hash: '' }, configurable: true, writable: true })
  Object.defineProperty(globalThis, 'navigator', {
    value: { clipboard: { writeText: async (text: string) => { writes.push(text) } } },
    configurable: true,
    writable: true,
  })
  g['fetch'] = vi.fn(async (url: string, init?: { body?: string }) => {
    requests.push({ url, body: init?.body ?? '' })
    return { ok: true, status: 200, json: async () => ({ ab_test: {} }) }
  })
  g['requestAnimationFrame'] = (fn: () => void) => fn()
  g['HashChangeEvent'] = class extends (w['Event'] as typeof Event) {}
  g['dispatchEvent'] = () => true
  const body = document.querySelector('.ehppitp0')
  if (body === null) throw new Error('採取物の本体がありません')
  return body as unknown as HTMLElement
}

const folder: Folder = { id: 1, uid: 'FOLDER_0001', name: 'フォルダA', parent_id: null, domain: 'system', ab_tests_count: 2, is_favorite: false }

const page = (id: number, uid: string, title: string, extra: Partial<AbTest> = {}): AbTest => ({
  id,
  uid,
  title,
  ad_status: 'prepared',
  editor_version: 2,
  folder_id: 1,
  media: null,
  delivery_type: 'same_url',
  ...extra,
})

function context(): PageContext {
  return {
    folders: [folder],
    folder,
    folderUid: folder.uid,
    abTests: [page(10, 'PAGE_ONE', '1件目'), page(20, 'PAGE_TWO', '2件目', { ad_status: 'delivered' })],
    relationCounts: [
      { id: 10, versions_count: 1, funnel_steps_count: 0, exit_popups_count: 0, follow_popups_count: 0, popups_count: 0, redirect_pages_count: 0, has_conversion: false, ab_test_uid: 'PAGE_ONE' },
      { id: 20, versions_count: 3, funnel_steps_count: 1, exit_popups_count: 1, follow_popups_count: 1, popups_count: 2, redirect_pages_count: 4, has_conversion: true, ab_test_uid: 'PAGE_TWO' },
    ],
  }
}

function ddText(body: HTMLElement, dtText: string): string {
  const dt = [...body.querySelectorAll('dt')].find((d) => (d.textContent ?? '').trim() === dtText)
  return (dt?.nextElementSibling?.textContent ?? '').trim()
}

beforeEach(() => {
  writes = []
  requests = []
})

afterEach(async () => {
  // 開いた小窓が後から document に触る（setTimeout 0）ので、それが済んでから元に戻す
  await new Promise((resolve) => setTimeout(resolve, 5))
  for (const key of GLOBALS) {
    Object.defineProperty(globalThis, key, { value: saved[key], configurable: true, writable: true })
  }
})

describe('詳細パネルは、いま出ているページに効く', () => {
  it('2件目にカーソルを当てたあとの「コピー」は2件目の配信URL', async () => {
    const body = setupDom()
    const { wireRealDetailPanel, updateDetailPanelForAbTest } = await import('../src/app/pages/folders-detail-panel.ts')
    const ctx = context()
    wireRealDetailPanel(body, ctx)
    updateDetailPanelForAbTest(body, ctx.abTests[0] as AbTest, ctx)
    updateDetailPanelForAbTest(body, ctx.abTests[1] as AbTest, ctx)
    const copy = body.querySelector('[aria-label="コピー"]') as unknown as HTMLElement
    copy.dispatchEvent(new (window as unknown as { Event: typeof Event }).Event('click'))
    await Promise.resolve()
    expect(writes).toEqual(['http://localhost:5173/lp/PAGE_TWO'])
  })

  it('鉛筆（配信ステータス）の保存は、いま出ているページへ送る', async () => {
    const body = setupDom()
    const { wireRealDetailPanel, updateDetailPanelForAbTest } = await import('../src/app/pages/folders-detail-panel.ts')
    const ctx = context()
    wireRealDetailPanel(body, ctx)
    updateDetailPanelForAbTest(body, ctx.abTests[1] as AbTest, ctx)
    const panel = body.querySelector('.efy50tl16') as unknown as HTMLElement
    const pencil = panel.querySelector('[data-testid="pencil-icon"]') as unknown as HTMLElement
    const target = (pencil.closest('.css-fbr94v') ?? pencil) as HTMLElement
    target.dispatchEvent(new (window as unknown as { Event: typeof Event }).Event('click'))
    const popover = document.querySelector('.sb-inline-edit')
    expect(popover).not.toBeNull()
    // linkedom の select.value は読み取り専用なので、選ばれている option を差し替える
    for (const option of popover?.querySelectorAll('option') ?? []) {
      if (option.textContent === '終了') option.setAttribute('selected', '')
      else option.removeAttribute('selected')
    }
    const save = [...(popover?.querySelectorAll('button') ?? [])].find((b) => b.textContent === '保存') as unknown as HTMLElement
    save.dispatchEvent(new (window as unknown as { Event: typeof Event }).Event('click'))
    await Promise.resolve()
    expect(requests.map((r) => r.url)).toEqual(['/api/v1/ab_tests/PAGE_TWO'])
    expect(JSON.parse(requests[0]?.body ?? '{}')).toEqual({ ad_status: 'finished' })
  })
})

describe('詳細パネルの表示', () => {
  it('配信タイプは日本語の表示名、件数は関連数の実数（中間ページ・ポップアップは両方の合計）', async () => {
    const body = setupDom()
    const { wireRealDetailPanel, updateDetailPanelForAbTest } = await import('../src/app/pages/folders-detail-panel.ts')
    const ctx = context()
    wireRealDetailPanel(body, ctx)
    updateDetailPanelForAbTest(body, ctx.abTests[1] as AbTest, ctx)
    expect(ddText(body, '配信タイプ')).toBe('同一URL配信')
    expect(ddText(body, '中間ページ数')).toBe('4')
    expect(ddText(body, 'ポップアップ数')).toBe('2')
    expect(ddText(body, 'バージョン数')).toBe('3')
  })

  it('値を書き換えても鉛筆は消えない（以前は配信ステータスの鉛筆ごと文字で上書きしていた）', async () => {
    const body = setupDom()
    const { wireRealDetailPanel, updateDetailPanelForAbTest } = await import('../src/app/pages/folders-detail-panel.ts')
    const ctx = context()
    wireRealDetailPanel(body, ctx)
    updateDetailPanelForAbTest(body, ctx.abTests[1] as AbTest, ctx)
    const panel = body.querySelector('.efy50tl16') as unknown as HTMLElement
    expect(ddText(body, '配信ステータス')).toBe('配信中')
    expect(panel.querySelectorAll('[data-testid="pencil-icon"]')).toHaveLength(6)
  })

  it('関連数を取れなかったときは「-」', async () => {
    const body = setupDom()
    const { wireRealDetailPanel, updateDetailPanelForAbTest } = await import('../src/app/pages/folders-detail-panel.ts')
    const ctx = { ...context(), relationCounts: null }
    wireRealDetailPanel(body, ctx)
    updateDetailPanelForAbTest(body, ctx.abTests[1] as AbTest, ctx)
    expect(ddText(body, '中間ページ数')).toBe('-')
  })
})
