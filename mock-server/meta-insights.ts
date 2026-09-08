/**
 * Meta広告 Insights の取り込み（媒体実績＝配信金額 / IMP / 媒体Click / 媒体CV）。
 *
 * 【秘密情報の扱い】アクセストークンは **環境変数 `META_ACCESS_TOKEN` からのみ** 読む。
 * State にもコードにも保存しない・レスポンスにも含めない・ログにも出さない。
 * 未設定ならこの機能は無効（呼び出し側に「未設定」を返すだけで、推測で動かさない）。
 *
 * 【取得の粒度】LPごとに account / campaign / adset / ad を選べる。
 * `time_increment=1` で日別に割り、そのまま日次メトリクスへ入れる。
 *
 * 【CVの数え方】Meta の `actions` は action_type ごとの配列で、どれを「CV」と見なすかは
 * 運用で変わる。ここでは購入・リード系の標準的な action_type を合算する（下の CV_ACTION_TYPES）。
 * 実運用と合わなければこの配列を直せば全画面へ反映される。
 */

/** Graph API のバージョン。上げるときは env で差し替えられるようにしておく。 */
const GRAPH_VERSION = process.env['META_API_VERSION'] ?? 'v21.0'

/** CVとして数える action_type（購入・リード系の標準的なもの） */
const CV_ACTION_TYPES: readonly string[] = [
  'purchase',
  'offsite_conversion.fb_pixel_purchase',
  'lead',
  'offsite_conversion.fb_pixel_lead',
  'complete_registration',
  'offsite_conversion.fb_pixel_complete_registration',
]

export type MetaLevel = 'account' | 'campaign' | 'adset' | 'ad'

/** 1日ぶんの媒体実績 */
export interface MetaDailyRow {
  date: string
  ad_cost: number
  imp: number
  media_click: number
  media_cv: number
}

export type MetaFetchResult =
  | { ok: true; rows: MetaDailyRow[] }
  | { ok: false; reason: 'no_token' | 'request_failed'; message: string }

interface GraphAction {
  action_type?: unknown
  value?: unknown
}

interface GraphInsightRow {
  date_start?: unknown
  spend?: unknown
  impressions?: unknown
  clicks?: unknown
  inline_link_clicks?: unknown
  actions?: unknown
}

function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

/** actions 配列から CV 相当を合算する */
function sumConversions(actions: unknown): number {
  if (!Array.isArray(actions)) return 0
  let total = 0
  for (const raw of actions as GraphAction[]) {
    const type = typeof raw.action_type === 'string' ? raw.action_type : ''
    if (CV_ACTION_TYPES.includes(type)) total += toNumber(raw.value)
  }
  return total
}

/** `act_123` でも `123` でも受け取れるようにする（account のときだけ act_ を前置） */
function toEdgeId(level: MetaLevel, objectId: string): string {
  const id = objectId.trim().replace(/^act_/, '')
  return level === 'account' ? `act_${id}` : id
}

/**
 * Insights を日別で取得する。
 * トークン未設定・API失敗は例外にせず結果で返す（呼び出し側が「取り込めなかった」と言えるように）。
 */
export async function fetchMetaInsights(opts: {
  level: MetaLevel
  objectId: string
  since: string
  until: string
}): Promise<MetaFetchResult> {
  const token = process.env['META_ACCESS_TOKEN'] ?? ''
  if (token === '') {
    return {
      ok: false,
      reason: 'no_token',
      message: 'META_ACCESS_TOKEN が未設定です（Railwayの環境変数に設定してください）',
    }
  }

  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${toEdgeId(opts.level, opts.objectId)}/insights`)
  url.searchParams.set('fields', 'spend,impressions,clicks,inline_link_clicks,actions')
  url.searchParams.set('time_increment', '1')
  url.searchParams.set('time_range', JSON.stringify({ since: opts.since, until: opts.until }))
  url.searchParams.set('limit', '500')
  // account 以外は自分自身の集計でよいので level は指定しない（既定＝そのオブジェクト単位）

  try {
    // トークンはクエリではなくヘッダで送る（URLはログや履歴に残りやすいため）
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) {
      const body = (await res.text()).slice(0, 300)
      // ここに token は含めない
      return { ok: false, reason: 'request_failed', message: `Meta API ${res.status}: ${body}` }
    }
    const json = (await res.json()) as { data?: unknown }
    const data = Array.isArray(json.data) ? (json.data as GraphInsightRow[]) : []
    const rows: MetaDailyRow[] = []
    for (const row of data) {
      const date = typeof row.date_start === 'string' ? row.date_start : ''
      if (date === '') continue
      // 媒体Click は「リンククリック」を優先し、無ければ総クリック
      const linkClicks = toNumber(row.inline_link_clicks)
      rows.push({
        date,
        ad_cost: toNumber(row.spend),
        imp: toNumber(row.impressions),
        media_click: linkClicks > 0 ? linkClicks : toNumber(row.clicks),
        media_cv: sumConversions(row.actions),
      })
    }
    return { ok: true, rows }
  } catch (err) {
    return { ok: false, reason: 'request_failed', message: (err as Error).message }
  }
}

/** 機能が使える状態か（UIの出し分け用。トークンの値は返さない） */
export function isMetaConfigured(): boolean {
  return (process.env['META_ACCESS_TOKEN'] ?? '') !== ''
}
