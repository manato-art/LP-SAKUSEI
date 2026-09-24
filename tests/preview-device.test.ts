/**
 * Widget編集の「PC／スマホ」切り替え（2026-09-24・本人「続けて作って」。デザイン案のヘッダー中央）。
 * スマホは幅375pxで見せ、@media もその幅で判定する（スマホ用の指定が効いた見え方）。
 * 本人の「触らないもの」stripSbPreviewCss は変えない（幅を渡すだけ）。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LP_WIDTH, SP_WIDTH, mediaAtLpWidth } from '../src/app/panels/lp-width-media.ts'

const src = (path: string): string => readFileSync(new URL(`../src/app/${path}`, import.meta.url), 'utf8')

describe('幅ごとの @media の判定', () => {
  it('スマホ（375px）ではスマホ用の指定が効き、PC（620px）では効かない', () => {
    expect(SP_WIDTH).toBe(375)
    expect(LP_WIDTH).toBe(620)
    expect(mediaAtLpWidth('(max-width: 480px)', SP_WIDTH).applies).toBe(true)
    expect(mediaAtLpWidth('(max-width: 480px)', LP_WIDTH).applies).toBe(false)
    expect(mediaAtLpWidth('(min-width: 600px)', SP_WIDTH).applies).toBe(false)
  })
})

describe('見たまま画面に幅を渡す', () => {
  const scope = src('panels/widget-style-scope.ts')

  it('プレビューのCSSは、渡した幅で @media を判定する（既定はLPの幅）', () => {
    expect(scope).toContain('mediaAtLpWidth(rule.media.mediaText, width)')
    expect(scope).toContain('export function widgetPreviewCss(css: string, scope: string, width = LP_WIDTH): string')
  })

  it('SquadBeyond のプレビュー用CSSの取り除き（触らないもの）はそのまま', () => {
    expect(scope).toContain('const text = stripSbPreviewCss(css)')
  })

  it('ヘッダーの切り替えで、見たまま画面の幅と @media の判定を変える', () => {
    expect(src('panels/widget-studio.ts')).toContain('setPreviewDevice(device)')
    const visual = src('panels/widget-visual-editor.ts')
    expect(visual).toContain('widgetPreviewCss(css, previewScope, previewWidth)')
    expect(visual).toContain("previewWidth = device === 'sp' ? SP_WIDTH : LP_WIDTH")
  })
})
