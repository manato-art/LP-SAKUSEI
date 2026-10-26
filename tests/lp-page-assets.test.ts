/**
 * 公開LPの <head> に置く外部ライブラリ（jQuery / Swiper / SmoothScroll / GLightbox）の判定の機械証明。
 *
 * 2026-10-26 SB本体の検証ページと比べて発覚: SB本体の配信ページは jQuery・Swiper・GLightbox を置かない
 * （共通で置くのは LazyLoad・URI.js・smooth-scroll 16.1.3 だけ）。取り込んだ見本は自分で Swiper 8 等を読み込む。
 * EBIyon が Swiper 11 の CSS を足すと、取り込んだスライダーの並び・見えている枚数が SB と変わっていた。
 */
import { describe, expect, it } from 'vitest'
import { externalWidgetLibs, withoutSbParts } from '../src/shared/lp-page-assets.ts'

const SWIPER8 = '<script src="https://cdn.jsdelivr.net/npm/swiper@8.4.7/swiper-bundle.min.js"></script>'

/** SB本体と同じ形で入れた取り込んだ見本 */
function sbPart(id: number, inner: string): string {
  return `<section class="sb-widget-block" data-widget-block="true"><div id="sb-part-${id}" class="sb-custom-part sbtoken${id}">${inner}</div><style data-sb-custom-style="">#sb-part-${id}.sbtoken${id} .a{color:red}</style></section>`
}

describe('取り込んだ見本の中身は、外部ライブラリの判定に使わない', () => {
  it('取り込んだ見本だけの LP には、Swiper も jQuery も GLightbox も足さない（見本が自分で読み込む）', () => {
    const html =
      sbPart(17070, `${SWIPER8}<div class="swiper"><div class="swiper-wrapper"><div class="swiper-slide">1</div></div></div><script>new Swiper('.swiper', { loop: true })</script>`) +
      sbPart(15379, '<script src="https://ajax.googleapis.com/ajax/libs/jquery/3.6.0/jquery.min.js"></script><script>$(function () {})</script>') +
      sbPart(16685, '<a class="glightbox" href="#">x</a><script>GLightbox({})</script>')
    expect(externalWidgetLibs(html)).toBe('')
  })

  it('SB本体が共通で置く smooth-scroll は、取り込んだ見本が使っていれば足す', () => {
    const html = sbPart(14783, '<script>new SmoothScroll(\'a[href*="#"]\')</script>')
    expect(externalWidgetLibs(html)).toContain('smooth-scroll@16.1.3')
  })

  it('取り込んだ見本の外（自作の見本・本文）が使っていれば、これまで通り足す', () => {
    const own = '<section class="sb-widget-block"><div class="swiper"><div class="swiper-wrapper"></div></div><script>new Swiper(".swiper")</script></section>'
    const html = sbPart(17070, `${SWIPER8}<div class="swiper"></div>`) + own
    expect(externalWidgetLibs(html)).toContain('swiper@11/swiper-bundle.min.js')
  })

  it('取り込んだ見本の中身だけを除く（入れ子の div・スクリプトの中の "<div" に惑わされない）', () => {
    const inner = '<div class="x"><div>a</div></div><script>el.innerHTML = "<div>" + "</div></div>"</script><style>.a{}</style>'
    const html = `<p>前</p>${sbPart(1, inner)}<p>後</p>`
    const out = withoutSbParts(html)
    expect(out).toContain('<p>前</p>')
    expect(out).toContain('<p>後</p>')
    expect(out).not.toContain('class="x"')
    expect(out).not.toContain('innerHTML')
  })
})
