/**
 * ページ一覧の絞り込み・並び替え・行のアイコン（2026-09-24 点検）。
 *
 *   - 配信ステータスの絞り込み: ラベルが採取物の「終了以外」のまま・「終了以外」の選択肢が無い・
 *     選んでもラベルが変わらない・フォルダを切り替えると行に効いていない → ラベル・メニュー・行を1つの状態から出す
 *   - 「更新順」は押しても何も起きず、一覧は作成順だった → 更新順 / 作成順 / 名前順（数値が読めたら PV順・CV順）
 *   - 行のアイコンは採取物の数字（Version 2 / ステップ 0 / ポップアップ 0 / 中間ページ 1 / CVタグ未設定）のままだった
 */
import { readFileSync } from 'node:fs'
import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'
import {
  SORT_OPTIONS,
  STATUS_FILTER_OPTIONS,
  isPageVisible,
  pageRowRoutes,
  sortLabel,
  sortPages,
  statusFilterLabel,
} from '../src/app/pages/folders-list-view.ts'
import { applyRowCounts } from '../src/app/pages/folders-row-icons.ts'

const page = (uid: string, title: string, created: number, updated: number, status = 'prepared') => ({
  uid,
  title,
  ad_status: status,
  created_at: created,
  updated_at: updated,
})

describe('配信ステータスの絞り込み', () => {
  it('選択肢は すべて / 終了以外 / 準備中 / 配信中 / 停止中 / 終了', () => {
    expect(STATUS_FILTER_OPTIONS.map((o) => o.label)).toEqual(['すべて', '終了以外', '準備中', '配信中', '停止中', '終了'])
  })

  it('ラベルはいま選んでいるものを出す', () => {
    expect(statusFilterLabel('all')).toBe('配信ステータス：すべて')
    expect(statusFilterLabel('except_finished')).toBe('配信ステータス：終了以外')
    expect(statusFilterLabel('delivered')).toBe('配信ステータス：配信中')
  })

  it('終了以外は終了だけを隠す・個別の値はその値だけを出す', () => {
    const finished = page('a', 'A', 1, 1, 'finished')
    const running = page('b', 'B', 1, 1, 'delivered')
    expect(isPageVisible(finished, { status: 'except_finished', query: '' })).toBe(false)
    expect(isPageVisible(running, { status: 'except_finished', query: '' })).toBe(true)
    expect(isPageVisible(running, { status: 'stopping', query: '' })).toBe(false)
    expect(isPageVisible(running, { status: 'all', query: '' })).toBe(true)
  })

  it('ページ名の検索と一緒に効く（大文字小文字は区別しない）', () => {
    const p = page('a', 'Summer LP', 1, 1, 'prepared')
    expect(isPageVisible(p, { status: 'all', query: 'summer' })).toBe(true)
    expect(isPageVisible(p, { status: 'all', query: 'winter' })).toBe(false)
  })
})

describe('並び替え', () => {
  const pages = [page('a', 'いちご', 100, 300), page('b', 'あんず', 200, 100), page('c', 'うめ', 300, 200)]

  it('選択肢は 更新順 / 作成順 / 名前順 / PV順 / CV順', () => {
    expect(SORT_OPTIONS.map((o) => o.label)).toEqual(['更新順', '作成順', '名前順', 'PV順', 'CV順'])
    expect(sortLabel('updated')).toBe('更新順')
  })

  it('更新順・作成順は新しいものが上', () => {
    expect(sortPages(pages, 'updated', new Map()).map((p) => p.uid)).toEqual(['a', 'c', 'b'])
    expect(sortPages(pages, 'created', new Map()).map((p) => p.uid)).toEqual(['c', 'b', 'a'])
  })

  it('名前順は五十音', () => {
    expect(sortPages(pages, 'name', new Map()).map((p) => p.title)).toEqual(['あんず', 'いちご', 'うめ'])
  })

  it('PV順・CV順は読めた数値の多い順（読めていない行は下）', () => {
    const metrics = new Map([
      ['a', { pv: 5, cv: 2 }],
      ['b', { pv: 50, cv: 0 }],
    ])
    expect(sortPages(pages, 'pv', metrics).map((p) => p.uid)).toEqual(['b', 'a', 'c'])
    expect(sortPages(pages, 'cv', metrics).map((p) => p.uid)).toEqual(['a', 'b', 'c'])
  })

  it('元の配列は並べ替えない（イミュータブル）', () => {
    const before = pages.map((p) => p.uid)
    sortPages(pages, 'name', new Map())
    expect(pages.map((p) => p.uid)).toEqual(before)
  })
})

describe('行のアイコンを実数にする', () => {
  const html = readFileSync('src/app/fragments/folders__detail.html', 'utf8')

  function capturedRow(): HTMLElement {
    const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`)
    const item = document.querySelector('.efy50tl18 [data-testid="list-menu-item"]')
    if (item === null) throw new Error('採取物に行がありません')
    return item as unknown as HTMLElement
  }

  const countOf = (row: HTMLElement, testId: string): string =>
    (row.querySelector(`[data-testid="${testId}"]`)?.parentElement?.textContent ?? '').trim()

  it('Version / ステップ / ポップアップ / 中間ページ / CV を関連数の値にする', () => {
    const row = capturedRow()
    applyRowCounts(row, {
      id: 1,
      versions_count: 3,
      funnel_steps_count: 1,
      exit_popups_count: 1,
      follow_popups_count: 1,
      popups_count: 2,
      redirect_pages_count: 0,
      has_conversion: true,
      ab_test_uid: 'x',
    })
    expect(countOf(row, 'version-icon')).toBe('3')
    expect(countOf(row, 'funnel-icon')).toBe('1')
    expect(countOf(row, 'popup-icon')).toBe('2')
    expect(countOf(row, 'redirectPage-icon')).toBe('0')
    expect(row.textContent).toContain('CV計測あり')
    expect(row.textContent).not.toContain('CVタグ未設定')
  })

  it('関連数を取れなかったときは採取物の数字を残さず「-」にする', () => {
    const row = capturedRow()
    applyRowCounts(row, null)
    for (const id of ['version-icon', 'funnel-icon', 'popup-icon', 'redirectPage-icon']) {
      expect(countOf(row, id)).toBe('-')
    }
    expect(row.textContent).not.toContain('CVタグ未設定')
  })
})

describe('行のボタンの行き先（main.ts に実在する画面へ）', () => {
  const main = readFileSync('src/app/main.ts', 'utf8')

  it('歯車は基本情報、ヒートマップはヒートマップ画面へ', () => {
    const routes = pageRowRoutes('PAGE1', 'FOLDER_0001')
    expect(routes.basicInfo).toBe('#/folders/FOLDER_0001/ab_tests/PAGE1/edit')
    expect(routes.heatmap).toBe('#/ab_tests/PAGE1/articles/htmls/heatmaps/comparisons')
    expect(routes.report).toBe('#/ab_tests/PAGE1/reports')
    expect(routes.editor).toBe('#/ab_tests/PAGE1/articles')
  })

  it('どの行き先も main.ts が受ける形になっている', () => {
    expect(main).toContain('/^\\/folders\\/([^/]+)\\/ab_tests\\/([^/]+)\\/edit$/')
    expect(main).toContain('/^\\/ab_tests\\/([^/]+)\\/articles\\/htmls\\/heatmaps\\/comparisons$/')
  })

  it('フォルダなしのページは unfiled を通して基本情報を開く', () => {
    expect(pageRowRoutes('PAGE1', null).basicInfo).toBe('#/folders/unfiled/ab_tests/PAGE1/edit')
  })

  it('一覧の行はこの行き先を使う（存在しない /basic_info へは飛ばさない）', () => {
    const list = readFileSync('src/app/pages/folders-page-list.ts', 'utf8')
    expect(list).not.toContain('/basic_info')
    expect(list).toContain('pageRowRoutes(')
  })
})
