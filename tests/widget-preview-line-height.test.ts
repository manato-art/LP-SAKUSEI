/**
 * Widget編集の見たまま画面の行間。配信と同じにする（WYSIWYG）。
 * 自作の Widget は指示155の1.5。取り込んだ見本は SB本体と同じく記事設定の行間（2026-10-27 本人選択）。
 */
import { describe, expect, it } from 'vitest'
import { previewLineHeight } from '../src/app/panels/widget-preview-line-height.ts'

describe('Widget編集の見たまま画面の行間', () => {
  it('自作の Widget は 1.5', () => {
    expect(previewLineHeight('<div class="box"><p>自作</p></div>', '1.8')).toBe('1.5')
  })

  it('取り込んだ見本は記事設定の行間', () => {
    expect(previewLineHeight('<div id="sb-part-3025" class="sb-custom-part sbtok"><p>見本</p></div>', '1.8')).toBe('1.8')
  })

  it('記事設定に行間が無いときは、配信と同じくブラウザの既定（normal）', () => {
    expect(previewLineHeight('<div id="sb-part-3025" class="sb-custom-part sbtok"></div>', '')).toBe('normal')
  })
})
