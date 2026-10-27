/**
 * 記事設定の背景の画像は、画面に固定した壁紙にする（2026-10-27 本人選択「画面に固定した壁紙にする」）。
 * それまでは CSS の背景（本文の長さに合わせて cover）だったので、長いLPだと画像が縦に引き伸ばされてぼやけ、
 * 本文と一緒に流れていた。背景の動画と同じく、いちばん後ろの層（画面に固定）で敷く。
 */
import { describe, expect, it } from 'vitest'
import { masterStyleBackgroundHtml, masterStyleEditorDecls, masterStyleIframeCss, type MasterStyleSheet } from '../src/app/master-style.ts'

const EMPTY: MasterStyleSheet = {
  font_size: null, font_family: '', color: '', text_align: '', line_height: null, letter_spacing: null,
  img_margin_top: null, img_margin_bottom: null, padding_top: null, padding_bottom: null, padding_right: null, padding_left: null,
  iframe_height: null, iframe_height_unit: '', delivery_version_width: null, delivery_version_width_unit: '',
  border_size: null, border_type: '', border_color: '', outer_background_color: '', outer_background_image: '',
  inner_background_color: '', inner_background_image: '',
}
const PNG = `/uploads/${'b'.repeat(64)}.webp`

describe('記事設定の背景の画像（画面に固定した壁紙）', () => {
  it('全体背景の画像は、画面いっぱいに固定した層にする（CSS の背景にはしない＝本文の長さで引き伸ばさない）', () => {
    const sheet = { ...EMPTY, outer_background_color: 'ffe9c7', outer_background_image: PNG }
    const css = masterStyleIframeCss(sheet)
    expect(css).not.toContain('background-image')
    expect(css).toContain('html{background-color:#ffe9c7}')
    expect(css).toContain('.lp-bg{position:fixed;')
    expect(css).toContain('z-index:-1')
    expect(css).toContain('.lp-bg--outer{max-width:none}')
    expect(masterStyleBackgroundHtml(sheet)).toBe(`<div class="lp-bg lp-bg--outer" style="background-image:url(&quot;${PNG}&quot;)" aria-hidden="true"></div>`)
  })

  it('Version背景の画像は、本文の幅で画面に固定した層にし、本文の白い地を外す', () => {
    const sheet = { ...EMPTY, inner_background_image: PNG }
    const css = masterStyleIframeCss(sheet)
    expect(css).not.toContain('background-image')
    expect(css).toContain('body{background-color:transparent}')
    expect(css).toContain('.lp-bg--inner{max-width:inherit}')
    expect(masterStyleBackgroundHtml(sheet)).toContain('<div class="lp-bg lp-bg--inner"')
    // 編集画面の本文にも画像を CSS の背景で当てない（編集画面も層で敷く）
    expect(masterStyleEditorDecls(sheet)).not.toContain('background-image')
  })

  it('全体背景だけ画像（色なし）でも、本文の白い地は本文の幅のまま（ページに色が無いと本文の地が画面全体に塗られ、画像の上に出ない）', () => {
    const css = masterStyleIframeCss({ ...EMPTY, outer_background_image: PNG, inner_background_color: 'ffffff' })
    expect(css).toContain('html{background-color:#fff}')
    expect(css).toContain('body{')
    expect(css).toContain('background-color:#ffffff')
    // 色があるときはその色（白で上書きしない）
    expect(masterStyleIframeCss({ ...EMPTY, outer_background_color: 'ffe9c7', outer_background_image: PNG })).not.toContain('html{background-color:#fff}')
  })

  it('全体背景とVersion背景の両方なら、全体背景の層の上にVersion背景の層（この順に入れる）', () => {
    const html = masterStyleBackgroundHtml({ ...EMPTY, outer_background_image: PNG, inner_background_image: PNG })
    expect(html.indexOf('lp-bg--outer')).toBeLessThan(html.indexOf('lp-bg--inner'))
  })

  it('背景が色だけ・未設定なら層を入れない', () => {
    expect(masterStyleBackgroundHtml({ ...EMPTY, inner_background_color: 'ffffff' })).toBe('')
    expect(masterStyleIframeCss({ ...EMPTY, inner_background_color: 'ffffff' })).not.toContain('.lp-bg')
  })

  it('住所の中の「"」で CSS が壊れない', () => {
    expect(masterStyleBackgroundHtml({ ...EMPTY, outer_background_image: '/uploads/a"b.png' })).toContain('url(&quot;/uploads/a%22b.png&quot;)')
  })
})
