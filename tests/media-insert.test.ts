import { describe, it, expect, vi } from 'vitest'
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
  it('保存先は「このシステム内」と書く（「クローン」という作る側の言葉は使わない）', () => {
    expect(mediaInsertedMessage(1, 0)).toContain('このシステム内に保存')
    expect(mediaInsertedMessage(1, 0)).not.toContain('クローン')
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

/**
 * 本人「画像とか動画貼ると、2まい貼られてしまう」（2026-10-18）。
 * Quill の uploader（PNG・JPEG を落とすと自分で入れる）と、自前のドロップの受け口の両方が入れていた。
 * 落とす・貼り付けるは Quill の uploader 1か所にし、その中身を自前の入れ方（WebPにする・動画も入る）にする。
 */
describe('落とす・貼り付けるは1か所で入れる（2枚入らない）', () => {
  it('Quill の uploader が受ける形式に、画像（GIF・WebP含む）と動画が入っている', async () => {
    const { MEDIA_MIMETYPES } = await import('../src/app/panels/media-insert.ts')
    for (const type of ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']) {
      expect(MEDIA_MIMETYPES).toContain(type)
    }
  })

  it('uploader の入れ方は自前の入れ方（落とした・貼った位置へ、1回だけ）', async () => {
    vi.resetModules()
    vi.doMock('../src/app/panels/webp-convert.ts', () => ({ convertImageToWebP: async (f: File) => `data:${f.type};base64,AA` }))
    vi.doMock('../src/app/ui.ts', () => ({ toast: () => undefined }))
    const { mediaUploaderOptions } = await import('../src/app/panels/media-insert.ts')
    const inserted: Array<[number, string]> = []
    const quill = {
      insertEmbed: (index: number, format: string) => inserted.push([index, format]),
      setSelection: () => undefined,
    }
    const png = new File([new Uint8Array([1])], 'a.png', { type: 'image/png' })
    const mp4 = new File([new Uint8Array([1])], 'b.mp4', { type: 'video/mp4' })
    await mediaUploaderOptions().handler.call({ quill: quill as never }, { index: 3, length: 0 }, [png, mp4])
    expect(inserted).toEqual([
      [3, 'image'],
      [4, 'sbvideo'],
    ])
    vi.doUnmock('../src/app/panels/webp-convert.ts')
    vi.doUnmock('../src/app/ui.ts')
  })

  it('エディタは uploader を自前の入れ方にし、自前のドロップの受け口では入れない', () => {
    const editor = readFileSync('src/app/pages/editor.ts', 'utf8')
    expect(editor).toContain('uploader: mediaUploaderOptions()')
    const insert = readFileSync('src/app/panels/media-insert.ts', 'utf8')
    expect(insert).not.toContain("root.addEventListener('drop'")
  })
})
