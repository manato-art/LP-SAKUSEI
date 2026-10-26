import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'
import { LP_BASE_CSS } from '../src/app/lp-base-css.ts'
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

/**
 * 2026-10-26 SB本体の検証ページと比べて発覚: SB本体では Widget の外枠が div.sb-custom（.article-body の直下の div）。
 * EBIyon は section だったので、`.article-body` の直下の div を探す見本（15305・9530 サイドバー）が何もせず、
 * SBでは本文が70%・サイドバーが右に並ぶのに、EBIyon では並ばなかった。取り込んだ見本の外枠は div にする。
 */
describe('取り込んだ見本の外枠は SB本体と同じ div', () => {
  const PART = (id: number, inner: string): string =>
    `<div id="sb-part-${id}" class="sb-custom-part sbtoken${id}">${inner}</div><style data-sb-custom-style="">#sb-part-${id}.sbtoken${id} .a{color:red}</style>`

  it('取り込んだ見本を包む外枠を div.sb-custom にする（属性はそのまま）', () => {
    const html = `<p>本文</p>${WIDGET(PART(1, '<p>見本</p>'))}`
    expect(withSbPageStructure(html)).toBe(
      `<p>本文</p><div class="sb-widget-block sb-custom" data-widget-block="true" style="margin:8px 0">${PART(1, '<p>見本</p>')}</div>`,
    )
  })

  it('自作の Widget の外枠は section のまま', () => {
    const own = WIDGET('<p>自作</p>')
    const out = withSbPageStructure(`${own}${WIDGET(PART(2, '<p>見本</p>'))}`)
    expect(out.startsWith('<section class="sb-widget-block sb-custom" data-widget-block="true" style="margin:8px 0"><p>自作</p></section>')).toBe(true)
  })

  it('見本の中の section やスクリプトの中の "</section>" に惑わされず、外枠だけを div にする', () => {
    const inner = '<section class="x"><p>中</p></section><script>el.innerHTML = "</section>"</script>'
    expect(withSbPageStructure(WIDGET(PART(3, inner)))).toBe(
      `<div class="sb-widget-block sb-custom" data-widget-block="true" style="margin:8px 0">${PART(3, inner)}</div>`,
    )
  })

  it('サイドバーの見本の探し方（.article-body の直下の div）で、取り込んだ見本の外枠が見つかる', () => {
    const sidebar = PART(15305, "<div class=\"js-sidebar\"></div><script>document.querySelector('.article-body')</script>")
    const out = neutralizeWidgetStyles(`<p>本文</p>${WIDGET(PART(4, '<p>a</p>'))}${WIDGET(sidebar)}`).html
    const { document } = parseHTML(`<html><body>${out}</body></html>`)
    const direct = [...(document.querySelector('.article-body')?.children ?? [])].filter((c) => c.tagName === 'DIV')
    expect(direct.map((c) => c.querySelector('.sb-custom-part')?.id)).toEqual(['sb-part-4', 'sb-part-15305'])
  })

  it('EBIyon の配信の土台（指示155 の行間・本文の段落の空き）は、div の外枠と .article-body の中にも効く', () => {
    const out = neutralizeWidgetStyles(`<p>本文</p>${WIDGET("<p>自作</p><script>document.querySelector('.article-body')</script>")}${WIDGET(PART(5, '<a href="#">x</a>'))}`).html
    const { document } = parseHTML(`<html><body>${out}</body></html>`)
    const selectorOf = (prop: string): string => {
      const rule = LP_BASE_CSS.split('}').find((r) => r.includes(`{${prop}`))
      if (rule === undefined) throw new Error(`${prop} の決まりがありません`)
      return rule.slice(0, rule.indexOf('{'))
    }
    expect(document.querySelectorAll(selectorOf('line-height:1.5')).length).toBe(2)
    expect(document.querySelectorAll(selectorOf('margin:0')).length).toBe(1)
  })
})
