/**
 * ランキング（sidebar-data.ts から分離・2026-09-24）。
 *
 * 2026-09-24（点検33）:
 *  - 件数を指定せずに頼んでいたのでサーバーの既定20件で切れていた → 1ページ50件でページ送り・件数を出す
 *  - 読み込みに失敗しても空（0件）と同じ表示だった → 失敗と分かる表示にする
 *  - 新しい CV が届いたら並びを取り直す（CV速報と同じ /cable）
 */
import { T, el } from '../ui.ts'
import {
  int,
  loadErrorBox,
  pageRangeLabel,
  pageShell,
  pager,
  ratio,
  requestJson,
  smallBtn,
  table,
  yen,
} from './data-ui.ts'
import { cableUrl, subscribeConversions } from './live-conversions.ts'

interface RankRow {
  title?: string
  uid?: string
  sales?: number
  cv?: number
  pv?: number
  ad_cost?: number
  roas?: number | null
}

interface RankingsResponse {
  ab_tests: RankRow[]
  pagination?: { total_pages: number; total_count: number; current_page: number }
}

/** 1ページに出す件数 */
const PER_PAGE = 50
/** CV が続けて届いたときに、取り直しをまとめる時間 */
const RELOAD_DEBOUNCE_MS = 2000

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
  let page = 1

  const tableHost = el('div', { class: 'sb-rank-table' })
  const foot = el('div', {
    style: 'display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px;flex-wrap:wrap',
  })
  const countLabel = el('div', { style: `font-size:12px;color:${T.sub}` })
  const pagerHost = el('div', {})
  foot.append(countLabel, pagerHost)

  async function loadRankings(): Promise<void> {
    const params = new URLSearchParams({
      sort: activeSort,
      sort_direction: 'desc',
      per_page: String(PER_PAGE),
      page: String(page),
    })
    let data: RankingsResponse
    try {
      data = await requestJson<RankingsResponse>(`/ab_tests/rankings?${params.toString()}`)
    } catch (error) {
      // 読めなかったのに「ランキングを作れるページがまだありません」と出すと、ページが無いように見える
      tableHost.replaceChildren(
        loadErrorBox(error instanceof Error ? error.message : '通信エラー', () => void loadRankings()),
      )
      countLabel.textContent = ''
      pagerHost.replaceChildren()
      return
    }
    const rows = data.ab_tests
    const total = data.pagination?.total_count ?? rows.length
    tableHost.replaceChildren(
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
    countLabel.textContent = total === 0 ? '' : pageRangeLabel({ page, perPage: PER_PAGE, shown: rows.length, total })
    pagerHost.replaceChildren(
      pager(page, data.pagination?.total_pages ?? 1, (next) => {
        page = next
        void loadRankings()
      }),
    )
  }

  for (const opt of sortOptions) {
    const btn = smallBtn(opt.label, opt.value === activeSort ? 'var(--sb-accent, #0091FF)' : T.neutral, opt.value === activeSort ? '#FFF' : T.text)
    btn.addEventListener('click', () => {
      activeSort = opt.value
      page = 1
      for (const b of sortBar.querySelectorAll('button')) {
        const isActive = b.textContent === sortOptions.find((o) => o.value === activeSort)?.label
        ;(b as HTMLElement).style.background = isActive ? 'var(--sb-accent, #0091FF)' : T.neutral
        ;(b as HTMLElement).style.color = isActive ? '#FFF' : T.text
      }
      void loadRankings()
    })
    sortBar.append(btn)
  }
  content.append(sortBar, tableHost, foot)

  // 新しい CV で並び（売上・CV）が変わるので取り直す。続けて届いたら1回にまとめる
  let reloadTimer: ReturnType<typeof setTimeout> | null = null
  subscribeConversions({
    url: cableUrl(),
    isActive: () => content.isConnected,
    onConversion: () => {
      if (reloadTimer !== null) clearTimeout(reloadTimer)
      reloadTimer = setTimeout(() => void loadRankings(), RELOAD_DEBOUNCE_MS)
    },
    // ランキングの画面には自動更新の状態の表示が無い（切れてもつなぎ直すだけ）
    onStatus: () => undefined,
  })

  await loadRankings()
}
