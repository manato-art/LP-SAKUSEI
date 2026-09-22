/**
 * LPの編集画面（キャンバス）でのWidgetの見え方（2026-09-22・本人の依頼）。
 *
 * 本人の依頼「赤丸で囲った文字（MuiBox-root）いらない」「LPに乗っけた時、ボックスの幅が広くなってしまっている」。
 *  - Widgetにマウスを乗せたときの名前のラベルは出さない（青い枠だけ）
 *  - 編集画面の本文は Quill の white-space:pre-wrap なので、Widgetの中まで HTML の改行・字下げが
 *    空の行として残り、枠が大きくなっていた（矢印のWidgetで 配信37px → 編集画面139px。2026-09-22 実測）。
 *    配信（.ql-editor の外）と同じく、Widgetの中は改行・字下げを詰める
 */
import { describe, expect, it } from 'vitest'
import { widgetSelectionCss } from '../src/app/panels/widget-canvas-css.ts'

const css = widgetSelectionCss('var(--sb-accent, #0091FF)')

describe('編集画面のWidget', () => {
  it('マウスを乗せても名前のラベルは出さない', () => {
    expect(css).not.toContain('attr(data-widget-name)')
    expect(css).not.toMatch(/sb-widget-block:hover::after/)
  })

  it('マウスを乗せたとき・選んだときの青い枠は今までどおり', () => {
    expect(css).toMatch(/section\.sb-widget-block:hover\s*\{[^}]*outline:2px solid var\(--sb-accent, #0091FF\)/)
    expect(css).toMatch(/section\.sb-widget-block\[data-widget-selected="true"\]\s*\{[^}]*outline:2px solid/)
  })

  it('Widgetの中は、配信と同じく HTML の改行・字下げを詰める（枠が縦・横に広がらない）', () => {
    expect(css).toMatch(/\.ql-editor section\.sb-widget-block\s*\{[^}]*white-space:normal/)
  })

  it('行間の既定（1.5）は今までどおり', () => {
    expect(css).toMatch(/\.ql-editor section\.sb-widget-block\s*\{[^}]*line-height:1\.5/)
  })
})

describe('中身がスクリプトで出るWidget', () => {
  it('編集画面では高さ0にならない（押して編集を開けるよう、最低の高さを持たせる）', () => {
    // 例: 画面切り替えアンケートの見本は、スクリプトが動くまで中身が全部 display:none（配信でも0px）
    expect(css).toMatch(/\.ql-editor section\.sb-widget-block\s*\{[^}]*min-height:32px/)
  })
})
