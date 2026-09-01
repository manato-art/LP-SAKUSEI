import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { embedFormat, isInsertableMedia, mediaInsertedMessage } from '../src/app/panels/media-insert.ts'

/**
 * 画像/GIF/動画の挿入（ツールバー・右レール・ドラッグ＆ドロップ共通）。
 * DOM を伴う部分（Quill/FileReader/drop）は node 環境で回せないので、
 * ここでは種別判定・文言・配線の存在を純粋に突き合わせる。
 */
describe('埋め込み種別の判定', () => {
  it('動画は独自ブロット sbvideo、画像・GIFは標準 image', () => {
    expect(embedFormat('video/mp4')).toBe('sbvideo')
    expect(embedFormat('video/webm')).toBe('sbvideo')
    expect(embedFormat('image/png')).toBe('image')
    expect(embedFormat('image/gif')).toBe('image') // GIFは画像として <img> 挿入（アニメ可）
    expect(embedFormat('image/jpeg')).toBe('image')
  })

  it('受け付けるのは画像・動画だけ（それ以外は無視）', () => {
    expect(isInsertableMedia({ type: 'image/gif' })).toBe(true)
    expect(isInsertableMedia({ type: 'video/mp4' })).toBe(true)
    expect(isInsertableMedia({ type: 'application/pdf' })).toBe(false)
    expect(isInsertableMedia({ type: 'text/plain' })).toBe(false)
  })
})

describe('挿入トーストの文言', () => {
  it('画像/動画の件数を出す', () => {
    expect(mediaInsertedMessage(2, 0)).toContain('画像2件')
    expect(mediaInsertedMessage(0, 1)).toContain('動画1件')
    expect(mediaInsertedMessage(1, 2)).toContain('画像1件・動画2件')
  })
  it('外部送信しない旨を必ず添える', () => {
    expect(mediaInsertedMessage(1, 0)).toContain('外部サーバーへは送信しません')
  })
})

describe('2つのボタンとドラッグ＆ドロップが配線されている', () => {
  it('ツールバーの画像ボタンは pickAndInsertMedia を呼ぶ', () => {
    const src = readFileSync('src/app/panels/editor-toolbar.ts', 'utf8')
    expect(src).toContain("import { pickAndInsertMedia } from './media-insert.ts'")
    expect(src).toMatch(/HOOK\.photo\)[^\n]*pickAndInsertMedia\(quill\)/)
  })
  it('右レールの外部画像アップロードも pickAndInsertMedia を呼ぶ', () => {
    const src = readFileSync('src/app/panels/external-image.ts', 'utf8')
    expect(src).toContain('pickAndInsertMedia(quill)')
  })
  it('エディタはブロット登録とドロップ配線をする', () => {
    const src = readFileSync('src/app/pages/editor.ts', 'utf8')
    expect(src).toContain('registerMediaBlots()')
    expect(src).toContain('wireMediaDrop(quill)')
  })
  it('配信土台CSSは動画も枠内に収める', () => {
    const src = readFileSync('src/app/lp-base-css.ts', 'utf8')
    expect(src).toContain('video{max-width:100%')
  })
})
