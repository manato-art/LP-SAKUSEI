/**
 * 画像⇄動画の入れ替え（2026-10-27 本人「widgetで画像を動画に変えれないからできるようにして。その逆も同じ」）。
 * 本人の決定: 入れ替えられる場所は全部（部品・見本の中・コードのWidget・通常画面）／画像→動画は自動で再生・音なし・くり返し。
 * 幅・置く位置・押したとき・見た目のクラスは引き継ぐ。
 */
import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'
import { swapImageForVideo, swapVideoForImage } from '../src/app/panels/media-swap.ts'

const VIDEO = 'data:video/mp4;base64,AAAA'
const IMAGE = 'data:image/webp;base64,BBBB'

function box(html: string): Element {
  const { document } = parseHTML(`<!doctype html><html><body><div id="r">${html}</div></body></html>`)
  const root = document.getElementById('r')
  if (root === null) throw new Error('parse failed')
  return root as unknown as Element
}

/** 属性の中身（並び順は見ない） */
const attrs = (el: Element | null): Record<string, string> =>
  Object.fromEntries(Array.from(el?.attributes ?? []).map((attr) => [attr.name, attr.value]))

describe('画像 → 動画', () => {
  it('同じ場所に、自動で再生・音なし・くり返しの動画を置く。見た目のクラス・幅・押したときは引き継ぐ', () => {
    const root = box('<p>前</p><img class="photo lazyload" src="a.png" alt="写真" style="width: 80%" data-nc-go="s2" width="570" height="380" loading="lazy"><p>後</p>')
    const img = root.querySelector('img')
    if (img === null) throw new Error('img')
    const video = swapImageForVideo(img, VIDEO)
    expect(video.tagName).toBe('VIDEO')
    expect(Array.from(root.children).map((el) => el.tagName)).toEqual(['P', 'VIDEO', 'P'])
    expect(attrs(video)).toEqual({
      class: 'photo',
      style: 'width: 80%',
      'data-nc-go': 's2',
      src: VIDEO,
      autoplay: '',
      muted: '',
      loop: '',
      playsinline: '',
      preload: 'metadata',
    })
  })

  it('<picture> の中の画像は、<picture> ごと動画にする（画面の幅で出し分ける <source> は画像用なので残さない）', () => {
    const root = box('<picture class="pic"><source srcset="a.webp" type="image/webp"><img class="photo" src="a.png" alt=""></picture>')
    const img = root.querySelector('img')
    if (img === null) throw new Error('img')
    swapImageForVideo(img, VIDEO)
    expect(root.querySelector('picture')).toBeNull()
    expect(root.querySelector('source')).toBeNull()
    expect(root.querySelector('video')?.getAttribute('class')).toBe('pic photo')
  })
})

describe('動画 → 画像', () => {
  it('同じ場所に画像を置く。再生の設定・<source>・最初の絵は外し、見た目のクラス・幅・押したときは引き継ぐ', () => {
    const root = box(
      '<p>前</p><video class="js-video video__item" style="width: 60%" data-nc-go="s3" autoplay muted loop playsinline controls preload="metadata" poster="p.png" width="570" height="322" data-sb-loop="off"><source src="a.mp4" type="video/mp4"></video>',
    )
    const video = root.querySelector('video')
    if (video === null) throw new Error('video')
    const img = swapVideoForImage(video, IMAGE)
    expect(img.tagName).toBe('IMG')
    expect(Array.from(root.children).map((el) => el.tagName)).toEqual(['P', 'IMG'])
    expect(root.querySelector('source')).toBeNull()
    expect(attrs(img)).toEqual({ class: 'js-video video__item', style: 'width: 60%', 'data-nc-go': 's3', src: IMAGE, alt: '' })
  })
})
