/**
 * 取り込んだ見本（SquadBeyond の Widget・`.sb-custom-part`）の中だけ、SB本体の配信ページと同じ土台にすることの機械証明（2026-10-26）。
 *
 * 実測: SB本体の「検証」ページと EBIyon に同じ Widget を入れて比べたところ、
 * 「コンテンツ内スクロールアンケート（全画面レイアウト）」（15950）の左のロゴが、SBでは幅0で見えず EBIyon では見えていた。
 * SB本体の配信ページには、本文（.article-body）の中のすべてに効く指定がある（div の max-width:100%・
 * Widget の画像は display:block!important / height:auto!important・段落の余白0・リンクは下線の青 等）。
 * EBIyon はこれを持たず、代わりに SB の「編集画面の見本の枠」の土台（WIDGET_RESET_CSS）を当てていた。
 */
import { describe, expect, it } from 'vitest'
import { LP_BASE_CSS } from '../src/app/lp-base-css.ts'
import { WIDGET_BASE_CSS, sbPartCss, widgetBaseCss } from '../src/shared/sb-part-css.ts'
import { WIDGET_RESET_CSS, WIDGET_RESET_RULES, widgetResetCss } from '../src/shared/sb-preview-css.ts'

const SCOPE = ':where(.sb-widget-block)'

/** CSS を「頭」と「中身」の組に分ける（入れ子の無い CSS だけ） */
function rulesOf(css: string): { selector: string; body: string }[] {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: (m[1] ?? '').trim(), body: (m[2] ?? '').trim() }))
}

describe('取り込んだ見本の中だけ、SB本体の配信ページと同じ土台にする', () => {
  const css = sbPartCss(SCOPE)
  const rules = rulesOf(css)

  it('どの指定も、取り込んだ見本（.sb-custom-part）の中にしか効かない（自作の見本・LPの本文には効かない）', () => {
    expect(rules.length).toBeGreaterThan(0)
    for (const { selector } of rules) {
      for (const s of selector.split(/,(?![^(]*\))/)) {
        expect(s.trim().startsWith(SCOPE), s).toBe(true)
        expect(s, s).toContain('.sb-custom-part')
      }
    }
  })

  it('EBIyon の土台（編集画面の見本の枠のもの）は、取り込んだ見本の中では外す（ブラウザの既定に戻す）', () => {
    for (const [selectors, declarations] of WIDGET_RESET_RULES) {
      if (selectors === '') continue
      const properties = declarations.split(';').map((d) => d.split(':')[0]?.trim())
      const expected = `${selectors.split(',').map((s) => `${SCOPE} :where(.sb-custom-part) ${s.trim()}`).join(',')}{${properties.map((p) => `${p}:revert`).join(';')}}`
      expect(css, selectors).toContain(expected)
    }
  })

  it('SB本体の配信ページの指定（2026-10-26 検証ページで実測・記事設定は既定値）を入れる', () => {
    const at = (needle: string): number => css.indexOf(needle)
    // 本文の中の div 等は親の幅を超えない（15950 のロゴが幅0になるのはこれ）
    expect(css).toContain(`${SCOPE} .sb-custom-part,${SCOPE} .sb-custom-part :is(span,p,div,h1,h2,h3,h4,h5,h6){max-width:100%}`)
    // Widget の画像はブロック・高さは自動（SBは読み込んだ画像の lazyload を外すので常に効く）・上下の余白0（記事設定の既定値）
    expect(css).toContain(`${SCOPE} .sb-custom-part img{display:block!important;max-width:100%;height:auto!important;margin-top:0!important;margin-bottom:0!important}`)
    expect(css).toContain(`${SCOPE} .sb-custom-part video{display:unset!important;max-width:100%;height:auto!important;margin-top:20px!important;margin-bottom:20px!important}`)
    expect(css).toContain(`${SCOPE} .sb-custom-part iframe{display:block;max-width:100%;margin-top:20px!important;margin-bottom:20px!important}`)
    expect(css).toContain(`${SCOPE} .sb-custom-part p{margin:0}`)
    expect(css).toContain(`${SCOPE} .sb-custom-part h2{font-size:27px;margin:0}`)
    expect(css).toContain(`${SCOPE} .sb-custom-part a{text-decoration:underline;color:#4682b4}`)
    // SB本体の normalize（配信ページのもの。編集画面の枠のものとは figure の余白・表・入力欄が違う）
    expect(css).toContain(`${SCOPE} :where(.sb-custom-part) figure{margin:0}`)
    expect(css).not.toMatch(/sb-custom-part\) table\{border-collapse:collapse/)
    // 外す指定が先、SB本体の指定があと（同じ強さなら後ろが勝つ）
    expect(at(`${SCOPE} :where(.sb-custom-part) figure{margin:revert}`)).toBeLessThan(at(`${SCOPE} :where(.sb-custom-part) figure{margin:0}`))
  })

  it('配信・プレビュー・ダウンロード用の土台は、これまでの土台のあとに続けて置く', () => {
    expect(WIDGET_BASE_CSS).toBe(WIDGET_RESET_CSS + sbPartCss(SCOPE))
    expect(widgetBaseCss('.ql-editor .sb-widget-block')).toBe(
      widgetResetCss('.ql-editor .sb-widget-block') + sbPartCss('.ql-editor .sb-widget-block'),
    )
  })

  it('Widget の中の素のリンクを青くする EBIyon の指定（指示161）は、取り込んだ見本の中には効かせない', () => {
    expect(LP_BASE_CSS).toContain('section.sb-widget-block a:not([class]):not(.sb-custom-part a){color:#0d6efd;text-decoration:underline}')
  })
})
