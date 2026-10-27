/**
 * 記事設定の背景の画像の「位置と大きさ」（2026-10-27 指示⑱ 本人「背景画像なんだけど、ここでトリミングや大きさの調整をしたい」
 * → 選択「位置と大きさを動かす」）。持ち方（文字列1つ）と、配信・編集画面で当てる見え方。
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_PAGE_BG_LOOK, formatPageBgLook, pageBgImageDecls, parsePageBgLook } from '../src/shared/page-bg-look.ts'
import { masterStyleBackgroundHtml, type MasterStyleSheet } from '../src/app/master-style.ts'

describe('持ち方', () => {
  it('空は今までどおり（全体を覆う・真ん中）', () => {
    expect(parsePageBgLook('')).toEqual(DEFAULT_PAGE_BG_LOOK)
    expect(parsePageBgLook(undefined)).toEqual(DEFAULT_PAGE_BG_LOOK)
    expect(formatPageBgLook(DEFAULT_PAGE_BG_LOOK)).toBe('')
  })

  it('合わせ方・大きさ・左右・上下・画像の横÷縦を読み書きする', () => {
    expect(parsePageBgLook('free 108 50 30 1.5')).toEqual({ fit: 'free', size: 108, x: 50, y: 30, ratio: 1.5 })
    expect(formatPageBgLook({ fit: 'free', size: 108, x: 50, y: 30, ratio: 1.5 })).toBe('free 108 50 30 1.5')
    expect(parsePageBgLook('contain 100 50 0')).toEqual({ fit: 'contain', size: 100, x: 50, y: 0, ratio: null })
    expect(formatPageBgLook({ fit: 'cover', size: 100, x: 50, y: 20, ratio: null })).toBe('cover 100 50 20')
  })

  it('おかしな値は範囲に収める・知らない形は今までどおりにする', () => {
    expect(parsePageBgLook('free 9999 -500 999 0')).toEqual({ fit: 'free', size: 400, x: -100, y: 200, ratio: null })
    expect(parsePageBgLook('stretch 100 50 50')).toEqual(DEFAULT_PAGE_BG_LOOK)
    expect(parsePageBgLook('free abc 50 50 1.5')).toEqual({ fit: 'free', size: 100, x: 50, y: 50, ratio: 1.5 })
  })
})

describe('見え方（背景の画像のCSS）', () => {
  it('全体を覆う・全体を見せる', () => {
    expect(pageBgImageDecls({ ...DEFAULT_PAGE_BG_LOOK, y: 20 })).toBe('background-size:cover;background-position:50% 20%')
    expect(pageBgImageDecls({ ...DEFAULT_PAGE_BG_LOOK, fit: 'contain' })).toBe('background-size:contain;background-position:50% 50%')
  })

  it('自分で決める: 大きさは「全体を覆う大きさ」に対する%（層の高さ×画像の横÷縦 と 層の幅 の大きい方が100%）', () => {
    expect(pageBgImageDecls({ fit: 'free', size: 150, x: 0, y: 100, ratio: 1.5 })).toBe(
      'background-size:calc(max(100%, var(--lp-bg-h, 100vh) * 1.5) * 1.5) auto;background-position:0% 100%',
    )
  })

  it('画像の横÷縦が分からないときは、層の幅に対する%', () => {
    expect(pageBgImageDecls({ fit: 'free', size: 80, x: 50, y: 50, ratio: null })).toBe('background-size:80% auto;background-position:50% 50%')
  })
})

describe('配信・プレビューの背景の層', () => {
  const EMPTY: MasterStyleSheet = {
    font_size: null, font_family: '', color: '', text_align: '', line_height: null, letter_spacing: null,
    img_margin_top: null, img_margin_bottom: null, padding_top: null, padding_bottom: null, padding_right: null, padding_left: null,
    iframe_height: null, iframe_height_unit: '', delivery_version_width: null, delivery_version_width_unit: '',
    border_size: null, border_type: '', border_color: '', outer_background_color: '', outer_background_image: '',
    inner_background_color: '', inner_background_image: '',
  }
  const PNG = `/uploads/${'c'.repeat(64)}.webp`

  it('LP内背景・外枠背景の画像の層に、それぞれの位置と大きさを当てる', () => {
    const html = masterStyleBackgroundHtml({
      ...EMPTY,
      inner_background_image: PNG,
      inner_background_look: 'contain 100 50 0',
      outer_background_image: PNG,
      outer_background_look: 'free 120 0 50 2',
    })
    expect(html).toContain('lp-bg--inner" style="background-image:url(&quot;')
    expect(html).toContain('background-size:contain;background-position:50% 0%')
    expect(html).toContain('background-size:calc(max(100%, var(--lp-bg-h, 100vh) * 2) * 1.2) auto;background-position:0% 50%')
  })

  it('位置と大きさを決めていなければ今までどおり（層のCSSの「全体を覆う・真ん中」のまま）', () => {
    expect(masterStyleBackgroundHtml({ ...EMPTY, inner_background_image: PNG })).toBe(
      `<div class="lp-bg lp-bg--inner" style="background-image:url(&quot;${PNG}&quot;)" aria-hidden="true"></div>`,
    )
  })
})
