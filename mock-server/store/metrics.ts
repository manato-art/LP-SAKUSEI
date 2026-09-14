/**
 * KPI恒等式（企画書 §10-5）と日次メトリクスの決定論生成。
 *
 * - 一次生成（LP側・実測）: pv / click / cv
 * - 一次生成（媒体側・取り込み）: ad_cost / imp / media_click / media_cv / sales
 * - 派生は必ず恒等式で算出（保存しない）:
 *     sales = cv × 平均単価（未取得時のみ） / gross_profit = sales - ad_cost
 *     roas = sales / ad_cost / roi = gross_profit / ad_cost
 *     cvr = cv / click / cpa = ad_cost / cv
 *     ctr = click / pv / ctvr = cv / pv
 *     media_ctr = media_click / imp / mcpa = ad_cost / click
 * - ゼロ除算は null（UI側で「-」表示・§10-5）
 *
 * 【定義の出所】採取した実DOMの列見出しは `aria-label` に**計算式そのもの**を持っている
 * （`src/app/fragments/ab_tests__UID__reports__default.html`）:
 *     「コンバージョン率 = CV / CLICK」「CV / PV」（＝CTVR）
 *     「クリックあたりの費用 = 配信金額 / CLICK」（＝MCPA・2026-09-15に確認して修正）
 * ctr（「クリック率」）と media_ctr は式が書かれていないので、広告運用の標準的な解釈
 * （click / pv、media_click / imp）のまま。実物とズレていたらここを直せば全画面に反映される。
 */
import { jstNow } from '../lib/jst.ts'
import type { DailyMetric } from './types.ts'

/** CV1件あたりの平均単価（売上が取得できていないときのフォールバック・円） */
export const AVERAGE_UNIT_PRICE = 8000

export interface DerivedKpi {
  pv: number
  click: number
  cv: number
  ad_cost: number
  /** 媒体の表示回数（インプレッション） */
  imp: number
  /** 媒体が計測したクリック */
  media_click: number
  /** 媒体が計測したCV */
  media_cv: number
  sales: number
  gross_profit: number
  roas: number | null
  roi: number | null
  cvr: number | null
  cpa: number | null
  /** クリック率（LP内リンク） = click / pv */
  ctr: number | null
  /** PV基準のCV率 = cv / pv */
  ctvr: number | null
  /** 媒体のクリック率 = media_click / imp */
  media_ctr: number | null
  /** クリックあたりの費用 = ad_cost / click（採取物の列見出しの記述どおり） */
  mcpa: number | null
  /** スクロールを記録できた表示数（FVER/SVER/FSVER/OAR の母数） */
  hm_pv: number
  /** 最初の画面で離脱した数 */
  fv_exit: number
  /** 2画面目で離脱した数 */
  sv_exit: number
  /** 最初の計測リンクまで到達した数（リンクが無いLPでは null） */
  offer_reach: number | null
  /** ファーストビュー離脱率 = 最初の画面で離脱した数 / スクロールを記録できた表示数 */
  fver: number | null
  /** セカンドビュー離脱率 */
  sver: number | null
  /** ファーストビュー＆セカンドビュー離脱率 */
  fsver: number | null
  /** オファー到達率（最初の計測リンクの位置まで到達した率） */
  oar: number | null
}

/** 一次値（保存する値）。媒体側は未取得なら0。 */
export interface PrimaryKpi {
  pv: number
  click: number
  cv: number
  ad_cost: number
  imp?: number
  media_click?: number
  media_cv?: number
  sales?: number
  /**
   * 計測タグのスクロール記録（ヒートマップ）から来る一次値。
   * FVER / SVER / FSVER / OAR の材料で、母数は「スクロールを記録できた表示数」。
   * レポートのPVとは母数が違う（記録が届く前に閉じた表示は入らない）ので別に持つ。
   */
  hm_pv?: number
  /** 最初の画面（ファーストビュー）の中で離脱した数 */
  fv_exit?: number
  /** 2画面目の中で離脱した数 */
  sv_exit?: number
  /** 最初の計測リンクの位置まで到達した数（リンクが無いLPでは undefined） */
  offer_reach?: number
}

function divide(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null
  return numerator / denominator
}

/** 一次値から派生KPIを恒等式で算出する。唯一の算出経路（DRY） */
export function deriveKpi(primary: PrimaryKpi): DerivedKpi {
  const sales = primary.sales ?? primary.cv * AVERAGE_UNIT_PRICE
  const grossProfit = sales - primary.ad_cost
  const imp = primary.imp ?? 0
  const mediaClick = primary.media_click ?? 0
  const mediaCv = primary.media_cv ?? 0
  const hmPv = primary.hm_pv ?? 0
  return {
    pv: primary.pv,
    click: primary.click,
    cv: primary.cv,
    ad_cost: primary.ad_cost,
    imp,
    media_click: mediaClick,
    media_cv: mediaCv,
    sales,
    gross_profit: grossProfit,
    roas: divide(sales, primary.ad_cost),
    roi: divide(grossProfit, primary.ad_cost),
    cvr: divide(primary.cv, primary.click),
    cpa: divide(primary.ad_cost, primary.cv),
    ctr: divide(primary.click, primary.pv),
    ctvr: divide(primary.cv, primary.pv),
    media_ctr: divide(mediaClick, imp),
    // 「クリックあたりの費用 = 配信金額 / CLICK」（採取物の列見出しの記述どおり）
    mcpa: divide(primary.ad_cost, primary.click),
    hm_pv: hmPv,
    fv_exit: primary.fv_exit ?? 0,
    sv_exit: primary.sv_exit ?? 0,
    offer_reach: primary.offer_reach ?? null,
    // 実測のスクロール記録から出す4指標。記録がまだ無ければ null＝UIは「-」
    fver: hmPv === 0 ? null : divide(primary.fv_exit ?? 0, hmPv),
    sver: hmPv === 0 ? null : divide(primary.sv_exit ?? 0, hmPv),
    fsver: hmPv === 0 ? null : divide((primary.fv_exit ?? 0) + (primary.sv_exit ?? 0), hmPv),
    oar:
      hmPv === 0 || primary.offer_reach === undefined
        ? null
        : divide(primary.offer_reach, hmPv),
  }
}

export const ZERO_KPI: DerivedKpi = deriveKpi({ pv: 0, click: 0, cv: 0, ad_cost: 0 })

/**
 * 合計行（企画書 §10-5「合計行は各列合算。roas/roi/cvr/cpaは合算後に再計算」）
 * 比率は合算後に再計算する（比率の平均を取らない）。
 */
/** 合計を積むための入れ物（省略可の項目を必須にして、undefined を持ち回らない） */
type SumAccumulator = Required<Omit<PrimaryKpi, 'offer_reach'>> & { offer_reach: number | null }

export function sumKpi(rows: readonly DerivedKpi[]): DerivedKpi {
  const totals = rows.reduce<SumAccumulator>(
    (acc, row) => ({
      pv: acc.pv + row.pv,
      click: acc.click + row.click,
      cv: acc.cv + row.cv,
      ad_cost: acc.ad_cost + row.ad_cost,
      imp: acc.imp + row.imp,
      media_click: acc.media_click + row.media_click,
      media_cv: acc.media_cv + row.media_cv,
      sales: acc.sales + row.sales,
      // スクロール記録の一次値も足す（比率はこのあと deriveKpi で出し直す）
      hm_pv: acc.hm_pv + row.hm_pv,
      fv_exit: acc.fv_exit + row.fv_exit,
      sv_exit: acc.sv_exit + row.sv_exit,
      offer_reach:
        row.offer_reach === null ? acc.offer_reach : (acc.offer_reach ?? 0) + row.offer_reach,
    }),
    {
      pv: 0,
      click: 0,
      cv: 0,
      ad_cost: 0,
      imp: 0,
      media_click: 0,
      media_cv: 0,
      sales: 0,
      hm_pv: 0,
      fv_exit: 0,
      sv_exit: 0,
      offer_reach: null,
    },
  )
  return deriveKpi({
    ...totals,
    // 「リンクが無い」は null で表し、deriveKpi には undefined で渡す（= OAR は「-」）
    offer_reach: totals.offer_reach ?? undefined,
  })
}

/** 日次メトリクス配列を1つのKPIへ畳む */
export function aggregate(metrics: readonly DailyMetric[]): DerivedKpi {
  return sumKpi(metrics.map((m) => deriveKpi(m)))
}

/**
 * 日次メトリクスの一次値だけを足す（派生は出さない）。
 * スクロールの記録など、別の場所から来る一次値と合わせてから
 * 1回だけ `deriveKpi` に通したいときに使う（比率を二度計算しないため）。
 */
export function sumPrimary(metrics: readonly DailyMetric[]): PrimaryKpi {
  const total = (pick: (m: DailyMetric) => number | undefined): number =>
    metrics.reduce((sum, m) => sum + (pick(m) ?? 0), 0)
  return {
    pv: total((m) => m.pv),
    click: total((m) => m.click),
    cv: total((m) => m.cv),
    ad_cost: total((m) => m.ad_cost),
    imp: total((m) => m.imp),
    media_click: total((m) => m.media_click),
    media_cv: total((m) => m.media_cv),
    sales: total((m) => m.sales),
  }
}

/** YYYY-MM-DD */
export function toDateKey(date: Date): string {
  // 本番(Railway)のTZはUTC。`date.getFullYear()` 等のローカルgetterで組み立てると、
  // 日本の朝（00:00〜09:00 JST）が前日として記録される。
  // 画面はブラウザのローカル時刻＝JSTで「今日」を問い合わせるので、
  // そのままだと朝のアクセスがレポートから消えて前日に混ざる。
  // 判定は lib/jst.ts に一本化してある（定期実行のスケジュール判定と同じ基準）。
  return jstNow(date).date
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

/** [start,end] の日付キー列（両端含む） */
export function dateRange(start: string, end: string): string[] {
  const out: string[] = []
  const endDate = parseDateKey(end)
  const cursor = parseDateKey(start)
  while (cursor.getTime() <= endDate.getTime()) {
    out.push(toDateKey(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

export function isWithin(date: string, start: string, end: string): boolean {
  return date >= start && date <= end
}
