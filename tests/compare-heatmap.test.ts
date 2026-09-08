import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * 比較モードの「ヒートマップ」タブ。
 * レポート画面と**同じ描画**を使うことが肝。別実装にすると、色や到達ラインの
 * 直しが片方だけに入って食い違う。
 */
describe('比較モードのヒートマップ', () => {
  const compare = readFileSync('src/app/panels/compare-mode.ts', 'utf8')
  const panel = readFileSync('src/app/panels/compare-heatmap.ts', 'utf8')

  it('「準備中」ではなく実際に描画する', () => {
    expect(compare).toContain('tabIndex === 1')
    expect(compare).toContain('renderCompareHeatmap(container')
  })

  it('レポート画面と同じ描画を使う（実装を二重に持たない）', () => {
    expect(panel).toContain("from '../pages/heatmap-columns.ts'")
    expect(panel).toContain('renderHeatmapColumns(')
  })

  it('ヒートマップ取得にページのUIDが要るので受け取る', () => {
    expect(compare).toContain('abTestUid: string')
    const editor = readFileSync('src/app/pages/editor.ts', 'utf8')
    expect(editor).toContain('abTestUid: ctx.abTestUid')
  })

  it('実LPが取れなくても止めない（自前配信・未計測では404が正常）', () => {
    expect(panel).toContain('api.externalPage(deps.abTestUid).catch(() => null)')
  })

  it('パネルを閉じた後に書き込まない', () => {
    expect(panel).toContain('if (!container.isConnected) return')
  })

  it('データが無いときは理由まで書く（記録は離脱時に送られる）', () => {
    expect(panel).toContain('ページを離れたときに1回だけ送られます')
  })
})
