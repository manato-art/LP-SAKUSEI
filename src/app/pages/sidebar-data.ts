/**
 * サイドバーのデータ画面（指示⑮・ユーザー承認の「モックで機能自作」）。
 *
 * 実本体の採取が許可経路外でできないため、これらはモックAPIのデータを土台に**機能する画面**を自作する
 * （実物とは見た目が多少ズレる旨をヘッダに明記）。対象:
 *   ダッシュボード / CV速報 / ドメイン / レポート除外 / ランキング / イベント・セミナー
 * どれもモックの実エンドポイント（/teams/dashboard, /conversions, /teams/domains,
 * /report-exclusions, /ab_tests/rankings）を叩いて描く。空ならそのまま空状態を出す。
 */
import { T, el, emptyState, toast } from '../ui.ts'

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

async function postJson<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

async function deleteJson(path: string): Promise<boolean> {
  try {
    const res = await fetch(`${API}${path}`, { method: 'DELETE' })
    return res.ok || res.status === 204
  } catch {
    return false
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

/** テキスト入力を作る共通ヘルパー */
function textInput(placeholder: string, style?: string): HTMLInputElement {
  const input = document.createElement('input')
  input.type = 'text'
  input.placeholder = placeholder
  input.style.cssText = style ?? `padding:8px 12px;border:1px solid #DDD;border-radius:6px;font-size:13px;font-family:${T.font};outline:none;flex:1;min-width:0`
  input.addEventListener('focus', () => { input.style.borderColor = '#0091FF' })
  input.addEventListener('blur', () => { input.style.borderColor = '#DDD' })
  return input
}

/** 小さいボタン */
function smallBtn(label: string, bg = '#0091FF', color = '#FFF'): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.textContent = label
  btn.style.cssText = `padding:8px 16px;border:none;border-radius:6px;background:${bg};color:${color};cursor:pointer;font-size:13px;font-family:${T.font};white-space:nowrap`
  return btn
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
interface DashboardSeries {
  date: string
  pv: number
  click: number
  cv: number
}

export async function renderDashboard(container: HTMLElement): Promise<void> {
  const content = pageShell(
    container,
    'ダッシュボード',
    '※クローンが自作した画面です（実物とは見た目が異なる場合があります）。数値はモックの集計です。',
  )

  // 期間ピッカー
  const periodBar = el('div', { style: 'display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap' })
  const periods: { label: string; days: number }[] = [
    { label: '今日', days: 0 },
    { label: '昨日', days: 1 },
    { label: '過去7日', days: 7 },
    { label: '過去30日', days: 30 },
    { label: '今月', days: -1 },
  ]
  let activePeriod = '過去7日'

  async function loadDashboard(days: number): Promise<void> {
    const now = new Date()
    let start: Date
    let end: Date = now
    if (days === 0) {
      start = now
    } else if (days === -1) {
      start = new Date(now.getFullYear(), now.getMonth(), 1)
    } else if (days === 1) {
      start = new Date(now.getTime() - 86400000)
      end = start
    } else {
      start = new Date(now.getTime() - days * 86400000)
    }
    const fmt = (d: Date): string => d.toISOString().slice(0, 10)
    const qs = `start_date=${fmt(start)}&end_date=${fmt(end)}`
    const data = await getJson<{ kpi: Kpi; series: DashboardSeries[]; new_ab_tests: unknown[] }>(
      `/teams/dashboard?${qs}`,
    )
    renderDashboardBody(content, data)
  }

  for (const p of periods) {
    const btn = smallBtn(p.label, p.label === activePeriod ? '#0091FF' : '#F5F5F5', p.label === activePeriod ? '#FFF' : T.text)
    btn.addEventListener('click', () => {
      activePeriod = p.label
      for (const b of periodBar.querySelectorAll('button')) {
        const isActive = b.textContent === activePeriod
        ;(b as HTMLElement).style.background = isActive ? '#0091FF' : '#F5F5F5'
        ;(b as HTMLElement).style.color = isActive ? '#FFF' : T.text
      }
      void loadDashboard(p.days)
    })
    periodBar.append(btn)
  }
  content.append(periodBar)

  void loadDashboard(7)
}

function renderDashboardBody(
  content: HTMLElement,
  data: { kpi: Kpi; series: DashboardSeries[]; new_ab_tests: unknown[] } | null,
): void {
  // 既存の KPI + チャートを除去（期間ピッカーは残す）
  const old = content.querySelectorAll('.sb-dash-body')
  for (const node of old) node.remove()

  const wrap = el('div', { style: '' })
  wrap.className = 'sb-dash-body'

  if (data === null) {
    wrap.append(emptyState('ダッシュボードのデータを取得できませんでした。'))
    content.append(wrap)
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
    style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:20px',
  })
  for (const [label, value] of cards) {
    grid.append(
      el('div', { style: 'border:1px solid #EEE;border-radius:8px;padding:14px 16px' }, [
        el('div', { text: label, style: `font-size:12px;color:${T.sub};margin-bottom:6px` }),
        el('div', { text: value, style: `font-size:22px;font-weight:700;color:${T.text}` }),
      ]),
    )
  }
  wrap.append(grid)

  // 簡易棒グラフ（PV推移）
  if (data.series.length > 0) {
    wrap.append(
      el('div', { text: 'PV推移', style: `font-size:14px;font-weight:600;color:${T.text};margin-bottom:8px` }),
    )
    const maxPv = Math.max(1, ...data.series.map((s) => s.pv))
    const chartWrap = el('div', { style: 'display:flex;align-items:flex-end;gap:2px;height:120px;overflow-x:auto' })
    for (const s of data.series) {
      const pct = Math.max(2, (s.pv / maxPv) * 100)
      const bar = el('div', {
        style: `flex:1;min-width:6px;max-width:24px;background:#0091FF;border-radius:2px 2px 0 0;height:${pct}%`,
      })
      bar.title = `${s.date}: ${int(s.pv)} PV`
      chartWrap.append(bar)
    }
    wrap.append(chartWrap)

    // 日付ラベル（先頭と末尾のみ）
    if (data.series.length >= 2) {
      const labelRow = el('div', {
        style: `display:flex;justify-content:space-between;font-size:11px;color:${T.sub};margin-top:4px`,
      })
      labelRow.append(
        el('span', { text: data.series[0]?.date.slice(5) ?? '' }),
        el('span', { text: data.series[data.series.length - 1]?.date.slice(5) ?? '' }),
      )
      wrap.append(labelRow)
    }
  }

  content.append(wrap)
}

/* ────────────── CV速報 ────────────── */
interface ConversionRow {
  occurred_at?: string
  ab_test_title?: string
  version_name?: string
  amount?: number
  status?: string
  media?: { name: string } | null
}
export async function renderConversions(container: HTMLElement): Promise<void> {
  const content = pageShell(
    container,
    'CV速報',
    '※クローンが自作した画面です。モックのコンバージョン発生ログを表示します。30分ごとに更新されます。',
  )
  const data = await getJson<{ conversions: ConversionRow[] }>('/conversions')
  const rows = data?.conversions ?? []
  content.append(
    table<ConversionRow>(
      rows,
      [
        { head: '発生日時', cell: (r) => r.occurred_at ?? '-' },
        { head: 'beyondページ', cell: (r) => r.ab_test_title ?? '-' },
        { head: 'Version', cell: (r) => r.version_name ?? '-' },
        { head: '媒体', cell: (r) => r.media?.name ?? '-' },
        { head: '金額', cell: (r) => (r.amount === undefined ? '-' : yen(r.amount)), align: 'right' },
        { head: 'ステータス', cell: (r) => r.status ?? '-' },
      ],
      'まだコンバージョンがありません。配信が始まるとここに速報が並びます。',
    ),
  )
}

/* ────────────── ドメイン ────────────── */
interface DomainRow {
  uid?: string
  host?: string
  status?: string
  ssl?: boolean
}
export async function renderDomains(container: HTMLElement): Promise<void> {
  const content = pageShell(
    container,
    'ドメイン',
    '※クローンが自作した画面です。独自ドメイン・フリードメインの一覧を表示します。',
  )

  // ドメイン追加フォーム
  const addBar = el('div', { style: 'display:flex;gap:8px;margin-bottom:16px;align-items:center' })
  const hostInput = textInput('example.com')
  const addBtn = smallBtn('ドメインを追加')
  addBtn.addEventListener('click', () => {
    const host = hostInput.value.trim()
    if (host === '') {
      toast('ドメイン名を入力してください', 'error')
      return
    }
    addBtn.textContent = '追加中...'
    void postJson('/teams/domains', { host }).then((result) => {
      addBtn.textContent = 'ドメインを追加'
      if (result !== null) {
        toast('ドメインを追加しました')
        hostInput.value = ''
        void renderDomains(container) // 再描画
      } else {
        toast('ドメインの追加に失敗しました', 'error')
      }
    })
  })
  addBar.append(hostInput, addBtn)
  content.append(addBar)

  const data = await getJson<{ domains: DomainRow[] }>('/teams/domains')
  const rows = data?.domains ?? []

  if (rows.length === 0) {
    content.append(emptyState('独自ドメインはまだ登録されていません。'))
    return
  }

  const domainList = el('div', { style: '' })
  const grid = `grid-template-columns:1fr 100px 60px 60px`
  const head = el('div', {
    style: `display:grid;${grid};gap:12px;padding:10px 8px;border-bottom:2px solid #EEE;font-size:12px;color:${T.sub}`,
  })
  head.append(
    el('div', { text: 'ドメイン' }),
    el('div', { text: 'ステータス' }),
    el('div', { text: 'SSL' }),
    el('div', { text: '' }),
  )
  domainList.append(head)

  for (const row of rows) {
    const tr = el('div', {
      style: `display:grid;${grid};gap:12px;padding:12px 8px;border-bottom:1px solid #F2F2F2;font-size:13px;color:${T.text};align-items:center`,
    })
    const statusLabel = row.status === 'active' ? 'アクティブ' : row.status === 'pending' ? '確認中' : (row.status ?? '-')
    const sslLabel = row.ssl === true ? 'ON' : 'OFF'
    tr.append(
      el('div', { text: row.host ?? '-', style: 'word-break:break-all' }),
      el('div', { text: statusLabel, style: `color:${row.status === 'active' ? '#38A169' : '#DD6B20'}` }),
      el('div', { text: sslLabel }),
    )
    // 削除ボタンは実装しない（実物もOwnerのみ・配信停止後のみ）
    tr.append(el('div', { text: '' }))
    domainList.append(tr)
  }
  content.append(domainList)
}

/* ────────────── レポート除外 ────────────── */
interface ExclusionRow {
  uid?: string
  target?: string
  reason?: string
}
export async function renderReportExclusions(container: HTMLElement): Promise<void> {
  const content = pageShell(
    container,
    'レポート除外',
    '※クローンが自作した画面です。社内アクセスやクローラーをレポート集計から除外します。',
  )

  // 追加フォーム
  const addBar = el('div', { style: 'display:flex;gap:8px;margin-bottom:16px;align-items:center' })
  const targetInput = textInput('除外するIPアドレスやキーワード')
  const addBtn = smallBtn('追加')
  addBtn.addEventListener('click', () => {
    const target = targetInput.value.trim()
    if (target === '') {
      toast('除外対象を入力してください', 'error')
      return
    }
    void postJson('/report-exclusions', { target }).then((result) => {
      if (result !== null) {
        toast('除外条件を追加しました')
        targetInput.value = ''
        void renderReportExclusions(container)
      } else {
        toast('追加に失敗しました', 'error')
      }
    })
  })
  addBar.append(targetInput, addBtn)
  content.append(addBar)

  const data = await getJson<{ report_exclusions: ExclusionRow[] }>('/report-exclusions')
  const rows = data?.report_exclusions ?? []

  if (rows.length === 0) {
    content.append(emptyState('除外条件はまだ登録されていません。'))
    return
  }

  const grid = `grid-template-columns:1fr 80px`
  const head = el('div', {
    style: `display:grid;${grid};gap:12px;padding:10px 8px;border-bottom:2px solid #EEE;font-size:12px;color:${T.sub}`,
  })
  head.append(el('div', { text: '除外対象' }), el('div', { text: '' }))
  content.append(head)

  for (const row of rows) {
    const tr = el('div', {
      style: `display:grid;${grid};gap:12px;padding:12px 8px;border-bottom:1px solid #F2F2F2;font-size:13px;color:${T.text};align-items:center`,
    })
    tr.append(el('div', { text: row.target ?? '-', style: 'word-break:break-all' }))
    const delBtn = smallBtn('削除', '#FFF5F5', '#E53E3E')
    delBtn.style.cssText += ';border:1px solid #FEB2B2;padding:4px 10px;font-size:12px'
    delBtn.addEventListener('click', () => {
      if (row.uid === undefined) return
      void deleteJson(`/report-exclusions/${row.uid}`).then((ok) => {
        if (ok) {
          toast('除外条件を削除しました')
          void renderReportExclusions(container)
        } else {
          toast('削除に失敗しました', 'error')
        }
      })
    })
    tr.append(delBtn)
    content.append(tr)
  }
}

/* ────────────── ランキング ────────────── */
interface RankRow {
  title?: string
  uid?: string
  sales?: number
  cv?: number
  pv?: number
  ad_cost?: number
  roas?: number | null
}
export async function renderRankings(container: HTMLElement): Promise<void> {
  const content = pageShell(
    container,
    'ランキング',
    '※クローンが自作した画面です。モックのbeyondページを成果順に並べます。',
  )

  // ソート切替
  const sortBar = el('div', { style: 'display:flex;gap:8px;margin-bottom:16px;align-items:center;flex-wrap:wrap' })
  sortBar.append(el('span', { text: '並び順:', style: `font-size:12px;color:${T.sub}` }))
  const sortOptions: { label: string; value: string }[] = [
    { label: '売上', value: 'sales' },
    { label: 'CV', value: 'cv' },
    { label: 'PV', value: 'pv' },
    { label: '配信金額', value: 'ad_cost' },
    { label: 'ROAS', value: 'roas' },
  ]
  let activeSort = 'sales'

  async function loadRankings(): Promise<void> {
    const data = await getJson<{ ab_tests: RankRow[] }>(
      `/ab_tests/rankings?sort=${activeSort}&sort_direction=desc`,
    )
    const rows = data?.ab_tests ?? []
    // 既存の表を除去
    const old = content.querySelectorAll('.sb-rank-table')
    for (const node of old) node.remove()
    const wrapper = el('div', { style: '' })
    wrapper.className = 'sb-rank-table'
    wrapper.append(
      table<RankRow>(
        rows,
        [
          { head: 'beyondページ', cell: (r) => r.title ?? '-' },
          { head: '売上', cell: (r) => (r.sales === undefined ? '-' : yen(r.sales)), align: 'right' },
          { head: 'CV', cell: (r) => (r.cv === undefined ? '-' : int(r.cv)), align: 'right' },
          { head: 'PV', cell: (r) => (r.pv === undefined ? '-' : int(r.pv)), align: 'right' },
          { head: '配信金額', cell: (r) => (r.ad_cost === undefined ? '-' : yen(r.ad_cost)), align: 'right' },
          { head: 'ROAS', cell: (r) => ratio(r.roas ?? null), align: 'right' },
        ],
        'ランキングを作れるページがまだありません。',
      ),
    )
    content.append(wrapper)
  }

  for (const opt of sortOptions) {
    const btn = smallBtn(opt.label, opt.value === activeSort ? '#0091FF' : '#F5F5F5', opt.value === activeSort ? '#FFF' : T.text)
    btn.addEventListener('click', () => {
      activeSort = opt.value
      for (const b of sortBar.querySelectorAll('button')) {
        const isActive = b.textContent === sortOptions.find((o) => o.value === activeSort)?.label
        ;(b as HTMLElement).style.background = isActive ? '#0091FF' : '#F5F5F5'
        ;(b as HTMLElement).style.color = isActive ? '#FFF' : T.text
      }
      void loadRankings()
    })
    sortBar.append(btn)
  }
  content.append(sortBar)

  void loadRankings()
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
