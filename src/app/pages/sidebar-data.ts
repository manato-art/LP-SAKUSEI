/**
 * サイドバーのデータ画面（指示⑮・ユーザー承認の「モックで機能自作」）。
 *
 * 実本体の採取が許可経路外でできないため、これらはモックAPIのデータを土台に**機能する画面**を自作する
 * （実物とは見た目が多少ズレる旨をヘッダに明記）。対象:
 *   ダッシュボード / CV速報 / ドメイン / レポート除外 / ランキング / イベント・セミナー
 * どれもモックの実エンドポイント（/teams/dashboard, /conversions, /teams/domains,
 * /report-exclusions, /ab_tests/rankings）を叩いて描く。空ならそのまま空状態を出す。
 */
import { T, el, emptyState } from '../ui.ts'

const API = '/api/v1'

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

/** 画面の共通シェル：白カード＋タイトル＋「クローン自作」注記＋本文コンテナを返す */
function pageShell(container: HTMLElement, title: string, note: string): HTMLElement {
  container.style.cssText = `flex:1;min-width:0;background:${T.bg};min-height:100vh`
  container.innerHTML = ''
  const body = el('div', { style: `padding:24px 28px;font-family:${T.font}` })
  body.append(
    el('div', { text: title, style: `font-size:20px;font-weight:700;color:${T.text};margin-bottom:4px` }),
    el('div', {
      text: note,
      style: `font-size:12px;color:${T.sub};margin-bottom:20px;line-height:1.7`,
    }),
  )
  const content = el('div', {
    style: `background:${T.surface};border-radius:10px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,.06)`,
  })
  body.append(content)
  container.append(body)
  return content
}

interface Column<Row> {
  head: string
  cell: (row: Row) => string
  align?: 'left' | 'right'
}

function table<Row>(rows: readonly Row[], columns: readonly Column<Row>[], empty: string): HTMLElement {
  if (rows.length === 0) return emptyState(empty)
  const wrap = el('div', { style: 'overflow-x:auto' })
  const grid = `grid-template-columns:repeat(${columns.length}, minmax(90px,1fr))`
  const head = el('div', {
    style: `display:grid;${grid};gap:12px;padding:10px 8px;border-bottom:2px solid #EEE;font-size:12px;color:${T.sub}`,
  })
  for (const col of columns) {
    head.append(el('div', { text: col.head, style: `text-align:${col.align ?? 'left'}` }))
  }
  wrap.append(head)
  for (const row of rows) {
    const tr = el('div', {
      style: `display:grid;${grid};gap:12px;padding:12px 8px;border-bottom:1px solid #F2F2F2;font-size:13px;color:${T.text}`,
    })
    for (const col of columns) {
      tr.append(el('div', { text: col.cell(row), style: `text-align:${col.align ?? 'left'};word-break:break-all` }))
    }
    wrap.append(tr)
  }
  return wrap
}

function yen(n: number): string {
  return `¥${Math.round(n).toLocaleString('ja-JP')}`
}
function int(n: number): string {
  return Math.round(n).toLocaleString('ja-JP')
}
function ratio(n: number | null, unit = ''): string {
  return n === null ? '-' : `${Math.round(n * 100) / 100}${unit}`
}

/* ── KPI集計の型（mock の aggregate と同形・派生値は null 可） ── */
interface Kpi {
  pv: number
  click: number
  cv: number
  ad_cost: number
  sales: number
  gross_profit: number
  roas: number | null
  cvr: number | null
  cpa: number | null
}

/* ────────────── ダッシュボード ────────────── */
export async function renderDashboard(container: HTMLElement): Promise<void> {
  const content = pageShell(
    container,
    'ダッシュボード',
    '※クローンが自作した画面です（実物とは見た目が異なる場合があります）。数値はモックの集計です。',
  )
  const data = await getJson<{ kpi: Kpi; new_ab_tests: number; new_versions: unknown[] }>(
    '/teams/dashboard',
  )
  if (data === null) {
    content.append(emptyState('ダッシュボードのデータを取得できませんでした。'))
    return
  }
  const k = data.kpi
  const cards: [string, string][] = [
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
  const grid = el('div', {
    style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px',
  })
  for (const [label, value] of cards) {
    grid.append(
      el('div', { style: `border:1px solid #EEE;border-radius:8px;padding:14px 16px` }, [
        el('div', { text: label, style: `font-size:12px;color:${T.sub};margin-bottom:6px` }),
        el('div', { text: value, style: `font-size:22px;font-weight:700;color:${T.text}` }),
      ]),
    )
  }
  content.append(grid)
}

/* ────────────── CV速報 ────────────── */
interface ConversionRow {
  occurred_at?: string
  ab_test_title?: string
  amount?: number
  status?: string
}
export async function renderConversions(container: HTMLElement): Promise<void> {
  const content = pageShell(
    container,
    'CV速報',
    '※クローンが自作した画面です。モックのコンバージョン発生ログを表示します。',
  )
  const data = await getJson<{ conversions: ConversionRow[] }>('/conversions')
  const rows = data?.conversions ?? []
  content.append(
    table<ConversionRow>(
      rows,
      [
        { head: '発生日時', cell: (r) => r.occurred_at ?? '-' },
        { head: 'beyondページ', cell: (r) => r.ab_test_title ?? '-' },
        { head: '金額', cell: (r) => (r.amount === undefined ? '-' : yen(r.amount)), align: 'right' },
        { head: 'ステータス', cell: (r) => r.status ?? '-' },
      ],
      'まだコンバージョンがありません。配信が始まるとここに速報が並びます。',
    ),
  )
}

/* ────────────── ドメイン ────────────── */
interface DomainRow {
  host?: string
  status?: string
  created_at?: string
}
export async function renderDomains(container: HTMLElement): Promise<void> {
  const content = pageShell(
    container,
    'ドメイン',
    '※クローンが自作した画面です。モックの独自ドメイン一覧を表示します。',
  )
  const data = await getJson<{ domains: DomainRow[] }>('/teams/domains')
  const rows = data?.domains ?? []
  content.append(
    table<DomainRow>(
      rows,
      [
        { head: 'ドメイン', cell: (r) => r.host ?? '-' },
        { head: 'ステータス', cell: (r) => r.status ?? '-' },
        { head: '登録日', cell: (r) => r.created_at ?? '-' },
      ],
      '独自ドメインはまだ登録されていません。',
    ),
  )
}

/* ────────────── レポート除外 ────────────── */
interface ExclusionRow {
  keyword?: string
  type?: string
}
export async function renderReportExclusions(container: HTMLElement): Promise<void> {
  const content = pageShell(
    container,
    'レポート除外',
    '※クローンが自作した画面です。レポート集計から除外する条件の一覧です。',
  )
  const data = await getJson<{ report_exclusions: ExclusionRow[] }>('/report-exclusions')
  const rows = data?.report_exclusions ?? []
  content.append(
    table<ExclusionRow>(
      rows,
      [
        { head: '除外キーワード', cell: (r) => r.keyword ?? '-' },
        { head: '種別', cell: (r) => r.type ?? '-' },
      ],
      '除外条件はまだ登録されていません。',
    ),
  )
}

/* ────────────── ランキング ────────────── */
interface RankRow {
  title?: string
  sales?: number
  cv?: number
  roas?: number | null
}
export async function renderRankings(container: HTMLElement): Promise<void> {
  const content = pageShell(
    container,
    'ランキング',
    '※クローンが自作した画面です。モックのbeyondページを成果順に並べます。',
  )
  const data = await getJson<{ rows: RankRow[] }>('/ab_tests/rankings?sort=sales&sort_direction=desc')
  const rows = data?.rows ?? []
  content.append(
    table<RankRow>(
      rows,
      [
        { head: 'beyondページ', cell: (r) => r.title ?? '-' },
        { head: '売上', cell: (r) => (r.sales === undefined ? '-' : yen(r.sales)), align: 'right' },
        { head: 'CV', cell: (r) => (r.cv === undefined ? '-' : int(r.cv)), align: 'right' },
        { head: 'ROAS', cell: (r) => ratio(r.roas ?? null), align: 'right' },
      ],
      'ランキングを作れるページがまだありません。',
    ),
  )
}

/* ────────────── イベント・セミナー ────────────── */
export function renderSeminarPage(container: HTMLElement): void {
  const content = pageShell(
    container,
    'イベント・セミナー',
    '※クローンが自作した画面です。',
  )
  content.append(
    emptyState('現在開催予定のイベント・セミナーはありません。'),
  )
}
