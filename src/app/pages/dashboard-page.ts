/**
 * ダッシュボード（指示⑮の「モックで機能自作」区分）。
 *
 * 見せ方は2つ。上のタブで切り替える。
 *   全体     … チーム全部を足した数字と、PVの推移
 *   各ページ … 同じ期間を beyondページ ごとに割った内訳（PVの多い順）
 *
 * 「各ページ」は全体と**同じ数値の分解**なので、足すと必ず全体に一致する
 * （サーバー側 `/teams/dashboard` の `by_ab_test` が全体KPIと同じ行から作られている。
 *  `tests/dashboard-by-page.test.ts` がその一致を固定している）。
 * ズレると「どちらの数字を信じればいいのか」が分からない画面になるので、
 * 内訳をクライアント側で作り直さないこと。
 */
import { T, el, emptyState } from '../ui.ts'
import { jstDateKey, jstParts } from '../jst.ts'
import {
  getJson,
  int,
  pageShell,
  ratio,
  smallBtn,
  table,
  yen,
  type Column,
  type Kpi,
} from './data-ui.ts'

interface DashboardSeries {
  date: string
  pv: number
  click: number
  cv: number
}

/** 「各ページ」1行ぶん。サーバーの `by_ab_test` と同じ形。 */
interface PageBreakdown extends Kpi {
  uid: string
  title: string
  folder_name: string | null
}

interface DashboardData {
  kpi: Kpi
  by_ab_test: PageBreakdown[]
  series: DashboardSeries[]
}

type DashboardTab = '全体' | '各ページ'

const TABS: readonly DashboardTab[] = ['全体', '各ページ']

/**
 * ダッシュボードの期間。日付は**日本時間**で決める。
 *
 * `days` は 0=今日 / 1=昨日 / N=過去N日 / -1=今月。
 * ブラウザのローカル時刻で組み立てると、日本の朝や月初に1日（1ヶ月）ずれる。
 */
export function dashboardRange(days: number, now: Date = new Date()): {
  startDate: string
  endDate: string
} {
  const endDate = jstDateKey(now)
  if (days === 0) return { startDate: endDate, endDate }
  if (days === -1) {
    const t = jstParts(now)
    return { startDate: `${t.year}-${String(t.month).padStart(2, '0')}-01`, endDate }
  }
  if (days === 1) {
    const yesterday = jstDateKey(new Date(now.getTime() - 86400000))
    return { startDate: yesterday, endDate: yesterday }
  }
  return { startDate: jstDateKey(new Date(now.getTime() - days * 86400000)), endDate }
}

/** 選ばれているボタンだけ色を付ける（期間ピッカーとタブで共通） */
function paintActive(bar: HTMLElement, activeLabel: string): void {
  for (const b of bar.querySelectorAll('button')) {
    const isActive = b.textContent === activeLabel
    ;(b as HTMLElement).style.background = isActive ? 'var(--sb-accent, #0091FF)' : T.neutral
    ;(b as HTMLElement).style.color = isActive ? '#FFF' : T.text
  }
}

export async function renderDashboard(container: HTMLElement): Promise<void> {
  const content = pageShell(
    container,
    'ダッシュボード',
    '※クローンが自作した画面です（実物とは見た目が異なる場合があります）。数値はモックの集計です。',
  )

  const periods: { label: string; days: number }[] = [
    { label: '今日', days: 0 },
    { label: '昨日', days: 1 },
    { label: '過去7日', days: 7 },
    { label: '過去30日', days: 30 },
    { label: '今月', days: -1 },
  ]
  let activePeriod = '過去7日'
  let activeTab: DashboardTab = '全体'
  let latest: DashboardData | null = null

  // 期間ピッカー
  const periodBar = el('div', { style: 'display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap' })
  for (const p of periods) {
    const btn = smallBtn(p.label, T.neutral, T.text)
    btn.addEventListener('click', () => {
      activePeriod = p.label
      paintActive(periodBar, activePeriod)
      void loadDashboard(p.days)
    })
    periodBar.append(btn)
  }
  paintActive(periodBar, activePeriod)
  content.append(periodBar)

  // 全体 / 各ページ の切り替え。取り直さずに同じデータを見せ方だけ変える。
  const tabBar = el('div', { style: 'display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap' })
  for (const tab of TABS) {
    const btn = smallBtn(tab, T.neutral, T.text)
    btn.addEventListener('click', () => {
      activeTab = tab
      paintActive(tabBar, activeTab)
      renderDashboardBody(content, latest, activeTab)
    })
    tabBar.append(btn)
  }
  paintActive(tabBar, activeTab)
  content.append(tabBar)

  async function loadDashboard(days: number): Promise<void> {
    const { startDate, endDate } = dashboardRange(days)
    latest = await getJson<DashboardData>(
      `/teams/dashboard?start_date=${startDate}&end_date=${endDate}`,
    )
    renderDashboardBody(content, latest, activeTab)
  }

  await loadDashboard(7)
}

function renderDashboardBody(
  content: HTMLElement,
  data: DashboardData | null,
  tab: DashboardTab,
): void {
  // 既存の本文だけを除去（期間ピッカーとタブは残す）
  for (const node of content.querySelectorAll('.sb-dash-body')) node.remove()

  const wrap = el('div', { style: '' })
  wrap.className = 'sb-dash-body'

  if (data === null) {
    wrap.append(emptyState('ダッシュボードのデータを取得できませんでした。'))
    content.append(wrap)
    return
  }

  if (tab === '各ページ') renderByPage(wrap, data)
  else renderTotals(wrap, data)

  content.append(wrap)
}

/* ── 全体 ── */

/** 実物のKPI9項目。並びは変えない（各ページの表の列とも揃える）。 */
function kpiCells(k: Kpi): [string, string][] {
  return [
    ['配信金額', yen(k.ad_cost)],
    ['PV', int(k.pv)],
    ['クリック', int(k.click)],
    ['CV', int(k.cv)],
    ['売上', yen(k.sales)],
    ['粗利', yen(k.gross_profit)],
    ['ROAS', ratio(k.roas)],
    ['CVR', ratio(k.cvr, '%')],
    ['CPA', k.cpa === null ? '-' : yen(k.cpa)],
  ]
}

function renderTotals(wrap: HTMLElement, data: DashboardData): void {
  const grid = el('div', {
    // 金額は桁が伸びるので、幅を広めに取って**数字の途中で折り返させない**
    style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px;margin-bottom:20px',
  })
  for (const [label, value] of kpiCells(data.kpi)) {
    grid.append(
      el('div', { style: 'border:1px solid var(--sb-c-eeeeee, #EEEEEE);border-radius:8px;padding:14px 16px' }, [
        el('div', { text: label, style: `font-size:12px;color:${T.sub};margin-bottom:6px` }),
        el('div', {
          text: value,
          style: `font-size:22px;font-weight:700;color:${T.text};white-space:nowrap;overflow-x:auto`,
        }),
      ]),
    )
  }
  wrap.append(grid)

  // 簡易棒グラフ（PV推移）
  if (data.series.length === 0) return
  wrap.append(
    el('div', { text: 'PV推移', style: `font-size:14px;font-weight:600;color:${T.text};margin-bottom:8px` }),
  )
  const maxPv = Math.max(1, ...data.series.map((s) => s.pv))
  const chartWrap = el('div', { style: 'display:flex;align-items:flex-end;gap:2px;height:120px;overflow-x:auto' })
  for (const s of data.series) {
    const pct = Math.max(2, (s.pv / maxPv) * 100)
    const bar = el('div', {
      style: `flex:1;min-width:6px;max-width:24px;background:var(--sb-accent, #0091FF);border-radius:2px 2px 0 0;height:${pct}%`,
    })
    bar.title = `${s.date}: ${int(s.pv)} PV`
    chartWrap.append(bar)
  }
  wrap.append(chartWrap)

  // 日付ラベル（先頭と末尾のみ）
  if (data.series.length < 2) return
  const labelRow = el('div', {
    style: `display:flex;justify-content:space-between;font-size:11px;color:${T.sub};margin-top:4px`,
  })
  labelRow.append(
    el('span', { text: data.series[0]?.date.slice(5) ?? '' }),
    el('span', { text: data.series[data.series.length - 1]?.date.slice(5) ?? '' }),
  )
  wrap.append(labelRow)
}

/* ── 各ページ ── */

/** 表の列。数値の並びは「全体」のKPIカードと同じ順にしてある。 */
const PAGE_COLUMNS: readonly Column<PageBreakdown>[] = [
  {
    head: 'beyondページ',
    cell: (r) => r.title,
    href: (r) => `#/ab_tests/${r.uid}/reports`,
    width: 'minmax(180px,1.8fr)',
  },
  { head: 'フォルダ', cell: (r) => r.folder_name ?? '-', width: 'minmax(130px,1.3fr)' },
  { head: '配信金額', cell: (r) => yen(r.ad_cost), align: 'right' },
  { head: 'PV', cell: (r) => int(r.pv), align: 'right' },
  { head: 'クリック', cell: (r) => int(r.click), align: 'right' },
  { head: 'CV', cell: (r) => int(r.cv), align: 'right' },
  { head: '売上', cell: (r) => yen(r.sales), align: 'right' },
  { head: '粗利', cell: (r) => yen(r.gross_profit), align: 'right' },
  { head: 'ROAS', cell: (r) => ratio(r.roas), align: 'right' },
  { head: 'CVR', cell: (r) => ratio(r.cvr, '%'), align: 'right' },
  { head: 'CPA', cell: (r) => (r.cpa === null ? '-' : yen(r.cpa)), align: 'right' },
]

function renderByPage(wrap: HTMLElement, data: DashboardData): void {
  const rows = data.by_ab_test
  wrap.append(
    el('div', {
      text:
        rows.length === 0
          ? 'この期間に数値のあったページはまだありません。'
          : `この期間に数値のあったページ ${int(rows.length)}件（PVの多い順・合計は「全体」と一致します）`,
      style: `font-size:12px;color:${T.sub};margin-bottom:12px;line-height:1.7`,
    }),
  )
  wrap.append(
    table<PageBreakdown>(
      rows,
      PAGE_COLUMNS,
      '数値が記録されると、ページごとの内訳がここに並びます。',
    ),
  )
}
