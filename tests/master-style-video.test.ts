/**
 * 記事設定の背景・ヘッダー画像にも動画（2026-10-27 本人「画像を入れられる所は動画も」→「ヘッダー画像・記事設定の背景も動画OKにする」）。
 * 動画は CSS の背景にできないので、本文の先頭に動画の層を入れる（自動で再生・音なし・くり返し）。
 */
import { describe, expect, it } from 'vitest'
import { isVideoBackground, masterStyleBackgroundHtml, masterStyleCanvasBackground, masterStyleIframeCss, masterStylePageBackground, type MasterStyleSheet } from '../src/app/master-style.ts'
import { splitHeaderImage } from '../src/shared/header-image.ts'

const EMPTY: MasterStyleSheet = {
  font_size: null,
  font_family: '',
  color: '',
  text_align: '',
  line_height: null,
  letter_spacing: null,
  img_margin_top: null,
  img_margin_bottom: null,
  padding_top: null,
  padding_bottom: null,
  padding_right: null,
  padding_left: null,
  iframe_height: null,
  iframe_height_unit: '',
  delivery_version_width: null,
  delivery_version_width_unit: '',
  border_size: null,
  border_type: '',
  border_color: '',
  outer_background_color: '',
  outer_background_image: '',
  inner_background_color: '',
  inner_background_image: '',
}
const MP4 = `/uploads/${'a'.repeat(64)}.mp4`
const PNG = `/uploads/${'b'.repeat(64)}.png`

describe('記事設定の背景の動画', () => {
  it('動画か画像かは住所で見分ける（保存で /uploads/…mp4 になる・data:video/… も動画）', () => {
    expect(isVideoBackground(MP4)).toBe(true)
    expect(isVideoBackground('data:video/webm;base64,AAAA')).toBe(true)
    expect(isVideoBackground(PNG)).toBe(false)
    expect(isVideoBackground('')).toBe(false)
  })

  it('全体背景の動画は、画面に固定していちばん後ろに敷く（CSS の背景の画像にはしない）', () => {
    const sheet = { ...EMPTY, outer_background_image: MP4 }
    const css = masterStyleIframeCss(sheet)
    expect(css).not.toContain('url(')
    expect(css).toContain('.lp-bg{position:fixed;')
    expect(masterStyleBackgroundHtml(sheet)).toBe(`<video class="lp-bg lp-bg--outer" src="${MP4}" autoplay muted loop playsinline preload="auto" aria-hidden="true"></video>`)
    // 編集画面の土台の背景（CSS の変数）にも入れない（動画は editor-bg-layers.ts が敷く）
    expect(masterStyleCanvasBackground(sheet)).toBe('')
  })

  it('Version背景の動画は本文の幅で画面に固定して敷き、本文の白い地を外す', () => {
    const sheet = { ...EMPTY, inner_background_image: MP4 }
    const css = masterStyleIframeCss(sheet)
    expect(css).toContain('body{background-color:transparent}')
    expect(css).toContain('.lp-bg--inner{max-width:inherit}')
    expect(masterStyleBackgroundHtml(sheet)).toContain('class="lp-bg lp-bg--inner"')
    expect(masterStylePageBackground(sheet)).toBe('')
  })
})

describe('ヘッダーの動画', () => {
  it('ヘッダーに置いたのが動画なら、配信でも動画（自動で再生・音なし・くり返し）で出す', () => {
    const { headerHtml, body } = splitHeaderImage(`<!--header-image:${MP4}--><p>本文</p>`)
    expect(headerHtml).toMatch(/^<video src="\/uploads\/a{64}\.mp4" style="[^"]*" autoplay muted loop playsinline aria-label="ヘッダー動画"><\/video>$/)
    expect(body).toBe('<p>本文</p>')
  })

  it('画像なら今までどおり画像', () => {
    expect(splitHeaderImage(`<!--header-image:${PNG}--><p>本文</p>`).headerHtml).toMatch(/^<img src="\/uploads\/b{64}\.png"/)
  })
})
