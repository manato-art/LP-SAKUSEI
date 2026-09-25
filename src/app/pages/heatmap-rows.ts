/**
 * ヒートマップの21本の線（0%,5%,…,100%）と色の面に出す値（heatmap-columns.ts から分離・2026-09-25）。
 *
 * 記録はページを100に割ったバンドで持っている（計測タグ）。線は5%刻みの21本。
 *  - 到達率: その深さまで見た人の割合なので、線の深さのバンドを読む
 *  - 離脱率・クリック数: その場所で起きた数なので、**いちばん近い線にまとめて**数える。
 *    以前は線の深さの1バンド（1%幅）だけを読んでいて、線と線の間で起きた離脱・クリックがどの線にも出ず
 *    「1%未満離脱」になっていた（ロボットで確かめると、スマホ15人の離脱のうち線に出たのは8人だけ）。
 *    全部の線を足すと、離脱した全員・全クリックになる。
 *  - 滞在時間: 線の深さのバンドの平均（その場所の濃さ）
 */
import type { HeatmapVersionStat } from '../api.ts'

/** 線の本数（0%〜100%を5%刻み） */
export const ROW_COUNT = 21

/** ラインのモード（実物と同じ5つ・heatmap-columns.ts の選択肢） */
export type LineMode = 'none' | 'arrival' | 'exit' | 'attention' | 'elementClick'

export interface RowValue {
  /** 0〜1 の強さ（線の長さ・色の濃さ） */
  strength: number
  label: string
  /** 1%未満（数字でなく文言だけ出す） */
  isZero: boolean
}

/** 線 row（＝LPの深さ row*5%）の位置にあるバンドの添字 */
export function bandIndexOf(row: number, bands: number): number {
  return Math.min(bands - 1, Math.floor((row / (ROW_COUNT - 1)) * bands))
}

/** バンドの真ん中がいちばん近い線（同じ距離なら深い方） */
function rowOfBand(band: number, bands: number): number {
  return Math.round(((band + 0.5) / bands) * (ROW_COUNT - 1))
}

/** その線にいちばん近いバンドの値を足す */
function sumNearRow(values: readonly (number | null)[], row: number, bands: number): number {
  let sum = 0
  for (let i = 0; i < bands; i++) if (rowOfBand(i, bands) === row) sum += values[i] ?? 0
  return sum
}

function rateLabel(rate: number, pv: number, word: string): RowValue {
  // 実物は1%未満を数字でなく「1%未満到達」と出す（0人と書くと誤解を招くため）
  if (rate < 0.01) return { strength: rate, label: `1%未満${word}`, isZero: true }
  // 実物は割合だけでなく**人数**も出す（「25人 47%到達」）
  return { strength: rate, label: `${Math.round(rate * pv)}人 ${Math.round(rate * 100)}%${word}`, isZero: false }
}

/** 線 row に出す値。記録が無い（PV 0）ときは null＝線を出さない */
export function rowValue(stat: HeatmapVersionStat, mode: LineMode, row: number): RowValue | null {
  if (mode === 'none') return null
  const bands = stat.bands
  if (mode === 'arrival') {
    const v = stat.arrival[bandIndexOf(row, bands)]
    return v === null || v === undefined ? null : rateLabel(v, stat.pv, '到達')
  }
  if (mode === 'exit') {
    if (stat.exit.every((v) => v === null)) return null
    return rateLabel(sumNearRow(stat.exit, row, bands), stat.pv, '離脱')
  }
  if (mode === 'attention') {
    const ms = stat.attention[bandIndexOf(row, bands)] ?? 0
    const max = Math.max(1, ...stat.attention)
    return { strength: ms / max, label: `${(ms / 1000).toFixed(1)}秒`, isZero: false }
  }
  const n = sumNearRow(stat.elementClick, row, bands)
  let max = 1
  for (let r = 0; r < ROW_COUNT; r++) max = Math.max(max, sumNearRow(stat.elementClick, r, bands))
  return { strength: n / max, label: `${n}クリック`, isZero: false }
}

/**
 * 色の面に使う、バンドごとの値（面はバンドの細かさのまま連続的に出す）。
 * 記録が無いバンドは null（色を塗らない）。
 */
export function bandStrength(stat: HeatmapVersionStat, mode: LineMode, i: number): number | null {
  if (mode === 'none') return null
  if (mode === 'arrival' || mode === 'exit') {
    const v = (mode === 'arrival' ? stat.arrival : stat.exit)[i]
    return v === null || v === undefined ? null : v
  }
  if (mode === 'attention') {
    const max = Math.max(1, ...stat.attention)
    return (stat.attention[i] ?? 0) / max
  }
  const max = Math.max(1, ...stat.elementClick)
  return (stat.elementClick[i] ?? 0) / max
}
