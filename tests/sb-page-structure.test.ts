import { describe, expect, it } from 'vitest'
import { withSbPageStructure } from '../src/shared/sb-page-structure.ts'
import { neutralizeWidgetStyles } from '../src/shared/sb-preview-css.ts'

/**
 * SquadBeyond の配信ページの形を前提にした見本のために、同じ形を用意する（2026-09-22・見本の全件点検で発覚）。
 * SBでは本文が `.article-body` の中にあり、Widget は1つずつ `.sb-custom` の中にある。
 * 見本のスクリプト・CSSがそれを探して止まっていた（例: 画面ワイパーの幕が出ない・次のWidgetを出せない・画像の大きさ）。
 * 使っている見本が入っているLPだけに足す（入っていないLPは1文字も変えない）。
 */
const WIDGET = (inner: string): string => `<section class="sb-widget-block" data-widget-block="true" style="margin:8px 0">${inner}</section>`

describe('SBの配信ページの形', () => {
  it('見本が .sb-custom を使うなら、Widget の外枠を .sb-custom にもする', () => {
    const html = `<p>本文</p>${WIDGET("<script>btn.closest('.sb-custom')</script>")}${WIDGET('<p>次</p>')}`
    expect(withSbPageStructure(html)).toBe(
      `<p>本文</p><section class="sb-widget-block sb-custom" data-widget-block="true" style="margin:8px 0"><script>btn.closest('.sb-custom')</script></section>` +
        `<section class="sb-widget-block sb-custom" data-widget-block="true" style="margin:8px 0"><p>次</p></section>`,
    )
  })

  it('見本が .article-body を使うなら、本文を .article-body で包む', () => {
    const html = `<p>本文</p>${WIDGET("<script>document.querySelector('.article-body').classList.add('is-active')</script>")}`
    expect(withSbPageStructure(html)).toBe(`<div class="article-body">${html}</div>`)
  })

  it('どちらも使っていないLPは変えない', () => {
    const html = `<p>本文</p>${WIDGET('<p>ふつうのWidget</p>')}`
    expect(withSbPageStructure(html)).toBe(html)
  })

  it('公開LP・プレビュー・ダウンロード・ヒートマップが通る所（neutralizeWidgetStyles）で足す', () => {
    const html = WIDGET('<style>body .article-body .sb-custom img{width:100%}</style><img src="a.png">')
    const out = neutralizeWidgetStyles(html).html
    expect(out.startsWith('<div class="article-body"><section class="sb-widget-block sb-custom"')).toBe(true)
  })
})
