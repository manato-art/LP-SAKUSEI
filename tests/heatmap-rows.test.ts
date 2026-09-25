/**
 * ヒートマップの21本の線（0%,5%,…,100%）に出す数字（2026-09-25・数値面分析テスト）。
 *
 * 記録はページを100に割ったバンドで持っている。以前は線の位置にある**1バンド（1%幅）だけ**を読んでいたので、
 * 離脱とクリックは線と線の間（例: 12〜14%）で起きたぶんがどの線にも出ず、「1%未満離脱」になっていた
 * （ロボットで確かめると、スマホ15人の離脱のうち線に出たのは8人だけ・クリックは17回のうち5回だけ）。
 * 離脱とクリックは「いちばん近い線」にまとめて数える（全部の線を足すと全員・全クリックになる）。
 * 到達は「その深さまで見た人」なので、線の位置のバンドを読むのが正しい（変えない）。
 */
import { describe, expect, it } from 'vitest'
import { rowValue, ROW_COUNT } from '../src/app/pages/heatmap-rows.ts'
import type { HeatmapVersionStat } from '../src/app/api.ts'

function stat(partial: Partial<HeatmapVersionStat>): HeatmapVersionStat {
  const zeros = new Array<number>(100).fill(0)
  return {
    version_uid: 'V1',
    version_name: 'Ver.A',
    param: '',
    bands: 100,
    pv: 10,
    legacy_pv: 0,
    arrival: zeros.map((_, i) => (i < 50 ? 1 : 0.2)),
    exit: [...zeros],
    attention: [...zeros],
    elementClick: [...zeros],
    clicks: [],
    ...partial,
  }
}

describe('線に出す数字', () => {
  it('離脱は、いちばん近い線にまとめて数える（全部の線を足すと離脱した全員）', () => {
    const exit = new Array<number>(100).fill(0)
    exit[1] = 0.1 // 1〜2% → 0%の線
    exit[16] = 0.2 // 16〜17% → 15%の線
    exit[23] = 0.1 // 23〜24% → 25%の線
    exit[99] = 0.1 // 99〜100% → 100%の線
    const s = stat({ exit })
    const labels = Array.from({ length: ROW_COUNT }, (_, row) => rowValue(s, 'exit', row)?.label)
    expect(labels[0]).toBe('1人 10%離脱')
    expect(labels[3]).toBe('2人 20%離脱')
    expect(labels[5]).toBe('1人 10%離脱')
    expect(labels[20]).toBe('1人 10%離脱')
    expect(labels[1]).toBe('1%未満離脱')
    const people = labels.reduce((sum, l) => sum + Number(/^(\d+)人/.exec(l ?? '')?.[1] ?? 0), 0)
    expect(people).toBe(5)
  })

  it('クリック数も、いちばん近い線にまとめて数える', () => {
    const elementClick = new Array<number>(100).fill(0)
    elementClick[16] = 2
    elementClick[15] = 1
    elementClick[50] = 1
    const s = stat({ elementClick })
    expect(rowValue(s, 'elementClick', 3)?.label).toBe('3クリック')
    expect(rowValue(s, 'elementClick', 10)?.label).toBe('1クリック')
    expect(rowValue(s, 'elementClick', 4)?.label).toBe('0クリック')
    // 線の長さはいちばん多い線を1として比べる
    expect(rowValue(s, 'elementClick', 3)?.strength).toBe(1)
  })

  it('到達は線の深さのバンドを読む（その深さまで見た人の割合）', () => {
    const s = stat({})
    expect(rowValue(s, 'arrival', 9)?.label).toBe('10人 100%到達') // 45%
    expect(rowValue(s, 'arrival', 10)?.label).toBe('2人 20%到達') // 50%
  })

  it('ライン非表示なら何も出さない', () => {
    expect(rowValue(stat({}), 'none', 3)).toBeNull()
  })
})
