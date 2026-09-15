/**
 * ヒートマップの広告パラメータ（2026-09-15・実物の採取に合わせて追加）。
 *
 * 実物の左のVersion一覧は、そのVersionに実際に来た `utm_*` を
 * チェックボックスで並べ（`_paramsOption_`）、末尾に「元に戻す」（`_viewMore_`）を置く。
 * 何も選んでいないカードには「全パラメータ合算」（`_noParam_`）と出る。
 * 採取物: capture/clean/ab_tests__UID__reports__lp/heatmap-params-expanded/dom.html
 *
 * チェックを入れると、そのVersionの列は**広告ごと**に分かれる。
 * カードの「全パラメータ合算」は、そのカードが何を合算しているかを名乗る場所なので、
 * 広告を選べばそこが広告名に変わる、という読み方をしている。
 */
import type { HeatmapParameter } from '../api.ts'
import type { HeatmapMetric } from './heatmap-columns.ts'

/** カードが「何を合算しているか」を名乗る文字（採取物の `_noParam_`） */
export const ALL_PARAMS_LABEL = '全パラメータ合算'

/** そのVersionに来た広告パラメータ（PVの多い順はサーバーが並べてある） */
export function paramsForVersion(
  parameters: readonly HeatmapParameter[],
  versionUid: string,
): readonly HeatmapParameter[] {
  return parameters.filter((p) => p.version_uid === versionUid)
}

/** 列1本の素性。`param` が空なら全パラメータ合算。 */
export interface ColumnKey {
  versionUid: string
  metric: HeatmapMetric
  param: string
}

/** 列1本を指す鍵（`versionUid|metric|param`）。複製の回数もこれで数える。 */
export function columnKeyOf(key: ColumnKey): string {
  return `${key.versionUid}|${key.metric}|${key.param}`
}

/**
 * 「Version×指標」のチェックと「Version×広告パラメータ」のチェックから、並べる列を決める。
 *
 * 広告パラメータを選んでいないVersionは合算の列を1本。
 * 選んでいるVersionは、選んだ広告の数だけ列が増える（合算は出さない＝実物の「元に戻す」で戻せる）。
 *
 * @param duplicates 「複製」を押した回数（列の鍵 → 回数）。押した数だけ同じ列が続く。
 */
export function expandColumnKeys(
  selection: ReadonlySet<string>,
  paramSelection: ReadonlySet<string>,
  duplicates: ReadonlyMap<string, number> = new Map(),
): ColumnKey[] {
  const out: ColumnKey[] = []
  const push = (key: ColumnKey): void => {
    const copies = 1 + Math.max(0, duplicates.get(columnKeyOf(key)) ?? 0)
    for (let i = 0; i < copies; i += 1) out.push({ ...key })
  }
  for (const key of selection) {
    const [versionUid = '', metric = 'exit'] = key.split('|') as [string, HeatmapMetric]
    const params = [...paramSelection]
      .filter((p) => p.startsWith(`${versionUid}|`))
      .map((p) => p.slice(versionUid.length + 1))
    if (params.length === 0) {
      push({ versionUid, metric, param: '' })
      continue
    }
    for (const param of params) push({ versionUid, metric, param })
  }
  return out
}
