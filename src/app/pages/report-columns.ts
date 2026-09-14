/**
 * レポート表の列定義と、セルの表示規則。
 *
 * 列は**採取した実ヘッダの並びそのまま**（`ab_tests__UID__reports__default.html`）。
 * 数値は `mock-server/store/metrics.ts` のKPI恒等式（企画書 §10-5）に従って出す。
 *
 * 【重要な食い違い】採取した表は13指標あるが、§10-5 の恒等式は
 * 2026-09-15: 実物を見て全13指標を出せるようにした。
 *   CTR / CTVR / MCPA … 採取した列見出しの `aria-label` に計算式が書かれていた
 *   FVER / SVER / FSVER / OAR … 計測タグが送るスクロールの記録から算出
 *     （母数は「記録が届いた表示数」。記録が無ければ null ＝「-」）
 */
import type { ReportKpi } from '../api.ts'

/** 表示に使う書式。採取物は全セル `0` だったため、桁区切り・小数桁は推測（報告済み） */
export type CellFormat = 'integer' | 'yen' | 'percent'

/** metrics.ts（DerivedKpi）が実際に定義しているキーだけを許す */
export type KpiKey =
  | 'ad_cost'
  | 'pv'
  | 'click'
  | 'cv'
  | 'cvr'
  | 'cpa'
  | 'imp'
  | 'media_click'
  | 'media_cv'
  | 'ctr'
  | 'ctvr'
  | 'media_ctr'
  | 'mcpa'
  | 'roas'
  | 'fver'
  | 'sver'
  | 'fsver'
  | 'oar'

export interface ReportColumn {
  /** 採取ヘッダの表記（改名しない） */
  label: string
  /** 採取ヘッダの単位表記（空文字は単位なし） */
  unit: '' | '%' | '円'
  /** 対応する DerivedKpi のキー。恒等式に無い指標は null */
  metric: KpiKey | null
  format: CellFormat
}

/** デイリーレポート表の先頭列は指標ではない（合計行のラベル／日付） */
export const DAILY_LABEL_COLUMN = '合計'

/** ゼロ除算・未定義指標の表示（企画書 §10-5「ゼロ除算は - 表示」） */
export const EMPTY_CELL = '-'

/** 採取した13列（この順序と表記は実物と一致していること＝テストで機械保証） */
export const REPORT_COLUMNS: readonly ReportColumn[] = [
  { label: '配信金額', unit: '円', metric: 'ad_cost', format: 'yen' },
  { label: 'PV', unit: '', metric: 'pv', format: 'integer' },
  { label: 'CLICK', unit: '', metric: 'click', format: 'integer' },
  { label: 'CTR', unit: '%', metric: 'ctr', format: 'percent' },
  { label: 'CV', unit: '', metric: 'cv', format: 'integer' },
  { label: 'CVR', unit: '%', metric: 'cvr', format: 'percent' },
  { label: 'CTVR', unit: '%', metric: 'ctvr', format: 'percent' },
  { label: 'CPA', unit: '円', metric: 'cpa', format: 'yen' },
  { label: 'MCPA', unit: '円', metric: 'mcpa', format: 'yen' },
  { label: 'FVER', unit: '%', metric: 'fver', format: 'percent' },
  { label: 'SVER', unit: '%', metric: 'sver', format: 'percent' },
  { label: 'FSVER', unit: '%', metric: 'fsver', format: 'percent' },
  { label: 'OAR', unit: '%', metric: 'oar', format: 'percent' },
]

/**
 * 計算式が採取物にも企画書にも無い指標（＝常に「-」。報告対象）。
 *
 * 2026-09-15: CTR / CTVR / MCPA はここから外した。採取した実DOMの列見出しの
 * `aria-label` に式が書かれている（「CV / PV」＝CTVR、
 * 「クリックあたりの費用 = 配信金額 / CLICK」＝MCPA、「クリック率」＝CTR）。
 * 残る FVER / SVER / FSVER / OAR は、離脱・到達の一次値がモックに無いので未対応。
 */
export const UNDEFINED_METRIC_LABELS: readonly string[] = REPORT_COLUMNS.filter(
  (column) => column.metric === null,
).map((column) => column.label)

function readMetric(kpi: ReportKpi, key: KpiKey): number | null {
  switch (key) {
    case 'ad_cost':
      return kpi.ad_cost
    case 'pv':
      return kpi.pv
    case 'click':
      return kpi.click
    case 'cv':
      return kpi.cv
    case 'cvr':
      return kpi.cvr
    case 'cpa':
      return kpi.cpa
    case 'imp':
      return kpi.imp
    case 'media_click':
      return kpi.media_click
    case 'media_cv':
      return kpi.media_cv
    case 'ctr':
      return kpi.ctr
    case 'ctvr':
      return kpi.ctvr
    case 'media_ctr':
      return kpi.media_ctr
    case 'mcpa':
      return kpi.mcpa
    case 'roas':
      return kpi.roas
    case 'fver':
      return kpi.fver
    case 'sver':
      return kpi.sver
    case 'fsver':
      return kpi.fsver
    case 'oar':
      return kpi.oar
  }
}

function formatValue(value: number, format: CellFormat): string {
  if (format === 'percent') return (value * 100).toFixed(2)
  if (format === 'yen') return Math.round(value).toLocaleString('ja-JP')
  return Math.round(value).toLocaleString('ja-JP')
}

/**
 * 1セルの表示文字列。
 * 計算式が無い指標と、ゼロ除算で null になった指標は「-」（企画書 §10-5）。
 */
export function formatCell(kpi: ReportKpi, column: ReportColumn): string {
  if (column.metric === null) return EMPTY_CELL
  const value = readMetric(kpi, column.metric)
  if (value === null || !Number.isFinite(value)) return EMPTY_CELL
  return formatValue(value, column.format)
}
