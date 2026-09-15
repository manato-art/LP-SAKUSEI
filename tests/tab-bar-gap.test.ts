/**
 * 上部タブバーの上の隙間（2026-09-15・本人指摘
 * 「レポート／切り替え／中間ページで上に隙間がある」）。
 *
 * タブバーを差し込むときに navArticleWrapper へ padding-top:8px を**インラインで**当てていた。
 * エディタ系の画面だけは別のCSSが `padding-top:0 !important` で打ち消していたので、
 * その3画面にだけ8pxの隙間が残り、画面によって上端の位置が違っていた。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('タブバーの上端', () => {
  const src = readFileSync('src/app/pages/tab-nav.ts', 'utf8')

  it('タブバーの上に隙間を作らない（全画面で同じ位置から始める）', () => {
    expect(src).not.toContain("navWrapper.style.paddingTop = '8px'")
    expect(src).toContain("navWrapper.style.paddingTop = '0'")
  })

  it('採取CSSの固定の高さは外したままにする（タブバーぶんが見切れるため）', () => {
    expect(src).toContain("navWrapper.style.height = 'auto'")
  })

  it('エディタ側の打ち消しと矛盾しない（どちらも0）', () => {
    for (const path of ['src/app/pages/editor-styles.ts', 'src/app/styles/mockup-master.ts']) {
      const style = readFileSync(path, 'utf8')
      expect(style, path).toContain('padding-top: 0 !important')
    }
  })
})
