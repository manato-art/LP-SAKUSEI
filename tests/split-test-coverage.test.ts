/**
 * Versionオプション設定の保存（2026-09-24 点検）。
 *
 *   - デバイス別・OS別・キャリア別のスイッチは保存の失敗を見ていなかった（失敗してもスイッチは切り替わったまま）
 *   - 時間別・日付別は保存しても何も知らせず、失敗も分からなかった
 *   - 1つ目のステップの Version しか出していなかった（2つ目以降のステップを設定できない）
 *   - どの Version も出せない端末ができる変更（例: 全部のVersionでデスクトップをオフ）は、
 *     その端末で開いた人に「配信できるVersionがありません」が出る → 変更の前に知らせて確かめる
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { newlyUncoveredVisitors, uncoveredVisitors } from '../src/app/pages/split-test-coverage.ts'

const v = (
  uid: string,
  ratio: number,
  devices: { sp: boolean; tablet: boolean; pc: boolean } = { sp: true, tablet: true, pc: true },
  extra: Record<string, unknown> = {},
) => ({ uid, distribution_ratio: ratio, archived: false, device_targets: devices, ...extra })

describe('どの Version も出せない端末', () => {
  it('配信割合がある Version が全端末に出るなら、無い', () => {
    expect(uncoveredVisitors([v('a', 100)])).toEqual([])
  })

  it('配信割合0%・アーカイブの Version は数えない（配信側と同じ決まり）', () => {
    expect(uncoveredVisitors([v('a', 0), { ...v('b', 100), archived: true }])).toHaveLength(5)
  })

  it('デスクトップを全部オフにすると、デスクトップが残る', () => {
    const labels = uncoveredVisitors([v('a', 50, { sp: true, tablet: true, pc: false }), v('b', 50, { sp: true, tablet: false, pc: false })])
    expect(labels).toEqual(['デスクトップ'])
  })

  it('OS別で iOS だけオンにした Version しか無いと、Android とデスクトップが残る', () => {
    const labels = uncoveredVisitors([v('a', 100, undefined, { os_targets: { ios: true, android: false } })])
    expect(labels).toEqual(['スマートフォン（Android）', 'タブレット（Android）', 'デスクトップ'])
  })

  it('変更で新しく出せなくなる端末だけを返す（前から出せない端末は言わない）', () => {
    const before = [v('a', 100, { sp: true, tablet: false, pc: true })]
    const after = [v('a', 100, { sp: true, tablet: false, pc: false })]
    expect(newlyUncoveredVisitors(before, after)).toEqual(['デスクトップ'])
  })
})

describe('画面の配線', () => {
  const settings = readFileSync('src/app/pages/split-test-settings.ts', 'utf8')
  const period = readFileSync('src/app/pages/split-test-period.ts', 'utf8')

  it('スイッチの保存は失敗を受けて、スイッチを元に戻す（then だけで終わらせない）', () => {
    expect(settings).not.toMatch(/void api\.(setDeviceTargets|setVersionTargeting)\([^)]*\)\.then\(\(\) =>/)
    expect(settings).toContain('revert')
  })

  it('時間別・日付別の保存は、保存できたか・失敗したかを知らせる', () => {
    expect(period).not.toMatch(/void api\.setVersionTargeting\([^)]*\)\n/)
    expect(period).toContain("toast(")
  })

  it('1つ目のステップに固定しない（ステップを選べる）', () => {
    expect(settings).not.toContain('articles[0]?.uid')
    expect(settings).toContain('stepChooser')
  })

  it('出せない端末ができる変更は、確認してから保存する', () => {
    expect(settings).toContain('newlyUncoveredVisitors(')
    expect(settings).toContain('配信できるVersionがありません')
    expect(settings).toContain('confirmCard(')
  })
})
