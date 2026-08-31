/**
 * レポート表の列定義と、セルの表示規則。
 *
 * 列は**採取した実ヘッダの並びそのまま**（`ab_tests__UID__reports__default.html`）。
 * 数値は `mock-server/store/metrics.ts` のKPI恒等式（企画書 §10-5）に従って出す。
 *
 * 【重要な食い違い】採取した表は13指標あるが、§10-5 の恒等式は
 * `CTR` `CTVR` `MCPA` `FVER` `SVER` `FSVER` `OAR` を**1つも定義していない**。
 * SquadBeyond独自指標で計算式が未確認のため、**ここでは定義を発明せず** `metric: null`
 * とし、常に「-」を表示する。定義が判明したら metrics.ts 側に恒等式を足して結線する。
 */
import type { ReportKpi } from '../api.ts'

/** 表示に使う書式。採取物は全セル `0` だったため、桁区切り・小数桁は推測（報告済み） */
export type CellFormat = 'integer' | 'yen' | 'percent'

/** metrics.ts（DerivedKpi）が実際に定義しているキーだけを許す */
export type KpiKey = 'ad_cost' | 'pv' | 'click' | 'cv' | 'cvr' | 'cpa'

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
  { label: 'CTR', unit: '%', metric: null, format: 'percent' },
  { label: 'CV', unit: '', metric: 'cv', format: 'integer' },
  { label: 'CVR', unit: '%', metric: 'cvr', format: 'percent' },
  { label: 'CTVR', unit: '%', metric: null, format: 'percent' },
  { label: 'CPA', unit: '円', metric: 'cpa', format: 'yen' },
  { label: 'MCPA', unit: '円', metric: null, format: 'yen' },
  { label: 'FVER', unit: '%', metric: null, format: 'percent' },
  { label: 'SVER', unit: '%', metric: null, format: 'percent' },
  { label: 'FSVER', unit: '%', metric: null, format: 'percent' },
  { label: 'OAR', unit: '%', metric: null, format: 'percent' },
]

/** 計算式が採取物にも企画書にも無い指標（＝常に「-」。報告対象） */
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
