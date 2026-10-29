/**
 * 見る人が増えるほど増える記録（数字・ヒートマップ・見た人の記録など）を、データベースへ1件ずつしまうための決まり
 * （2026-10-29 本人「OK進めて」＝数字を1冊のノートでなく1件ずつ分けてしまう）。
 *
 * これまでは全部を state.json 1つに書き、何か変わるたびに丸ごと書き直していた（大きくなると重くなり、最後は書けない）。
 * ここでは記録ごとに「目印（key）」を決め、前に書いた内容と比べて、変わった記録と消えた記録だけを返す（diffMeasurements）。
 * 書く・読むのは measure-db.ts、いつ書くかは persistence.ts。
 *
 * 目印は、同じ記録を同じ値で指すもの（本番のデータで重ならないことを確かめた・2026-10-29）。
 * ヒートマップは分割数（bands）も目印に入れる（分割数を変えた日は、同じ日に20分割と100分割の2行がある）。
 *
 * 並び順も元に戻せるようにする（データベースは入れた順の番号 seq を持つ）:
 *   - append  … 新しい記録は後ろに足す（ほとんど）
 *   - prepend … 新しい記録は前に足す（申し込み conversions＝新しい順）。入れるときは後ろから入れ、読むときは逆に並べる
 *   - by-date … 日付の順、同じ日の中は入れた順（アクセスの記録 requestLogs。古い日の記録を削ると番号が付け直される）
 */
import type { State } from './types.ts'

/** データベースへしまう記録の種類（state のキー） */
export const MEASURE_KEYS = [
  'metrics',
  'deviceMetrics',
  'heatmapStats',
  'deviceHeatmapStats',
  'cvHeatmapStats',
  'pendingCvHeatmaps',
  'visitorTouches',
  'requestLogs',
  'conversions',
  'pageSpeedStats',
  'botHits',
] as const satisfies readonly (keyof State)[]

export type MeasureKey = (typeof MEASURE_KEYS)[number]

export type MeasureOrder = 'append' | 'prepend' | 'by-date'

type AnyRow = Record<string, unknown>

interface MeasureCollection {
  /** 記録の目印。requestLogs だけは並び（同じ日の何件目か）から作るので、全体を受け取る */
  keysOf: (rows: readonly AnyRow[]) => string[]
  order: MeasureOrder
}

const s = (v: unknown): string => (v === undefined || v === null ? '' : String(v))
const each = (key: (r: AnyRow) => string) => (rows: readonly AnyRow[]) => rows.map(key)
const heatmapKey = (r: AnyRow): string => `${s(r['ab_test_uid'])}|${s(r['version_uid'])}|${s(r['date'])}|${s(r['param'])}|${s(r['bands'])}`

/** アクセスの記録は目印になる値が無い（同じ人が同じ日に何度も来る）ので「日付|その日の何件目か」にする */
function requestLogKeys(rows: readonly AnyRow[]): string[] {
  const countByDate = new Map<string, number>()
  return rows.map((r) => {
    const date = s(r['date'])
    const n = countByDate.get(date) ?? 0
    countByDate.set(date, n + 1)
    return `${date}|${String(n)}`
  })
}

export const MEASURE_COLLECTIONS: Readonly<Record<MeasureKey, MeasureCollection>> = {
  metrics: { keysOf: each((r) => `${s(r['scope'])}|${s(r['entity_uid'])}|${s(r['date'])}`), order: 'append' },
  deviceMetrics: {
    keysOf: each((r) => `${s(r['scope'])}|${s(r['entity_uid'])}|${s(r['date'])}|${s(r['device'])}`),
    order: 'append',
  },
  heatmapStats: { keysOf: each(heatmapKey), order: 'append' },
  deviceHeatmapStats: { keysOf: each((r) => `${heatmapKey(r)}|${s(r['device'])}`), order: 'append' },
  cvHeatmapStats: { keysOf: each((r) => `${heatmapKey(r)}|${s(r['device'])}`), order: 'append' },
  pendingCvHeatmaps: {
    keysOf: each((r) => `${s(r['vid'])}|${s(r['ab_test_uid'])}|${s(r['version_uid'])}|${s(r['at'])}`),
    order: 'append',
  },
  visitorTouches: { keysOf: each((r) => `${s(r['vid'])}|${s(r['ab_test_uid'])}`), order: 'append' },
  requestLogs: { keysOf: requestLogKeys, order: 'by-date' },
  conversions: { keysOf: each((r) => s(r['uid'])), order: 'prepend' },
  pageSpeedStats: { keysOf: each((r) => `${s(r['ab_test_uid'])}|${s(r['version_uid'])}|${s(r['date'])}`), order: 'append' },
  botHits: { keysOf: each((r) => `${s(r['ab_test_uid'])}|${s(r['date'])}`), order: 'append' },
}

export interface MeasureChange {
  collection: MeasureKey
  /** 足す・書き直す記録（入れる順に並べてある＝prepend は後ろから） */
  upserts: { key: string; row: AnyRow }[]
  /** 消えた記録の目印 */
  deletes: string[]
}

/**
 * 前に書いた state と今の state を比べ、変わった記録・消えた記録だけを返す。
 * 前が null なら（はじめて書く）全部を足す記録として返す。
 * 同じ記録かどうかは「同じ入れ物（オブジェクト）か」と「目印が同じか」で見る（state は書き換えずに作り直すので、
 * 変わった記録は別の入れ物になっている）。
 */
export function diffMeasurements(prev: State | null, next: State): MeasureChange[] {
  const out: MeasureChange[] = []
  for (const collection of MEASURE_KEYS) {
    // 記録の種類ごとに形は違うが、ここでは目印を作って比べるだけなので、どれも「名前付きの値の集まり」として扱う
    const before = (prev?.[collection] ?? []) as unknown as readonly AnyRow[]
    const after = (next[collection] ?? []) as unknown as readonly AnyRow[]
    if (prev !== null && before === after) continue
    const { keysOf, order } = MEASURE_COLLECTIONS[collection]
    const beforeKeys = keysOf(before)
    const keyByRow = new Map<AnyRow, string>(before.map((row, i) => [row, beforeKeys[i] as string]))
    const afterKeys = keysOf(after)
    const upserts = after
      .map((row, i) => ({ key: afterKeys[i] as string, row }))
      .filter(({ key, row }) => keyByRow.get(row) !== key)
    const kept = new Set(afterKeys)
    const deletes = [...new Set(beforeKeys)].filter((key) => !kept.has(key))
    if (upserts.length === 0 && deletes.length === 0) continue
    out.push({ collection, upserts: order === 'prepend' ? upserts.reverse() : upserts, deletes })
  }
  return out
}

/** データベースが正になったあと、state.json に書かない形（数字の記録を抜く） */
export function withoutMeasurements(state: State): Partial<State> {
  const copy: Partial<State> = { ...state }
  for (const key of MEASURE_KEYS) delete copy[key]
  return copy
}
