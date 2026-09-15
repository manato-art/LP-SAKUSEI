/**
 * サイドバーのデータ画面（指示⑮・ユーザー承認の「モックで機能自作」）。
 *
 * 実本体の採取が許可経路外でできないため、これらはモックAPIのデータを土台に**機能する画面**を自作する
 * （実物とは見た目が多少ズレる旨をヘッダに明記）。対象:
 *   CV速報 / ドメイン / レポート除外 / ランキング / イベント・セミナー
 * どれもモックの実エンドポイント（/conversions, /teams/domains, /report-exclusions,
 * /ab_tests/rankings）を叩いて描く。空ならそのまま空状態を出す。
 *
 * ダッシュボードだけは「全体 / 各ページ」の切り替えを持って厚くなったので別ファイル
 * （`dashboard-page.ts`）。共通の部品は `data-ui.ts`。
 */
import { T, el, emptyState, toast } from '../ui.ts'
import { api } from '../api.ts'
import {
  QUICK_DOMAIN_EXISTING_DOMAIN_WARNING,
  QUICK_DOMAIN_NEED_DOMAIN_NOTE,
  quickDomainSteps,
} from '../quick-domain-note.ts'
import { jstParts } from '../jst.ts'
import {
  DATA_HEAD_CLASS,
  DATA_ROW_CLASS,
  DATA_TABLE_CLASS,
  getJson,
  int,
  pageShell,
  postJson,
  ratio,
  smallBtn,
  table,
  textInput,
  yen,
} from './data-ui.ts'

/* ────────────── CV速報 ────────────── */
interface ConversionRow {
  uid?: string
  /** サーバーはUNIX秒（数値）で返す。古い保存データに文字列が混ざっても出せるようにしてある */
  occurred_at?: number | string
  folder_name?: string | null
  ab_test_title?: string | null
  version_memo?: string | null
  access_at?: string | null
  cv_source?: string | null
  media?: { name: string } | null
}

/** 発生時刻（UNIX秒）を実物の並びに近い表記へ。文字列で来たらそのまま出す。 */
export function cvTime(value: unknown): string {
  if (typeof value === 'string' && value !== '') return value
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  const t = jstParts(new Date(value * 1000))
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${t.year}/${p(t.month)}/${p(t.day)} ${p(t.hour)}:${p(t.minute)}:${p(t.second)}`
}

/** 実物の「最終更新 2026年9月8日 12:50」と同じ書き方 */
export function lastUpdatedLabel(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '最終更新 -'
  const t = jstParts(new Date(value * 1000))
  const p = (n: number): string => String(n).padStart(2, '0')
  return `最終更新 ${t.year}年${t.month}月${t.day}日 ${p(t.hour)}:${p(t.minute)}`
}

/** CV速報のCSV（実物の「CSVダウンロード」）。列は画面と同じ8列 */
export function conversionsCsv(rows: readonly ConversionRow[]): string {
  const head = [
    'フォルダ', 'beyondページ', 'Versionメモ', 'メディア',
    'アクセス日時', 'CV日時', 'CVソース', '成果識別ID',
  ]
  const cell = (v: string): string => `"${v.replace(/"/g, '""')}"`
  const lines = rows.map((r) =>
    [
      r.folder_name ?? '-',
      r.ab_test_title ?? '-',
      r.version_memo ?? '-',
      r.media?.name ?? '-',
      r.access_at ?? '-',
      cvTime(r.occurred_at),
      r.cv_source ?? '-',
      r.uid ?? '-',
    ]
      .map(cell)
      .join(','),
  )
  // Excelで文字化けさせないようBOMを付ける（レポートのCSVと同じ）
  return `\ufeff${[head.map(cell).join(','), ...lines].join('\r\n')}\r\n`
}

/**
 * CV速報。列構成・「CSVダウンロード」・件数表示は**実物の採取**に合わせている
 * （実パスは /conversion-reports、8列、0件でもヘッダーを出したまま「1 ~ 0件を表示中」）。
 * 2026-09-15: 実物にある 期間 / 検索 / 最終更新 / 見出し「コンバージョン」/ 通知設定 を足した。
 * このクローンが持てない項目（アクセス日時）は埋めずに「-」にする。
 */
export async function renderConversions(container: HTMLElement): Promise<void> {
  const content = pageShell(
    container,
    'CV速報',
    '※列構成は実物に合わせています。CV計測タグから記録された実際のコンバージョンを新しい順に表示します。',
  )

  /* ── 絞り込み（実物: 期間ピッカー＋「速報を検索」）── */
  const today = jstParts(new Date())
  const pad = (n: number): string => String(n).padStart(2, '0')
  const todayKey = `${today.year}-${pad(today.month)}-${pad(today.day)}`
  /** 既定は期間を掛けない（実物は当日だが、入れたばかりのCVが消えて見えるため全件から始める） */
  const range = { start: '', end: '' }
  let keyword = ''

  const filters = el('div', {
    style: 'display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:14px',
  })
  const dateInput = (value: string, onChange: (v: string) => void): HTMLInputElement => {
    const input = document.createElement('input')
    input.type = 'date'
    input.value = value
    input.max = todayKey
    input.style.cssText = `padding:7px 10px;border:1px solid var(--sb-c-dddddd, #DDDDDD);border-radius:6px;font-size:13px;font-family:${T.font}`
    input.addEventListener('change', () => {
      onChange(input.value)
      void reload()
    })
    return input
  }
  const start = dateInput(range.start, (v) => {
    range.start = v
  })
  const end = dateInput(range.end, (v) => {
    range.end = v
  })
  const search = textInput('速報を検索', `padding:7px 10px;border:1px solid var(--sb-c-dddddd, #DDDDDD);border-radius:6px;font-size:13px;font-family:${T.font};min-width:200px`)
  search.addEventListener('input', () => {
    keyword = search.value.trim()
    void reload()
  })
  const updated = el('span', { text: '最終更新 -', style: `font-size:12px;color:${T.sub};margin-left:auto` })
  filters.append(
    el('span', { text: '期間', style: `font-size:12px;color:${T.sub}` }),
    start,
    el('span', { text: 'から', style: `font-size:12px;color:${T.sub}` }),
    end,
    el('span', { text: 'まで', style: `font-size:12px;color:${T.sub}` }),
    search,
    updated,
  )
  content.append(filters)

  /* ── 見出し（実物: 「コンバージョン」＋通知設定＋CSVダウンロード）── */
  const bar = el('div', {
    style: 'display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap',
  })
  bar.append(
    el('span', { text: 'コンバージョン', style: `font-size:14px;font-weight:700;color:${T.text}` }),
  )
  const notify = smallBtn('通知設定', T.surface, T.text)
  notify.style.border = `1px solid var(--sb-c-dddddd, #DDDDDD)`
  notify.addEventListener('click', () => {
    // 通知の設定はアカウント設定の中にある（実物も別画面へ飛ぶ）
    location.hash = '#/settings/internal_notifications/member'
  })
  const csv = smallBtn('CSVダウンロード')
  const spacer = el('span', { style: 'margin-left:auto' })
  bar.append(spacer, notify, csv)
  content.append(bar)

  const tableHost = el('div', {})
  const countLabel = el('div', {
    text: '1 ~ 0件を表示中',
    style: `margin-top:12px;font-size:12px;color:${T.sub}`,
  })
  content.append(tableHost, countLabel)

  let shown: ConversionRow[] = []

  csv.addEventListener('click', () => {
    if (shown.length === 0) {
      toast('書き出すコンバージョンがありません', 'error')
      return
    }
    const blob = new Blob([conversionsCsv(shown)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `conversions_${todayKey}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  })

  async function reload(): Promise<void> {
    const params = new URLSearchParams()
    // 期間は両端そろったときだけ掛ける（片方だけでは意味が決まらない）
    if (range.start !== '' && range.end !== '') {
      params.set('start_date', range.start)
      params.set('end_date', range.end)
    }
    if (keyword !== '') params.set('q', keyword)
    const query = params.toString()
    const data = await getJson<{ conversions: ConversionRow[]; last_updated_at?: number | null }>(
      query === '' ? '/conversions' : `/conversions?${query}`,
    )
    shown = data?.conversions ?? []
    updated.textContent = lastUpdatedLabel(data?.last_updated_at)
    tableHost.replaceChildren(
      table<ConversionRow>(
        shown,
        [
          { head: 'フォルダ', cell: (r) => r.folder_name ?? '-' },
          { head: 'beyondページ', cell: (r) => r.ab_test_title ?? '-' },
          { head: 'Versionメモ', cell: (r) => r.version_memo ?? '-' },
          { head: 'メディア', cell: (r) => r.media?.name ?? '-' },
          { head: 'アクセス日時', cell: (r) => r.access_at ?? '-' },
          { head: 'CV日時', cell: (r) => cvTime(r.occurred_at) },
          { head: 'CVソース', cell: (r) => r.cv_source ?? '-' },
          { head: '成果識別ID', cell: (r) => r.uid ?? '-' },
        ],
        '',
        { keepHeaderWhenEmpty: true },
      ),
    )
    // 実物は表の下に件数を出す（0件でも「1 ~ 0件を表示中」）
    countLabel.textContent = `1 ~ ${shown.length}件を表示中`
  }

  await reload()
}

/* ────────────── ドメイン ────────────── */
interface DomainRow {
  uid?: string
  host?: string
  status?: string
  ssl?: boolean
  kind?: 'quick' | 'custom'
}
/**
 * クイックドメインの土台の設定欄と、DNS側でやることの案内。
 * ここで設定した土台の下に、フォルダごとのドメインを即発行できる（本体のフリードメインにあたる仕組み）。
 */
function quickDomainSection(container: HTMLElement, base: string): HTMLElement {
  const box = el('div', {
    style: `border:1px solid var(--sb-c-e6e6e6, #E6E6E6);border-radius:8px;padding:16px;margin-bottom:20px;background:${T.bg}`,
  })
  box.append(
    el('div', {
      text: 'クイックドメインの土台',
      style: `font-size:14px;font-weight:700;color:${T.text};margin-bottom:6px`,
    }),
    el('div', {
      text: 'ここにドメインを1本だけ設定し、そのドメインをこのシステムへワイルドカードで向けておくと、フォルダごとのドメインをその場で発行できます（ドメインの追加購入もDNS作業も要りません）。',
      style: `font-size:12px;color:${T.sub};line-height:1.7;margin-bottom:12px`,
    }),
  )

  if (base === '') {
    const warn = el('div', {
      style: [
        'border-left:3px solid var(--sb-warn-line, #DD6B20);background:var(--sb-warn-bg, #FFF7ED);border-radius:4px',
        'padding:12px 14px;margin-bottom:14px;font-size:12px;line-height:1.8',
        `color:${T.text}`,
      ].join(';'),
    })
    warn.append(
      el('div', { text: 'ドメインの取得が必要です', style: 'font-weight:700;margin-bottom:4px' }),
      el('div', { text: QUICK_DOMAIN_NEED_DOMAIN_NOTE }),
      el('div', { text: QUICK_DOMAIN_EXISTING_DOMAIN_WARNING, style: `color:${T.sub};margin-top:6px` }),
    )
    box.append(warn)
  }

  const bar = el('div', { style: 'display:flex;gap:8px;align-items:center;margin-bottom:12px' })
  const input = textInput('example.com')
  input.value = base
  const saveBtn = smallBtn('保存')
  saveBtn.addEventListener('click', () => {
    saveBtn.textContent = '保存中...'
    void api.setQuickDomain(input.value.trim()).then(
      (result) => {
        saveBtn.textContent = '保存'
        toast(result.quick_domain.base === '' ? '土台ドメインを未設定にしました' : '土台ドメインを保存しました')
        void renderDomains(container)
      },
      (error: Error) => {
        saveBtn.textContent = '保存'
        toast(error.message, 'error')
      },
    )
  })
  bar.append(input, saveBtn)
  box.append(bar)

  const list = el('div', { style: `font-size:12px;color:${T.sub};line-height:1.9` })
  list.append(el('div', { text: 'DNS側でやること', style: `color:${T.text};font-weight:600;margin-bottom:4px` }))
  quickDomainSteps(base).forEach((step, index) => {
    list.append(el('div', { text: `${index + 1}. ${step}` }))
  })
  box.append(list)
  return box
}

export async function renderDomains(container: HTMLElement): Promise<void> {
  const content = pageShell(
    container,
    'ドメイン',
    '※クローンが自作した画面です。クイックドメイン（自動発行）と独自ドメインの一覧を表示します。',
  )

  const quick = await api.quickDomain().catch(() => ({ quick_domain: { base: '' } }))
  content.append(quickDomainSection(container, quick.quick_domain.base))

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

  const domainList = el('div', { class: DATA_TABLE_CLASS })
  const grid = `grid-template-columns:1fr 120px 100px 60px`
  const head = el('div', {
    class: DATA_HEAD_CLASS,
    style: `display:grid;${grid};gap:12px;padding:10px 8px;border-bottom:2px solid var(--sb-c-eeeeee, #EEEEEE);font-size:12px;color:${T.sub}`,
  })
  head.append(
    el('div', { text: 'ドメイン' }),
    el('div', { text: '種別' }),
    el('div', { text: 'ステータス' }),
    el('div', { text: 'SSL' }),
  )
  domainList.append(head)

  for (const row of rows) {
    const tr = el('div', {
      class: DATA_ROW_CLASS,
      style: `display:grid;${grid};gap:12px;padding:12px 8px;border-bottom:1px solid var(--sb-c-f2f2f2, #F2F2F2);font-size:13px;color:${T.text};align-items:center`,
    })
    const statusLabel = row.status === 'active' ? 'アクティブ' : row.status === 'pending' ? '確認中' : (row.status ?? '-')
    const sslLabel = row.ssl === true ? 'ON' : 'OFF'
    const cells: readonly (readonly [string, HTMLElement])[] = [
      ['ドメイン', el('div', { text: row.host ?? '-', style: 'word-break:break-all' })],
      ['種別', el('div', { text: row.kind === 'quick' ? 'クイック' : '独自' })],
      [
        'ステータス',
        el('div', { text: statusLabel, style: `color:${row.status === 'active' ? '#38A169' : '#DD6B20'}` }),
      ],
      ['SSL', el('div', { text: sslLabel })],
    ]
    for (const [label, cell] of cells) {
      // スマホでは列名が消えるので、セル自身に持たせる（CSSが「列名 値」で出す）
      cell.dataset['label'] = label
      tr.append(cell)
    }
    // 削除ボタンは実装しない（実物もOwnerのみ・配信停止後のみ）
    domainList.append(tr)
  }
  content.append(domainList)
}

/* ────────────── レポート除外 ────────────── */
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
    const btn = smallBtn(opt.label, opt.value === activeSort ? 'var(--sb-accent, #0091FF)' : T.neutral, opt.value === activeSort ? '#FFF' : T.text)
    btn.addEventListener('click', () => {
      activeSort = opt.value
      for (const b of sortBar.querySelectorAll('button')) {
        const isActive = b.textContent === sortOptions.find((o) => o.value === activeSort)?.label
        ;(b as HTMLElement).style.background = isActive ? 'var(--sb-accent, #0091FF)' : T.neutral
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
