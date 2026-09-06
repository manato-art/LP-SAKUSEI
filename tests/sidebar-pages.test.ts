/**
 * サイドバー3画面（拡張機能 / タスク / AI）の機械証明。
 *
 * 環境は node（jsdom 無し）なので、DOMを触る配線はテストせず（共通指示 §5）、
 *   1. 採取した実HTMLに、配線が前提にする文言・クラスが実在するか（採取物パース照合）
 *   2. ルート解決の純粋関数が採取物・シェルの配線と一致するか
 *   3. グローバルサイドバーを落とす純粋関数が本体を残すか
 * を検証する。採取物の値をテストへ転記しない（§1-2）ため、目印は構造語のみ。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { stripGlobalSidebar } from '../src/app/pages/sidebar-shell.ts'
import {
  ACCOUNT_SETTINGS_ROUTE,
  // 指示124: ADDON_ROUTE 削除
  CONVERSIONS_ROUTE,
  DASHBOARD_ROUTE,
  DOMAINS_ROUTE,
  EXTERNAL_ROUTE,
  RANKINGS_ROUTE,
  REPORT_EXCLUSIONS_ROUTE,
  SB_AI_ROUTE,
  SEMINAR_ROUTE,
  SIDEBAR_PAGE_ROUTES,
  TASKS_ROUTE,
  matchSidebarPage,
} from '../src/app/pages/sidebar-nav.ts'

const FRAGMENT_DIR = 'src/app/fragments'
function read(slug: string): string {
  return readFileSync(`${FRAGMENT_DIR}/${slug}.html`, 'utf8')
}

// 指示124: 拡張機能のテストは削除（データごと撤去）
const TASKS = 'tasks__default'
const SB_AI = 'sb_ai__default'

describe('採取物に、配線が前提にする文言・クラスが実在する（タスク）', () => {
  const html = read(TASKS)
  const marks = ['すべて 0', '定期タスク 0', 'スポットタスク 0', '新しいタスク'] as const
  it.each(marks)('「%s」が実在する（＝空状態）', (mark) => {
    expect(html).toContain(mark)
  })
  it('タブ土台（アクティブ/非アクティブのクラス）が実在する', () => {
    expect(html).toContain('css-1a9uxoy') // アクティブなタブ
    expect(html).toContain('css-djm0vw') // 非アクティブなタブ
  })
})

describe('採取物に、配線が前提にする文言・クラスが実在する（AI）', () => {
  const html = read(SB_AI)
  const marks = [
    'Squad beyond AI',
    'ホーム',
    'チャット履歴',
    '新しいチャット',
    'メッセージを入力...',
    '送信',
    '1番PVが多いページは？',
    'CPAを下げるには？',
  ] as const
  it.each(marks)('「%s」が実在する', (mark) => {
    expect(html).toContain(mark)
  })
  it('推奨プロンプトのボタン土台が実在する', () => {
    expect(html).toContain('css-8pm3ds')
  })
})

describe('グローバルサイドバーを落とす純粋関数', () => {
  // 指示124: 拡張機能のテストは削除
  it('タスク: 本体を残しつつグローバルサイドバーを落とす', () => {
    const body = stripGlobalSidebar(read(TASKS))
    expect(body).not.toContain('Squadbeyond Logo')
    expect(body).not.toContain('data-testid="list-menu-item"')
    expect(body).toContain('新しいタスク')
  })
  it('AI: グローバルサイドバーは落とすが、本体内のAIサブナビ（同じlist-menu-item）は残す', () => {
    const body = stripGlobalSidebar(read(SB_AI))
    // グローバルサイドバー固有のロゴ・グローバルナビ文言は消える
    expect(body).not.toContain('Squadbeyond Logo')
    expect(body).not.toContain('CV速報')
    // 本体（AIパネル）は残る。AIサブナビは同じ data-testid を使うので残ってよい
    expect(body).toContain('Squad beyond AI')
    expect(body).toContain('チャット履歴')
    expect(body).toContain('data-testid="list-menu-item"')
  })
  it('目印が無ければ入力をそのまま返す', () => {
    expect(stripGlobalSidebar('<div>本体だけ</div>')).toBe('<div>本体だけ</div>')
  })
})

describe('ルート解決の純粋関数', () => {
  it('各ルートを対応するページへ解決する', () => {
    // 指示124: ADDON_ROUTE 削除
    expect(matchSidebarPage(TASKS_ROUTE)).toBe('tasks')
    expect(matchSidebarPage(SB_AI_ROUTE)).toBe('sb_ai')
    expect(matchSidebarPage(EXTERNAL_ROUTE)).toBe('external')
    expect(matchSidebarPage(DASHBOARD_ROUTE)).toBe('dashboard')
    expect(matchSidebarPage(CONVERSIONS_ROUTE)).toBe('conversions')
    expect(matchSidebarPage(DOMAINS_ROUTE)).toBe('domains')
    expect(matchSidebarPage(REPORT_EXCLUSIONS_ROUTE)).toBe('report_exclusions')
    expect(matchSidebarPage(RANKINGS_ROUTE)).toBe('rankings')
    expect(matchSidebarPage(SEMINAR_ROUTE)).toBe('seminar')
    expect(matchSidebarPage(ACCOUNT_SETTINGS_ROUTE)).toBe('account_settings')
  })
  it('未知のパスは null（推測で埋めない）', () => {
    expect(matchSidebarPage('/addon')).toBeNull()
    expect(matchSidebarPage('')).toBeNull()
  })
  it('ルート定数の一覧がそろっている（サイドバーのデータ画面を含む）', () => {
    expect(SIDEBAR_PAGE_ROUTES).toEqual([
      // 指示124: ADDON_ROUTE 削除
      TASKS_ROUTE,
      SB_AI_ROUTE,
      EXTERNAL_ROUTE,
      DASHBOARD_ROUTE,
      CONVERSIONS_ROUTE,
      DOMAINS_ROUTE,
      REPORT_EXCLUSIONS_ROUTE,
      RANKINGS_ROUTE,
      SEMINAR_ROUTE,
      ACCOUNT_SETTINGS_ROUTE,
    ])
  })
})

describe('シェルのサイドバー配線（NAV_TARGETS）が、登録するルートと一致する', () => {
  const shellSrc = readFileSync('src/app/shell.ts', 'utf8')
  it.each([
    // 指示68: AI はサイドバーから除去済み（NAV_TARGETSに無い）→ テストからも除去
    ['タスク', TASKS_ROUTE],
    // 指示124: 拡張機能は撤去
  ])('「%s」の遷移先が #%s', (label, route) => {
    // NAV_TARGETS の行（label と href が同じ行に並ぶ）を形で照合する
    const pattern = new RegExp(`label: '${label}',\\s*href: '#${route}'`)
    expect(shellSrc).toMatch(pattern)
  })
})
