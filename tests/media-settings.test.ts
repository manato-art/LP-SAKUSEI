/**
 * 画像と動画のどちらにも付けられる設定（2026-10-27 指示㉑ 本人「動画にもリンク入れたい」「画像でできること全部入れて」）。
 * リンク（行き先・開き方）・計測URL・アニメーション（種類・速さ・くり返し）。動画の代替テキストは aria-label。
 */
import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'
import { applyMediaSettings, mediaSettingsOf, MEDIA_SETTING_ATTRS } from '../src/app/panels/media-settings.ts'

const el = (html: string): Element => {
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`)
  const found = document.body.firstElementChild
  if (found === null) throw new Error('要素が無い')
  return found as unknown as Element
}

describe('画像・動画の設定', () => {
  it('リンク・計測URL・アニメーションを読む（空の物は読まない）', () => {
    const img = el(
      '<img src="a.png" data-link-url="https://example.com/?sb_tracking=true" data-link-target="_self" data-tracking-urls=\'["https://t.example.com/"]\' data-anim="fade" data-anim-speed="slow" data-anim-loop="1" data-link-url-x="" alt="写真">',
    )
    expect(mediaSettingsOf(img)).toEqual({
      'data-link-url': 'https://example.com/?sb_tracking=true',
      'data-link-target': '_self',
      'data-tracking-urls': '["https://t.example.com/"]',
      'data-anim': 'fade',
      'data-anim-speed': 'slow',
      'data-anim-loop': '1',
    })
    expect(mediaSettingsOf(el('<video src="a.mp4" data-anim=""></video>'))).toEqual({})
  })

  it('当てる（渡していない物は外す）', () => {
    const video = el('<video src="a.mp4" data-anim="fade" data-link-target="_blank"></video>')
    applyMediaSettings(video, { 'data-link-url': 'https://example.com/', 'aria-label': '紹介の動画' })
    expect(video.getAttribute('data-link-url')).toBe('https://example.com/')
    expect(video.getAttribute('aria-label')).toBe('紹介の動画')
    expect(video.hasAttribute('data-anim')).toBe(false)
    expect(video.hasAttribute('data-link-target')).toBe(false)
  })

  it('持つ設定の一覧', () => {
    expect(MEDIA_SETTING_ATTRS).toEqual(['data-link-url', 'data-link-target', 'data-tracking-urls', 'data-anim', 'data-anim-speed', 'data-anim-loop'])
  })
})
