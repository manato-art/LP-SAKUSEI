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
  const wrap = el('div', { style: 'overflow-x:auto' })
  const grid = `grid-template-columns:${columns.map((c) => c.width ?? 'minmax(90px,1fr)').join(' ')}`
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
      const cellStyle = `text-align:${col.align ?? 'left'};word-break:break-all`
      const href = col.href?.(row) ?? null
      if (href === null) {
        tr.append(el('div', { text: col.cell(row), style: cellStyle }))
        continue
      }
      const link = el('a', {
        text: col.cell(row),
        style: `${cellStyle};color:var(--sb-accent, #0091FF);text-decoration:none`,
      })
      link.href = href
      tr.append(link)
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
  input.style.cssText = style ?? `padding:8px 12px;border:1px solid #DDD;border-radius:6px;font-size:13px;font-family:${T.font};outline:none;flex:1;min-width:0`
  input.addEventListener('focus', () => { input.style.borderColor = 'var(--sb-accent, #0091FF)' })
  input.addEventListener('blur', () => { input.style.borderColor = '#DDD' })
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
