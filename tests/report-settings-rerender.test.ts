/**
 * レポート設定を変えて閉じたら描き直す・ヒートマップの「アーカイブ有り」（2026-09-24 点検19）。
 * 画面の配線はブラウザが要るので、形で固定する。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('レポート設定を閉じたら描き直す', () => {
  const modal = readFileSync('src/app/panels/report-settings-modal.ts', 'utf8')
  const report = readFileSync('src/app/pages/report.ts', 'utf8')
  const heatmap = readFileSync('src/app/pages/heatmap.ts', 'utf8')

  it('変えて閉じたら、送り終わってから呼び出し元に知らせる', () => {
    expect(modal).toContain('onChangedClose?: () => void')
    expect(modal).toContain('Promise.allSettled(pending).then(() => onChangedClose())')
  })

  it('レポートとヒートマップは、閉じたら描き直す', () => {
    expect(report).toContain('void renderReport(container, abTestUid, params, generation)')
    expect(heatmap).toContain('void renderHeatmap(container, abTestUid, generation, range)')
  })

  it('ヒートマップはアーカイブ済みの行も受け取ってから、画面で絞る', () => {
    expect(heatmap).toContain('&archive=all`)')
  })
})
