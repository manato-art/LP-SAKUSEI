/**
 * ヒートマップの列に敷く「自前配信のLP」の機械証明（本人指定・2026-09-11）。
 *
 * これまでは LP の HTML をヒートマップの画面に直接置いていたので、@media の切り替えも「画面の横幅の◯%」で
 * 決めた大きさもパソコンの画面の広さで決まり、スマホ枠の中が実機と違う見た目・長さになっていた
 * （例: 4つ並んだテキストバルーンの並びが 800px・見出しが 38px。スマホ実機では約320px・約18px）。
 * そこで外部LPと同じく iframe に入れて「枠の幅＝画面の幅」にし、中身は公開LPと同じ土台で組む。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildHeatmapLpDocument } from '../src/app/pages/heatmap-lp-document.ts'
import { LP_BASE_CSS } from '../src/app/lp-base-css.ts'
import { WIDGET_RESET_CSS } from '../src/shared/sb-preview-css.ts'
import { LP_FONTS_URL } from '../src/shared/lp-page-assets.ts'

/** Widget に紛れ込む SquadBeyond のプレビュー用CSS（最初と最後の目印だけの最小形） */
const SB_PAGE_BASE = 'html{height:100vh}body{margin:0 auto;height:100vh;background-color:#ececec}td,th{padding:0}'

describe('ヒートマップに敷く自前配信のLP', () => {
  it('公開LPと同じ土台（配信幅620px・LPの共通CSS・Version の CSS・記事設定の CSS・フォント）で組む', () => {
    const doc = buildHeatmapLpDocument({ html: '<p>本文</p>', css: '.v{color:red}', styleCss: '.s{color:blue}' })
    expect(doc).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">')
    expect(doc).toContain('body{margin:0 auto;max-width:620px;')
    expect(doc).toContain(`${LP_BASE_CSS}.v{color:red}.s{color:blue}`)
    expect(doc).toContain(`href="${LP_FONTS_URL}"`)
    expect(doc).toContain('<body><p>本文</p></body>')
  })

  it('計測タグやスクリプトは入れない。Widget の外部ライブラリは、見た目と高さに効くスタイルシートだけ読む', () => {
    const doc = buildHeatmapLpDocument({
      html: '<div class="swiper"><div class="swiper-wrapper"><div class="swiper-slide">1</div></div></div>',
      css: '',
      styleCss: '',
    })
    expect(doc).not.toContain('<script')
    expect(doc).toContain('swiper-bundle.min.css')
  })

  it('Widget に紛れ込んだ SquadBeyond のプレビュー用CSSは取り除き、Widget の土台を置く（公開LPと同じ）', () => {
    const doc = buildHeatmapLpDocument({
      html: `<section class="sb-widget-block"><style>${SB_PAGE_BASE}</style><style>.a{color:red}</style><div class="a">x</div></section>`,
      css: '',
      styleCss: '',
    })
    expect(doc).not.toContain('#ececec')
    expect(doc).toContain('<style>.a{color:red}</style>')
    expect(doc).toContain(WIDGET_RESET_CSS)
  })

  it('Widget の無い LP には土台を置かない', () => {
    expect(buildHeatmapLpDocument({ html: '<p>本文</p>', css: '', styleCss: '' })).not.toContain(WIDGET_RESET_CSS)
  })
})

describe('ヒートマップの列は、自前配信のLPも iframe（枠の幅＝画面の幅）で敷く', () => {
  it('LP の HTML をヒートマップの画面に直接置かず、スクリプトを動かさない iframe に入れる', () => {
    const source = readFileSync('src/app/pages/heatmap-columns.ts', 'utf8')
    expect(source).not.toMatch(/\.innerHTML = spec\.html/)
    expect(source).toContain('buildHeatmapLpDocument({ html: spec.html, css: spec.css, styleCss: deps.styleCss })')
    expect(source).toContain("setAttribute('sandbox', 'allow-same-origin')")
    expect(source).not.toMatch(/sandbox['"],\s*['"][^'"]*allow-scripts/)
  })
})

describe('ヘッダー画像（公開LPと同じ・2026-09-11）', () => {
  it('本文の先頭のヘッダー画像を、本文の上に画像として出す', () => {
    const doc = buildHeatmapLpDocument({ html: '<!--header-image:/uploads/h.png--><p>本文</p>', css: '', styleCss: '' })
    expect(doc).not.toContain('<!--header-image:')
    expect(doc).toMatch(/<body><img src="\/uploads\/h\.png" [^>]*alt="ヘッダー画像"><p>本文<\/p><\/body>/)
  })
})
