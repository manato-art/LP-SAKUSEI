/**
 * レポート上部の「Meta実データ」バナー（指示⑤⑧）。
 * env（META_ACCESS_TOKEN / META_AD_ACCOUNT_ID）が設定されているときだけ、Meta広告アカウント全体の
 * 集計KPIを**実際に引いて**表示する。未設定なら何も出さない（レポートは従来どおりモック）。
 *
 * ※紐付けの単位（1アカウント全体 / 施策ごと）は「後で決める」→ まずはアカウント全体を出す。
 */
import { api, type MetaInsightsResponse, type MetaKpi } from '../api.ts'

export async function mountMetaSummary(
  root: HTMLElement,
  rangeQuery: string,
  range: { startDate: string; endDate: string },
): Promise<void> {
  let status: { configured: boolean }
  try {
    status = await api.metaStatus()
  } catch {
    return
  }
  if (!status.configured) return

  let data: MetaInsightsResponse
  try {
    data = await api.metaInsights(rangeQuery)
  } catch (error) {
    root.insertBefore(errorBanner((error as Error).message), root.firstChild)
    return
  }
  const banner = data.kpi !== null ? kpiBanner(data.kpi, range) : errorBanner(data.error ?? '取得できませんでした')
  root.insertBefore(banner, root.firstChild)
}

function shell(): HTMLElement {
  const box = document.createElement('div')
  box.dataset['sbMetaBanner'] = 'true'
  box.style.cssText =
    'margin:12px 16px;padding:12px 16px;border-radius:10px;background:#12233b;' +
    'border:1px solid #1f3a5f;color:#e6eefc;font-family:"Hiragino Sans",sans-serif;font-size:13px'
  return box
}

function kpiBanner(kpi: MetaKpi, range: { startDate: string; endDate: string }): HTMLElement {
  const box = shell()
  const cvr = kpi.click > 0 ? (kpi.cv / kpi.click) * 100 : null
  const cpa = kpi.cv > 0 ? kpi.ad_cost / kpi.cv : null
  const items: [string, string][] = [
    ['配信金額', yen(kpi.ad_cost)],
    ['PV(imp)', int(kpi.pv)],
    ['Click', int(kpi.click)],
    ['媒体Click', int(kpi.media_click)],
    ['媒体CTR', pct(kpi.ctr)],
    ['CV', int(kpi.cv)],
    ['CVR', pct(cvr)],
    ['CPA', cpa === null ? '-' : yen(cpa)],
    ['ROAS', kpi.roas === null ? '-' : `${round(kpi.roas)}`],
  ]
  const chips = items
    .map(
      ([label, value]) =>
        `<span style="display:inline-flex;flex-direction:column;min-width:88px;margin:4px 14px 4px 0">` +
        `<span style="opacity:.65;font-size:11px">${label}</span>` +
        `<span style="font-size:16px;font-weight:600">${value}</span></span>`,
    )
    .join('')
  box.innerHTML =
    `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">` +
    `<span style="font-weight:700">Meta実データ</span>` +
    `<span style="opacity:.6">アカウント全体 ・ ${escapeText(range.startDate)}〜${escapeText(range.endDate)}</span></div>` +
    `<div style="display:flex;flex-wrap:wrap">${chips}</div>`
  return box
}

function errorBanner(message: string): HTMLElement {
  const box = shell()
  box.style.background = '#3b1f22'
  box.style.borderColor = '#5f2a2f'
  box.innerHTML =
    `<div style="font-weight:700;margin-bottom:4px">Meta実データを取得できませんでした</div>` +
    `<div style="opacity:.8;font-size:12px">${escapeText(message)}</div>`
  return box
}

function yen(value: number): string {
  return `¥${Math.round(value).toLocaleString('ja-JP')}`
}
function int(value: number): string {
  return Math.round(value).toLocaleString('ja-JP')
}
function pct(value: number | null): string {
  return value === null ? '-' : `${round(value)}%`
}
function round(value: number): number {
  return Math.round(value * 100) / 100
}
function escapeText(value: string): string {
  const el = document.createElement('span')
  el.textContent = value
  return el.innerHTML
}
