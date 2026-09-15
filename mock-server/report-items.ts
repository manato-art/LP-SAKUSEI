/**
 * 定期レポートに何を載せるか（2026-09-15・本人の依頼）。
 *
 * タスクごとに持つ。朝は全部・夕方は数字だけ、のような使い分けができる。
 * 既存のタスクにはこのキーが無いので、読むときは必ず `normalizeReportItems()` を通す
 * （保存データの移行は最上位のキーしか見ない。tests/persistence-nested-settings を参照）。
 */
export interface ReportItems {
  /** 主要数値（PV / CLICK / CTR / CV / CVR） */
  basics: boolean
  /** 総合スコア（report-score.ts） */
  score: boolean
  /** ページの下にVersionの内訳 */
  versions: boolean
  /** ヒートマップの要点（FV通過・いちばん離脱が多い位置・オファー到達） */
  heatmap: boolean
  /** 前の同じ長さの期間との比較 */
  compare: boolean
  /** 広告費とCPA */
  cost: boolean
}

export const DEFAULT_REPORT_ITEMS: ReportItems = {
  basics: true,
  score: true,
  versions: true,
  heatmap: true,
  compare: true,
  cost: true,
}

const KEYS = Object.keys(DEFAULT_REPORT_ITEMS) as (keyof ReportItems)[]

/** 受け取った値を整える。知らないキーは捨て、足りないキーは既定で埋める。 */
export function normalizeReportItems(raw: unknown): ReportItems {
  if (raw === null || typeof raw !== 'object') return { ...DEFAULT_REPORT_ITEMS }
  const source = raw as Record<string, unknown>
  const out = { ...DEFAULT_REPORT_ITEMS }
  for (const key of KEYS) {
    if (typeof source[key] === 'boolean') out[key] = source[key]
  }
  return out
}
