/**
 * サイドバーのデータ画面で共通に使う部品（画面シェル・表・数値の書式・小物）。
 *
 * ダッシュボード / CV速報 / ドメイン / ランキング などは、実本体の採取が許可経路外で
 * できないため「モックAPIのデータを土台に機能する画面を自作する」区分（指示⑮）。
 * どの画面も同じ見た目・同じ書式で出したいので、共通部分はここに置く。
 */
import { T, el, emptyState } from '../ui.ts'

const API = '/api/v1'

export async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

/** 読み込みの結果。失敗したときは理由（サーバーの文言・状態コード・つながらない理由）を持つ */
export type JsonResult<T> = { ok: true; data: T } | { ok: false; message: string }

/**
 * getJson の理由つき版（2026-09-24）。getJson は失敗を null にするので、
 * 画面が「0件」と見分けられず、理由も出せなかった。既存の呼び出し側はそのまま残し、
 * 失敗を画面に出したいところだけこちらを使う。
 */
export async function getJsonResult<T>(path: string): Promise<JsonResult<T>> {
  let res: Response
  try {
    res = await fetch(`${API}${path}`)
  } catch (error) {
    return { ok: false, message: (error as Error).message }
  }
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    return { ok: false, message: detail?.error?.message ?? `読み込みに失敗しました（${res.status}）` }
  }
  return { ok: true, data: (await res.json()) as T }
}

/**
 * 読み込み。失敗したら理由つきで投げる（2026-09-24）。
 *
 * getJson は失敗を null にするので、CV速報やランキングは読み込めなかったときも「0件」と同じ表示になっていた。
 * 画面が「読めなかった」と言えるように、こちらはサーバーの言い分（error.message）かHTTPの番号を持って投げる。
 */
export async function requestJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`)
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: unknown } } | null
    const message = body?.error?.message
    throw new Error(typeof message === 'string' && message !== '' ? message : `読み込めませんでした（HTTP ${res.status}）`)
  }
  return (await res.json()) as T
}

/**
 * ページを最後までたどって全部集める（CSV に期間の全件を入れるため）。
 * @param fetchPage 1 から始まるページ番号で1ページぶんを返す
 */
export async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<{ items: readonly T[]; totalPages: number }>,
): Promise<T[]> {
  const out: T[] = []
  for (let page = 1; ; page += 1) {
    const { items, totalPages } = await fetchPage(page)
    out.push(...items)
    if (page >= totalPages || items.length === 0) return out
  }
}

/** 「51 ~ 100件を表示中（全120件）」。0件は実物どおり「1 ~ 0件を表示中」 */
export function pageRangeLabel(input: { page: number; perPage: number; shown: number; total: number }): string {
  if (input.total === 0) return '1 ~ 0件を表示中'
  const from = (input.page - 1) * input.perPage + 1
  return `${from} ~ ${from + input.shown - 1}件を表示中（全${input.total.toLocaleString('ja-JP')}件）`
}

/** ページ送り（‹ 1 2 3 ›）。ページが1つなら何も出さない */
export function pager(current: number, totalPages: number, onPage: (page: number) => void): HTMLElement {
  const bar = el('div', { style: 'display:flex;gap:4px;align-items:center;flex-wrap:wrap' })
  if (totalPages <= 1) return bar
  const button = (label: string, page: number, disabled: boolean, isCurrent = false): HTMLButtonElement => {
    const b = smallBtn(label, isCurrent ? 'var(--sb-accent, #0091FF)' : T.neutral, isCurrent ? '#FFF' : T.text)
    b.style.padding = '4px 10px'
    b.disabled = disabled
    if (isCurrent) b.setAttribute('aria-current', 'page')
    b.addEventListener('click', () => onPage(page))
    return b
  }
  bar.append(button('‹', current - 1, current <= 1))
  // ページが多いときは前後2つずつと両端だけ出す
  const shown = new Set([1, totalPages, current - 2, current - 1, current, current + 1, current + 2])
  let last = 0
  for (let page = 1; page <= totalPages; page += 1) {
    if (!shown.has(page)) continue
    if (page - last > 1) bar.append(el('span', { text: '…', style: `color:${T.sub};font-size:12px` }))
    bar.append(button(String(page), page, false, page === current))
    last = page
  }
  bar.append(button('›', current + 1, current >= totalPages))
  return bar
}

/** 読み込めなかったときの表示（0件と見分けがつくように、理由と「もう一度」を出す） */
export function loadErrorBox(message: string, onRetry: () => void): HTMLElement {
  const box = el('div', {
    style: `padding:20px;text-align:center;font-size:13px;color:${T.text};line-height:1.8`,
  })
  const retry = smallBtn('もう一度読み込む', T.neutral, T.text)
  retry.addEventListener('click', onRetry)
  box.append(el('div', { text: `読み込めませんでした（${message}）` }), retry)
  return box
}

export async function postJson<T>(path: string, body: unknown): Promise<T | null> {
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


/** 画面の共通シェル：白カード＋タイトル＋「クローン自作」注記＋本文コンテナを返す */
export function pageShell(container: HTMLElement, title: string, note: string): HTMLElement {
  container.style.cssText = `flex:1;min-width:0;background:${T.bg};min-height:100vh`
  container.innerHTML = ''
  // クラスはスマホ用CSS（mobile-css.ts）が余白・角丸を外すための目印
  const body = el('div', { class: 'sb-page-shell', style: `padding:24px 28px;font-family:${T.font}` })
  body.append(
    el('div', { class: 'sb-page-title', text: title, style: `font-size:20px;font-weight:700;color:${T.text};margin-bottom:4px` }),
    el('div', {
      class: 'sb-page-note',
      text: note,
      style: `font-size:12px;color:${T.sub};margin-bottom:20px;line-height:1.7`,
    }),
  )
  const content = el('div', {
    class: 'sb-page-card',
    style: `background:${T.surface};border-radius:10px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,.06)`,
  })
  body.append(content)
  container.append(body)
  return content
}

/** 表の目印クラス。スマホでは1行＝1カードに組み替える（mobile-css.ts） */
export const DATA_TABLE_CLASS = 'sb-data-table'
export const DATA_HEAD_CLASS = 'sb-data-head'
export const DATA_ROW_CLASS = 'sb-data-row'

export interface Column<Row> {
  head: string
  cell: (row: Row) => string
  align?: 'left' | 'right'
  /** セルをリンクにする。null を返した行はただの文字のまま。 */
  href?: (row: Row) => string | null
  /**
   * この列だけ幅を変える（grid-template-columns の1つぶん）。
   * 名前の列は数値の列より広くしないと、1行に収まらず折り返して読みにくくなる。
   */
  width?: string
}

/**
 * 一覧テーブル。
 * `keepHeaderWhenEmpty` は「0件でも見出し行を出す」画面のためのもの。実物のCV速報は
 * 0件でも8列のヘッダーを出したまま件数だけ「1 ~ 0件を表示中」と出す作りだった（採取で確認）。
 */
export function table<Row>(
  rows: readonly Row[],
  columns: readonly Column<Row>[],
  empty: string,
  opts?: { keepHeaderWhenEmpty?: boolean },
): HTMLElement {
  if (rows.length === 0 && opts?.keepHeaderWhenEmpty !== true) return emptyState(empty)
  const wrap = el('div', { class: DATA_TABLE_CLASS, style: 'overflow-x:auto' })
  const grid = `grid-template-columns:${columns.map((c) => c.width ?? 'minmax(90px,1fr)').join(' ')}`
  const head = el('div', {
    class: DATA_HEAD_CLASS,
    style: `display:grid;${grid};gap:12px;padding:10px 8px;border-bottom:2px solid var(--sb-c-eeeeee, #EEEEEE);font-size:12px;color:${T.sub}`,
  })
  for (const col of columns) {
    head.append(el('div', { text: col.head, style: `text-align:${col.align ?? 'left'}` }))
  }
  wrap.append(head)
  for (const row of rows) {
    const tr = el('div', {
      class: DATA_ROW_CLASS,
      style: `display:grid;${grid};gap:12px;padding:12px 8px;border-bottom:1px solid var(--sb-c-f2f2f2, #F2F2F2);font-size:13px;color:${T.text}`,
    })
    for (const col of columns) {
      // `word-break:break-all` は必ず文字単位で折るので、日時が
      // 「2026/09/15 1 / 9:21:24」のように数字の途中で割れていた。
      // `overflow-wrap:anywhere` なら、まず空白で折り、収まらないときだけ文字単位で折る。
      const cellStyle = `text-align:${col.align ?? 'left'};overflow-wrap:anywhere`
      const href = col.href?.(row) ?? null
      const cell =
        href === null
          ? el('div', { text: col.cell(row), style: cellStyle })
          : el('a', {
              text: col.cell(row),
              style: `${cellStyle};color:var(--sb-accent, #0091FF);text-decoration:none`,
            })
      if (cell instanceof HTMLAnchorElement) cell.href = href ?? ''
      // スマホでは列名が消えるので、セル自身に持たせておく（CSSが `列名 値` で出す）
      cell.dataset['label'] = col.head
      tr.append(cell)
    }
    wrap.append(tr)
  }
  return wrap
}

export function yen(n: number): string {
  return `¥${Math.round(n).toLocaleString('ja-JP')}`
}
export function int(n: number): string {
  return Math.round(n).toLocaleString('ja-JP')
}
export function ratio(n: number | null, unit = ''): string {
  return n === null ? '-' : `${Math.round(n * 100) / 100}${unit}`
}

/** テキスト入力を作る共通ヘルパー */
export function textInput(placeholder: string, style?: string): HTMLInputElement {
  const input = document.createElement('input')
  input.type = 'text'
  input.placeholder = placeholder
  input.style.cssText = style ?? `padding:8px 12px;border:1px solid var(--sb-c-dddddd, #DDDDDD);border-radius:6px;font-size:13px;font-family:${T.font};outline:none;flex:1;min-width:0`
  input.addEventListener('focus', () => { input.style.borderColor = 'var(--sb-accent, #0091FF)' })
  input.addEventListener('blur', () => { input.style.borderColor = 'var(--sb-c-dddddd, #DDDDDD)' })
  return input
}

/** 小さいボタン */
export function smallBtn(label: string, bg = 'var(--sb-accent, #0091FF)', color = '#FFF'): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.textContent = label
  btn.style.cssText = `padding:8px 16px;border:none;border-radius:6px;background:${bg};color:${color};cursor:pointer;font-size:13px;font-family:${T.font};white-space:nowrap`
  return btn
}

/* ── KPI集計の型（mock の aggregate と同形・派生値は null 可） ── */
export interface Kpi {
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
