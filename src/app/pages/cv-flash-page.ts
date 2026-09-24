/**
 * CV速報（sidebar-data.ts から分離・2026-09-24）。
 *
 * 列構成・「CSVダウンロード」・件数表示は**実物の採取**に合わせている
 * （実パスは /conversion-reports、8列、0件でもヘッダーを出したまま「1 ~ 0件を表示中」）。
 * 2026-09-15: 実物にある 期間 / 検索 / 最終更新 / 見出し「コンバージョン」/ 通知設定 を足した。
 * このクローンが持てない項目（アクセス日時）は埋めずに「-」にする。
 *
 * 2026-09-24（点検33）:
 *  - 件数を指定せずに頼んでいたのでサーバーの既定20件で切れていた → 1ページ50件でページ送り
 *  - CSV は表示中の行だけだった → 期間・検索に合う**全件**を取り直して書き出す
 *  - サーバーが /cable へ流す新しい CV で、開いたまま自動で更新する（live-conversions.ts）
 *  - 読み込みに失敗しても「1 ~ 0件」と出ていた → 失敗と分かる表示にする
 */
import { T, el, toast } from '../ui.ts'
import { jstParts } from '../jst.ts'
import {
  fetchAllPages,
  loadErrorBox,
  pageRangeLabel,
  pageShell,
  pager,
  requestJson,
  smallBtn,
  table,
  textInput,
} from './data-ui.ts'
import { cableUrl, subscribeConversions, type LiveStatus } from './live-conversions.ts'

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

interface ConversionsResponse {
  conversions: ConversionRow[]
  pagination?: { total_pages: number; total_count: number; current_page: number }
  last_updated_at?: number | null
}

/** 1ページに出す件数 */
const PER_PAGE = 50
/** CSV のために全件をたどるときの1回ぶん */
const CSV_PAGE_SIZE = 1000

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
  return `﻿${[head.map(cell).join(','), ...lines].join('\r\n')}\r\n`
}

/** 自動更新の状態の文言 */
const LIVE_LABEL: Readonly<Record<LiveStatus, string>> = {
  connecting: '自動更新: つないでいます…',
  live: '自動更新: オン（新しいCVが届くと自動で出ます）',
  reconnecting: '自動更新: 切れました。つなぎ直しています…',
}

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
  let page = 1

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
      page = 1
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
    page = 1
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
  const live = el('span', { text: LIVE_LABEL.connecting, style: `font-size:11px;color:${T.sub}` })
  const notify = smallBtn('通知設定', T.surface, T.text)
  notify.style.border = `1px solid var(--sb-c-dddddd, #DDDDDD)`
  notify.addEventListener('click', () => {
    // 通知の設定はアカウント設定の中にある（実物も別画面へ飛ぶ）
    location.hash = '#/settings/internal_notifications/member'
  })
  const csv = smallBtn('CSVダウンロード')
  const spacer = el('span', { style: 'margin-left:auto' })
  bar.append(live, spacer, notify, csv)
  content.append(bar)

  const tableHost = el('div', {})
  const foot = el('div', {
    style: 'display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px;flex-wrap:wrap',
  })
  const countLabel = el('div', { text: '1 ~ 0件を表示中', style: `font-size:12px;color:${T.sub}` })
  const pagerHost = el('div', {})
  foot.append(countLabel, pagerHost)
  content.append(tableHost, foot)

  /** 期間・検索（ページは含めない）。CSV も同じ条件で全件を取る */
  const filterParams = (): URLSearchParams => {
    const params = new URLSearchParams()
    // 期間は両端そろったときだけ掛ける（片方だけでは意味が決まらない）
    if (range.start !== '' && range.end !== '') {
      params.set('start_date', range.start)
      params.set('end_date', range.end)
    }
    if (keyword !== '') params.set('q', keyword)
    return params
  }

  csv.addEventListener('click', () => {
    csv.disabled = true
    void fetchAllPages<ConversionRow>(async (n) => {
      const params = filterParams()
      params.set('per_page', String(CSV_PAGE_SIZE))
      params.set('page', String(n))
      const data = await requestJson<ConversionsResponse>(`/conversions?${params.toString()}`)
      return { items: data.conversions, totalPages: data.pagination?.total_pages ?? 1 }
    })
      .then((all) => {
        if (all.length === 0) {
          toast('書き出すコンバージョンがありません', 'error')
          return
        }
        const blob = new Blob([conversionsCsv(all)], { type: 'text/csv;charset=utf-8' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `conversions_${todayKey}.csv`
        a.click()
        URL.revokeObjectURL(a.href)
        toast(`${all.length.toLocaleString('ja-JP')}件をCSVにしました`)
      })
      .catch((error: unknown) => {
        toast(`CSVを作れませんでした（${error instanceof Error ? error.message : '通信エラー'}）`, 'error')
      })
      .finally(() => {
        csv.disabled = false
      })
  })

  async function reload(): Promise<void> {
    const params = filterParams()
    params.set('per_page', String(PER_PAGE))
    params.set('page', String(page))
    let data: ConversionsResponse
    try {
      data = await requestJson<ConversionsResponse>(`/conversions?${params.toString()}`)
    } catch (error) {
      // 読めなかったのに「1 ~ 0件」と出すと、CVが無いように見える
      tableHost.replaceChildren(
        loadErrorBox(error instanceof Error ? error.message : '通信エラー', () => void reload()),
      )
      countLabel.textContent = ''
      pagerHost.replaceChildren()
      return
    }
    const shown = data.conversions
    const total = data.pagination?.total_count ?? shown.length
    const totalPages = data.pagination?.total_pages ?? 1
    updated.textContent = lastUpdatedLabel(data.last_updated_at)
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
    countLabel.textContent = pageRangeLabel({ page, perPage: PER_PAGE, shown: shown.length, total })
    pagerHost.replaceChildren(
      pager(page, totalPages, (next) => {
        page = next
        void reload()
      }),
    )
  }

  // 新しい CV が届いたら取り直す（見ているページ・絞り込みのまま）。画面を離れたら止まる
  subscribeConversions({
    url: cableUrl(),
    isActive: () => content.isConnected,
    onConversion: () => void reload(),
    onStatus: (status) => {
      live.textContent = LIVE_LABEL[status]
    },
  })

  await reload()
}
