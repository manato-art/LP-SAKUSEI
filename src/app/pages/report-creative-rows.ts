/**
 * クリエイティブレポートに並べる「広告パラメータの行」と、その並べ替え（2026-09-15）。
 *
 * 実物（capture/clean/ab_tests__UID__reports/report-settings-modal の
 * `_reportWrapper_1fhbq_152`）は、列のチップ（配信金額 / CV / CPA / CTR / CVR）ごとに
 * 「並び替え」→「A-Zで並べ替え」「Z-Aで並べ替え」を持ち、その下に
 * `utm_source=ig` のような行が並ぶ。最後に「もっと表示」（`_readMore_1fhbq_440`）。
 *
 * 材料は Branch Operation と同じ「Version×広告パラメータ」の集計。
 * クリエイティブは Version をまたいだ広告そのものの成績なので、ここで足し合わせる。
 */
import type { ReportDailyRow, ReportKpi, ReportVersionRow } from '../api.ts'

/** 「もっと表示」を押すまでに出す件数 */
export const CREATIVE_PAGE_SIZE = 5

/** 並べ替えできる列（採取物のチップと同じ5つ） */
export type CreativeSortKey = 'ad_cost' | 'cv' | 'cpa' | 'ctr' | 'cvr' | 'pv' | 'click'
export type SortDirection = 'asc' | 'desc'

/** 割り算で出す値は足せない。合計から出し直す（§10-5の恒等式と同じ向き）。 */
function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator
}

/**
 * Version ごとにぶら下がっている広告パラメータの行を、広告ごとに足し合わせる。
 * 並びはPVの多い順（実物の一覧も多い順だった）。
 */
export function creativeParameterRows(
  versions: readonly ReportVersionRow[],
): ReportVersionRow[] {
  const sums = new Map<string, ReportVersionRow>()
  for (const version of versions) {
    // クリエイティブの一覧はレポート設定の「クリエイティブ」で絞ったもの（Branch Operation の列には左右されない・2026-09-24）
    for (const child of version.creative_children ?? []) {
      const base = sums.get(child.name)
      if (base === undefined) {
        sums.set(child.name, { ...child, entity_uid: child.name })
        continue
      }
      sums.set(child.name, {
        ...base,
        pv: base.pv + child.pv,
        click: base.click + child.click,
        cv: base.cv + child.cv,
        ad_cost: base.ad_cost + child.ad_cost,
        imp: base.imp + child.imp,
        media_click: base.media_click + child.media_click,
        media_cv: base.media_cv + child.media_cv,
        sales: base.sales + child.sales,
        gross_profit: base.gross_profit + child.gross_profit,
        // どちらかに本当の配信金額があれば「分かる」（どちらも無ければ分からないまま）
        cost_known: base.cost_known !== false || child.cost_known !== false,
      })
    }
  }
  return [...sums.values()]
    .map((row) => ({ ...row, ...recalcRatios(row) }))
    .sort((a, b) => b.pv - a.pv || a.name.localeCompare(b.name))
}

/**
 * 足したあとに率をもう一度出す（率を足すと壊れる）。
 * 配信金額が分からない行（広告の行はふつうそう・2026-09-24）は、費用を使う率を出さない（¥0 にしない）。
 */
function recalcRatios(row: ReportVersionRow): Partial<ReportKpi> {
  const isCostKnown = row.cost_known !== false
  return {
    ctr: ratio(row.click, row.pv),
    cvr: ratio(row.cv, row.click),
    ctvr: ratio(row.cv, row.pv),
    cpa: isCostKnown ? ratio(row.ad_cost, row.cv) : null,
    mcpa: isCostKnown ? ratio(row.ad_cost, row.click) : null,
    media_ctr: ratio(row.media_click, row.imp),
    roas: isCostKnown ? ratio(row.sales, row.ad_cost) : null,
  }
}

/**
 * 列のチップの「A-Zで並べ替え」＝小さい順 /「Z-Aで並べ替え」＝大きい順。
 * 値が無い行（-）はどちら向きでも後ろへ回す（前に出ると「0より小さい」ように見える）。
 */
export function sortCreativeRows(
  rows: readonly ReportVersionRow[],
  key: CreativeSortKey,
  direction: SortDirection,
): ReportVersionRow[] {
  return [...rows].sort((a, b) => {
    const left = a[key]
    const right = b[key]
    if (left === null && right === null) return a.name.localeCompare(b.name)
    if (left === null) return 1
    if (right === null) return -1
    if (left === right) return a.name.localeCompare(b.name)
    return direction === 'asc' ? left - right : right - left
  })
}

/* ================================================================
 *  クリエイティブの絞り込み（2026-09-24・点検19）
 *  「配信中 / 停止中 / ALL」「平均 / 合計」「Parameter検索」は押せるのに何も変わらなかった。
 * ================================================================ */

export type AdStatusFilter = '配信中' | '停止中' | 'ALL'
export type Aggregation = '平均' | '合計'

/**
 * 実際に配信している Version か。配信の抽選（routes/delivery-targeting.ts pickDeliveryVersion）と同じ条件
 * ＝アーカイブしておらず配信割合が1%以上。状態ラベル（公開中・準備中）では決めない
 * （本番のページは「準備中」のまま配信している）。
 */
export function isDeliveringVersion(row: Pick<ReportVersionRow, 'archived' | 'distribution_ratio'>): boolean {
  return row.archived !== true && row.distribution_ratio >= 1
}

export function filterVersionsByAdStatus(
  rows: readonly ReportVersionRow[],
  status: AdStatusFilter,
): ReportVersionRow[] {
  if (status === 'ALL') return [...rows]
  return rows.filter((row) => isDeliveringVersion(row) === (status === '配信中'))
}

/**
 * 選んだ Version の日別（LP側）を足し直す。配信金額はページ単位にしか無いので分からない（cost_known:false）。
 * 日付はグラフの期間の全日（無い日は0）。
 */
export function versionDailySeries(
  versions: readonly ReportVersionRow[],
  dates: readonly string[],
): ReportDailyRow[] {
  return dates.map((date) => {
    let pv = 0
    let click = 0
    let cv = 0
    let sales = 0
    for (const version of versions) {
      for (const day of version.daily_lp ?? []) {
        if (day.date !== date) continue
        pv += day.pv
        click += day.click
        cv += day.cv
        sales += day.sales
      }
    }
    return {
      date,
      cost_known: false,
      pv, click, cv, sales,
      ad_cost: 0, imp: 0, media_click: 0, media_cv: 0, gross_profit: sales,
      ctr: ratio(click, pv),
      cvr: ratio(cv, click),
      ctvr: ratio(cv, pv),
      cpa: null, mcpa: null, roas: null, roi: null, media_ctr: null,
      fver: null, sver: null, fsver: null, oar: null,
    }
  })
}

/** 回数・金額（日数で割れる値）。率はもともと割り算なので割らない */
const COUNT_KEYS = ['pv', 'click', 'cv', 'ad_cost', 'imp', 'media_click', 'media_cv', 'sales'] as const

/**
 * グラフの横に出す、期間の値。合計＝期間の合計、平均＝1日あたり。
 * 率（CTR・CVR・CPA など）は期間の合計から出す（日ごとの率を平均すると、少ない日が重く効いて狂う）。
 */
export function summarizeDaily(
  daily: readonly ReportDailyRow[],
  key: 'ad_cost' | 'pv' | 'click' | 'ctr' | 'cv' | 'cvr' | 'cpa' | 'ctvr' | 'mcpa',
  aggregation: Aggregation,
): number | null {
  if (daily.length === 0) return null
  const sum = (pick: (d: ReportDailyRow) => number): number => daily.reduce((total, d) => total + pick(d), 0)
  const isCostKnown = daily.every((d) => d.cost_known !== false)
  const totals = { pv: sum((d) => d.pv), click: sum((d) => d.click), cv: sum((d) => d.cv), ad_cost: sum((d) => d.ad_cost) }
  switch (key) {
    case 'ctr':
      return ratio(totals.click, totals.pv)
    case 'cvr':
      return ratio(totals.cv, totals.click)
    case 'ctvr':
      return ratio(totals.cv, totals.pv)
    case 'cpa':
      return isCostKnown ? ratio(totals.ad_cost, totals.cv) : null
    case 'mcpa':
      return isCostKnown ? ratio(totals.ad_cost, totals.click) : null
    case 'ad_cost':
      if (!isCostKnown) return null
      return aggregation === '合計' ? totals.ad_cost : totals.ad_cost / daily.length
    default:
      return aggregation === '合計' ? totals[key] : totals[key] / daily.length
  }
}

/** 広告の行を1日あたりにする（回数と金額だけを日数で割る） */
export function perDayRow(row: ReportVersionRow, days: number): ReportVersionRow {
  if (days <= 1) return row
  const divided = Object.fromEntries(COUNT_KEYS.map((key) => [key, row[key] / days]))
  return { ...row, ...divided }
}

/** Parameter検索: 広告の名前（utm_source=fb など）に含まれる文字で絞る。大文字小文字は区別しない */
export function searchCreativeRows(rows: readonly ReportVersionRow[], query: string): ReportVersionRow[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return [...rows]
  return rows.filter((row) => row.name.toLowerCase().includes(needle))
}
