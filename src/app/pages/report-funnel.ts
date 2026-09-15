/**
 * レポートの「ファネル」節の中身（2026-09-15・実物の採取に合わせて追加）。
 *
 * 採取物: capture/clean/ab_tests__UID__reports/report-settings-modal の `_reportWrapper_1rrna_96`。
 * 見出し「ファネル」＋日付select＋期間、タブ「詳細」「比較」、
 * 本体は3列（経路 / PV数割合 / ファネル分析）＋まとめ（PV / CV / CVR）。
 *
 * ⚠️ 採取時、実物の一覧は**空**だった（その口座にファネルのステップが無かった）ので、
 * 行1本ぶんのマークアップは採れていない。
 * このシステムはまだ「ステップ」（複数ページのファネル）を持っていないので、
 * 実測で持っている **表示 → クリック → 成果** の1本を段として出す。
 * ステップを持ったら、ここの段をステップに差し替える。
 */
import type { ReportKpi } from '../api.ts'

/** 採取した日付selectの中身そのまま（レポート上部と違い「7日間」が無い） */
export const FUNNEL_DATE_PRESETS: readonly { value: string; label: string }[] = [
  { value: '', label: '日付' },
  { value: 'today', label: '今日' },
  { value: 'yesterday', label: '昨日' },
  { value: 'last_three_days', label: '過去3日間' },
  { value: 'last_seven_days', label: '過去7日間' },
]

export interface FunnelStage {
  name: string
  count: number
  /** 最初の段（表示）を1とした割合。表示が0なら null */
  share: number | null
  /** 次の段へ進まなかったぶんの割合。最後の段は0。表示が0なら null */
  exitShare: number | null
}

/**
 * 実測から段を作る。
 *
 * 「離脱」は**次の段へ進まなかったぶん**。クリックより成果が多いこと（別ドメインの
 * サンクスページでクリックを取りこぼす＝SB本体でも起きる）があるので、負にならないよう0で止める。
 */
export function funnelStages(kpi: ReportKpi): FunnelStage[] {
  const counts: readonly { name: string; count: number }[] = [
    { name: '表示', count: kpi.pv },
    { name: 'クリック', count: kpi.click },
    { name: '成果', count: kpi.cv },
  ]
  const base = kpi.pv
  return counts.map((stage, index) => {
    const next = counts[index + 1]
    const dropped = next === undefined ? 0 : Math.max(0, stage.count - next.count)
    return {
      name: stage.name,
      count: stage.count,
      share: base === 0 ? null : stage.count / base,
      exitShare: base === 0 ? null : dropped / base,
    }
  })
}
