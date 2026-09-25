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

/**
 * 広告パラメータの種類を、人が読める名前にする（2026-09-25・本人「utm_source=fb … がわかりずらい」）。
 * 画面には「流入元: fb」のように出し、生の `utm_source=fb` は title に残す。
 */
const AD_KEY_LABELS: Readonly<Record<string, string>> = {
  utm_source: '流入元',
  utm_medium: '媒体',
  utm_campaign: 'キャンペーン',
  utm_content: '広告',
  utm_term: 'キーワード',
  utm_id: 'キャンペーンID',
}
/** 種類の並び（ここに無いものは後ろに、来た順で） */
const AD_KEY_ORDER: readonly string[] = Object.keys(AD_KEY_LABELS)

export interface AdParamParts {
  /** `utm_source` */
  key: string
  /** `流入元`（知らない種類は `utm_` を外した名前） */
  label: string
  /** `fb` */
  value: string
}

/** `utm_source=fb` → 種類・名前・値（値に = があっても最初の = で分ける） */
export function describeAdParam(param: string): AdParamParts {
  const eq = param.indexOf('=')
  const key = eq === -1 ? param : param.slice(0, eq)
  const value = eq === -1 ? '' : param.slice(eq + 1)
  return { key, label: AD_KEY_LABELS[key] ?? key.replace(/^utm_/, ''), value }
}

/** 1行で書く形（列の見出しなど）: `流入元: fb` */
export function formatAdParam(param: string): string {
  const { label, value } = describeAdParam(param)
  return `${label}: ${value}`
}

export interface AdParamGroup {
  key: string
  label: string
  items: readonly { param: string; value: string; pv: number }[]
}

/** 種類ごとにまとめる。中の並びは受け取った順（サーバーが人数の多い順に並べている） */
export function groupAdParams(list: readonly HeatmapParameter[]): AdParamGroup[] {
  const groups = new Map<string, { key: string; label: string; items: { param: string; value: string; pv: number }[] }>()
  for (const entry of list) {
    const parts = describeAdParam(entry.param)
    const group = groups.get(parts.key) ?? { key: parts.key, label: parts.label, items: [] }
    group.items.push({ param: entry.param, value: parts.value, pv: entry.pv })
    groups.set(parts.key, group)
  }
  const rank = (key: string): number => {
    const i = AD_KEY_ORDER.indexOf(key)
    return i === -1 ? AD_KEY_ORDER.length : i
  }
  // 並びが同じ（どちらも知らない種類）なら来た順を保つ（sort は安定）
  return [...groups.values()].sort((a, b) => rank(a.key) - rank(b.key))
}
