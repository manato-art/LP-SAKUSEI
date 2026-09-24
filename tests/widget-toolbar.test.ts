/**
 * Widget編集の書式ツールバー（2026-09-24・本人が見せたデザインに合わせた）。
 * DOM を使わない環境なので、見た目の決まりはソースで固定する（mobile.test.ts と同じやり方）。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string): string => readFileSync(new URL(`../src/app/${path}`, import.meta.url), 'utf8')
const toolbarCss = read('panels/widget-toolbar-css.ts')
const visualSrc = read('panels/widget-visual-editor.ts')
const darkSrc = read('dark-runtime-css.ts')

describe('書式ツールバーの見た目', () => {
  it('角の丸い白い帯。元に戻す・やり直すは丸い灰色、文字の大きさは1つの枠', () => {
    expect(visualSrc).toContain("toolbar.className = 'wtb'")
    expect(visualSrc).toContain("exec('undo'), 'round')")
    expect(visualSrc).toContain("exec('redo'), 'round')")
    expect(visualSrc).toContain('mkSizeGroup(')
    expect(toolbarCss).toContain('border-radius:14px')
    expect(toolbarCss).toContain('.wtb__btn--round{border-radius:50%;background:#F3F4F6}')
  })

  it('幅が足りないと注意書きは区切り線を外して次の行へ（区切り線だけが行の頭に残らない）', () => {
    expect(toolbarCss).toContain('container:wtb/inline-size')
    expect(toolbarCss).toMatch(/@container wtb \(max-width:\$\{ONE_LINE_MIN_WIDTH\}px\)\{\.wtb__note\{flex-basis:100%;padding-left:0;border-left:none/)
  })

  it('「配置」は下向きの印つきで、押すと左・中央・右を選ぶ小窓', () => {
    expect(visualSrc).toContain('openAlignMenu(btn, options.alignTarget?.() ?? null')
    expect(visualSrc).not.toContain('onAlignButton')
  })

  it('ダークでも帯は白のまま（周りの見たまま画面・ヘッダーは白のままなので、帯だけ黒いと浮く）', () => {
    expect(toolbarCss).toContain("style.dataset['darkRuntime'] = 'skip'")
    expect(darkSrc).toContain("node.dataset['darkRuntime'] !== 'skip'")
  })
})
