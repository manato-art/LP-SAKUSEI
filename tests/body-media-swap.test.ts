/**
 * 通常画面（Versionの本文）の画像⇄動画の入れ替え（2026-10-27 本人「画像を動画に・その逆も」→「全部。通常画面も」）。
 * Quill の変更（Delta）を、本文の中身に当てた結果で確かめる。
 */
import Delta from 'quill-delta'
import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'
import { hasImageOnlySettings, imageToVideoOps, videoToImageOps } from '../src/app/panels/body-media-swap.ts'

const VIDEO = 'data:video/mp4;base64,AAAA'
const IMAGE = 'data:image/webp;base64,BBBB'

const apply = (doc: Delta, ops: ReturnType<typeof imageToVideoOps>): Delta['ops'] => doc.compose(new Delta(ops)).ops

describe('画像 → 動画', () => {
  it('画像だけの行は、行ごと動画にする（下に空の行を増やさない）。自動で再生・音なし・くり返し・位置はそのまま', () => {
    const doc = new Delta().insert('前\n').insert({ image: { src: 'a.png' } }).insert('\n', { align: 'center' }).insert('後\n')
    expect(apply(doc, imageToVideoOps(2, true, 'center', VIDEO))).toEqual([
      { insert: '前\n' },
      { insert: { sbvideo: { src: VIDEO, loop: 'on', autoplay: 'on', muted: 'on', align: 'center' } } },
      { insert: '後\n' },
    ])
  })

  it('文の途中の画像は、画像だけを動画にする（行の文字は残す）', () => {
    const doc = new Delta().insert('前').insert({ image: { src: 'a.png' } }).insert('後\n')
    expect(apply(doc, imageToVideoOps(1, false, 'left', VIDEO))).toEqual([
      { insert: '前' },
      { insert: { sbvideo: { src: VIDEO, loop: 'on', autoplay: 'on', muted: 'on', align: 'left' } } },
      { insert: '後\n' },
    ])
  })

  it('本文の先頭の画像でも入れ替えられる', () => {
    const doc = new Delta().insert({ image: { src: 'a.png' } }).insert('\n').insert('後\n')
    expect(apply(doc, imageToVideoOps(0, true, 'left', VIDEO))[0]).toEqual({
      insert: { sbvideo: { src: VIDEO, loop: 'on', autoplay: 'on', muted: 'on', align: 'left' } },
    })
  })
})

describe('動画 → 画像', () => {
  it('動画を、画像だけの行にする。位置は行の寄せ、幅は画像の幅で持つ', () => {
    const doc = new Delta().insert('前\n').insert({ sbvideo: { src: 'a.mp4', align: 'right' } }).insert('後\n')
    expect(apply(doc, videoToImageOps(2, 'right', IMAGE, '320'))).toEqual([
      { insert: '前\n' },
      { insert: { image: { src: IMAGE, width: '320' } } },
      { insert: '\n', attributes: { align: 'right' } },
      { insert: '後\n' },
    ])
  })

  it('左寄せ・幅の指定なしの動画は、寄せも幅も付けない', () => {
    const doc = new Delta().insert({ sbvideo: { src: 'a.mp4', align: 'left' } }).insert('\n')
    expect(apply(doc, videoToImageOps(0, 'left', IMAGE, null))).toEqual([{ insert: { image: { src: IMAGE } } }, { insert: '\n\n' }])
  })
})

describe('動画にすると外れる設定', () => {
  const img = (attrs: string): Element => {
    const { document } = parseHTML(`<!doctype html><html><body><img src="a.png" ${attrs}></body></html>`)
    const el = document.querySelector('img')
    if (el === null) throw new Error('img')
    return el as unknown as Element
  }

  it('リンク・計測URL・アニメーションが付いていれば知らせる', () => {
    expect(hasImageOnlySettings(img('data-link-url="https://example.com/"'))).toBe(true)
    expect(hasImageOnlySettings(img('data-tracking-urls=\'["https://example.com/t"]\''))).toBe(true)
    expect(hasImageOnlySettings(img('data-anim="fade"'))).toBe(true)
  })

  it('何も付いていなければ知らせない', () => {
    expect(hasImageOnlySettings(img('alt="写真" width="320"'))).toBe(false)
  })
})
