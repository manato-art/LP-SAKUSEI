/**
 * Meta（Facebook）広告 Insights を**実際に引く**クライアント（指示⑤⑧・cockpitの方式を移植）。
 *
 * cockpit（github.com/manato-art/cockpit）の scripts/data-agent/meta-api.js と同じく:
 *   GET https://graph.facebook.com/v22.0/act_{id}/insights
 *   認証は `Authorization: Bearer <token>`（URLにトークンを載せない）。
 *
 * 認証情報は**環境変数**から読む（コードにも本番にもハードコードしない・§セキュリティ）:
 *   META_ACCESS_TOKEN     … ads_read 権限のアクセストークン
 *   META_AD_ACCOUNT_ID    … 広告アカウントID（act_xxx でも数字だけでも可）
 *   META_API_VERSION      … 省略時 v22.0
 *
 * 未設定なら configured:false を返し、呼び元はモック/0にフォールバックする（クローンは既定では
 * 実データに触れない・env を入れたときだけ実連携する）。まずは**アカウント全体の集計**を返す
 * （施策ごとの紐付けは後日・指示⑧「まずはメタだけ」）。
 */

const DEFAULT_VERSION = 'v22.0'

export interface MetaKpi {
  /** 配信金額（spend） */
  ad_cost: number
  /** PV相当（impressions） */
  pv: number
  /** Click（inline_link_clicks があればそれ、無ければ clicks） */
  click: number
  /** 媒体Click（clicks） */
  media_click: number
  /** CV（purchase/lead 系 actions の合計） */
  cv: number
  /** CTR（媒体CTR・Meta の ctr） */
  ctr: number | null
  /** ROAS（purchase_roas） */
  roas: number | null
  /** 期間（返却された date_start/date_stop） */
  date_start?: string
  date_stop?: string
}

export interface MetaInsightsResult {
  configured: boolean
  /** 取得できたときの集計KPI（未設定・失敗時は null） */
  kpi: MetaKpi | null
  /** 失敗時のメッセージ（レート制限・権限エラー等）。UIで「取得できませんでした」を出すのに使う */
  error?: string
}

interface MetaConfig {
  token: string
  accountId: string
  version: string
}

/** env から Meta 連携設定を読む。未設定なら null。 */
export function readMetaConfig(): MetaConfig | null {
  const token = (process.env['META_ACCESS_TOKEN'] ?? '').trim()
  const rawAccount = (process.env['META_AD_ACCOUNT_ID'] ?? '').trim()
  if (token === '' || rawAccount === '') return null
  const bare = rawAccount.replace(/^act_/, '')
  return {
    token,
    accountId: `act_${bare}`,
    version: (process.env['META_API_VERSION'] ?? DEFAULT_VERSION).trim() || DEFAULT_VERSION,
  }
}

export function isMetaConfigured(): boolean {
  return readMetaConfig() !== null
}

/** 直近の取得結果を短時間キャッシュ（レート制限緩和・cockpit踏襲の TTL 発想） */
const CACHE_TTL_MS = 5 * 60 * 1000
const cache = new Map<string, { at: number; result: MetaInsightsResult }>()

/**
 * アカウント全体の Insights を取得して集計KPIに落とす。
 * @param range 集計期間（YYYY-MM-DD）。未指定なら直近7日（date_preset=last_7d 相当）。
 * @param now 現在時刻（ms）。テストから注入できるように引数化（Date.now は使わない方針）。
 */
export async function fetchAccountKpi(
  range: { from?: string; to?: string },
  now: number,
): Promise<MetaInsightsResult> {
  const config = readMetaConfig()
  if (config === null) return { configured: false, kpi: null }

  const cacheKey = `${config.accountId}:${range.from ?? 'last7'}:${range.to ?? 'last7'}`
  const hit = cache.get(cacheKey)
  if (hit !== undefined && now - hit.at < CACHE_TTL_MS) return hit.result

  let result: MetaInsightsResult
  try {
    const rows = await fetchInsightRows(config, range)
    result = { configured: true, kpi: aggregateRows(rows) }
  } catch (error) {
    result = { configured: true, kpi: null, error: (error as Error).message }
  }
  cache.set(cacheKey, { at: now, result })
  return result
}

interface InsightRow {
  spend?: string
  impressions?: string
  clicks?: string
  inline_link_clicks?: string
  ctr?: string
  actions?: { action_type: string; value: string }[]
  purchase_roas?: { action_type: string; value: string }[]
  date_start?: string
  date_stop?: string
}

async function fetchInsightRows(
  config: MetaConfig,
  range: { from?: string; to?: string },
): Promise<InsightRow[]> {
  const base = `https://graph.facebook.com/${config.version}`
  const fields = [
    'spend',
    'impressions',
    'clicks',
    'inline_link_clicks',
    'ctr',
    'actions',
    'purchase_roas',
    'date_start',
    'date_stop',
  ].join(',')
  const params = new URLSearchParams({ fields, level: 'account', limit: '500' })
  if (range.from !== undefined && range.to !== undefined) {
    params.set('time_range', JSON.stringify({ since: range.from, until: range.to }))
  } else {
    params.set('date_preset', 'last_7d')
  }

  const rows: InsightRow[] = []
  let url: string | null = `${base}/${config.accountId}/insights?${params.toString()}`
  const headers = { Authorization: `Bearer ${config.token}` }
  // paging.next を辿る（アカウント集計なので通常1ページだが、念のため踏襲）
  while (url !== null) {
    const res = await fetch(url, { headers })
    const json = (await res.json()) as {
      data?: InsightRow[]
      paging?: { next?: string }
      error?: { code: number; message: string }
    }
    if (json.error) throw new Error(`Meta API Error [${json.error.code}]: ${json.error.message}`)
    rows.push(...(json.data ?? []))
    url = json.paging?.next ?? null
  }
  return rows
}

/** 会話系の action_type を CV とみなす（v1・後で調整可能） */
const CV_ACTION = /purchase|lead|complete_registration|submit_application|onsite_conversion/i

/** 複数行（=日別など）を1つの集計KPIへ畳む */
export function aggregateRows(rows: readonly InsightRow[]): MetaKpi {
  let spend = 0
  let impressions = 0
  let clicks = 0
  let linkClicks = 0
  let cv = 0
  let roasWeighted = 0
  for (const row of rows) {
    const rowSpend = num(row.spend)
    spend += rowSpend
    impressions += num(row.impressions)
    clicks += num(row.clicks)
    linkClicks += num(row.inline_link_clicks)
    for (const action of row.actions ?? []) {
      if (CV_ACTION.test(action.action_type)) cv += num(action.value)
    }
    const rowRoas = (row.purchase_roas ?? []).reduce((sum, r) => sum + num(r.value), 0)
    roasWeighted += rowRoas * rowSpend
  }
  const click = linkClicks > 0 ? linkClicks : clicks
  return {
    ad_cost: round2(spend),
    pv: impressions,
    click,
    media_click: clicks,
    cv,
    ctr: impressions > 0 ? round2((clicks / impressions) * 100) : null,
    // ROAS は費用で加重平均（費用0なら null）
    roas: spend > 0 ? round2(roasWeighted / spend) : null,
  }
}

function num(value: string | undefined): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
