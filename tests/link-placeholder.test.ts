import { describe, expect, it } from 'vitest'
import { isPlaceholderHref, placeholderLinkCount, replacedHref } from '../src/app/panels/link-placeholder.ts'

/**
 * 見本のボタンのリンク先が「仮」のままか（2026-09-22・本人の決定「単独のボタンはリンクのまま、リンク先を入れやすく」）。
 * SBの見本は、リンク先を後から入れる前提で ooooo・○○○○○・◯◯◯◯・# などが入っている（点検で約450件）。
 */
describe('仮のリンク先', () => {
  it('見本で使われている仮の値は仮と見なす', () => {
    for (const href of ['ooooo', 'oooo', 'ooo', '○○○○○', '◯◯◯◯', '〇〇〇〇〇', '#', '##', '###', '', '%E2%97%8B%E2%97%8B%E2%97%8B', 'リンクURL', 'サイトのURLを入力してください']) {
      expect(isPlaceholderHref(href)).toBe(true)
    }
    expect(isPlaceholderHref('example.test/uploads/article_photo/a.pdf')).toBe(true)
    expect(isPlaceholderHref('https://sample09.example.test/ab_tests/UID_1/articles')).toBe(true)
  })

  it('本当のリンク先・ページ内の場所・電話は仮ではない', () => {
    for (const href of ['https://shop.example.com/', 'http://a.example.com/x?y=1', '#faq', '#temp11', 'tel:0120000000', 'mailto:info@shop.jp', '/lp/abc']) {
      expect(isPlaceholderHref(href)).toBe(false)
    }
  })

  it('Widgetの中の「仮のリンクのボタン」を数える（押すと画面が変わるボタン・スクリプトの中は数えない）', () => {
    const html =
      '<a href="ooooo" class="btn">申し込む</a>' +
      '<a href="https://shop.example.com/">公式</a>' +
      '<a href="ooooo" data-nc-go="s2">はい</a>' +
      '<p><a href="◯◯◯◯">詳しく</a></p>' +
      '<script>var s = \'<a href="ooooo">\'</script>'
    expect(placeholderLinkCount(html)).toBe(2)
  })
})

describe('リンク先を入れ替える', () => {
  it('入れたURLにする。計測の目印（sb_tracking）は元のリンクに合わせる', () => {
    expect(replacedHref('ooooo', null, ' https://shop.example.com/lp ')).toBe('https://shop.example.com/lp')
    expect(replacedHref('https://old.example.com/?sb_tracking=true', null, 'https://shop.example.com/')).toBe('https://shop.example.com/?sb_tracking=true')
  })

  it('ページ内の場所・電話・メールはそのまま', () => {
    expect(replacedHref('ooooo', null, '#faq')).toBe('#faq')
    expect(replacedHref('ooooo', null, 'tel:0120000000')).toBe('tel:0120000000')
    expect(replacedHref('ooooo', null, 'mailto:info@shop.jp')).toBe('mailto:info@shop.jp')
  })

  it('開けない形（javascript: など）や空は入れない', () => {
    expect(replacedHref('ooooo', null, 'javascript:alert(1)')).toBeNull()
    expect(replacedHref('ooooo', null, '   ')).toBeNull()
  })
})
