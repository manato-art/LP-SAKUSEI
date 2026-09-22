import { describe, expect, it } from 'vitest'
import { IMAGE_PLACEHOLDER, VIDEO_POSTER_PLACEHOLDER, replaceLostMedia } from '../tools/widget-library-fix/lost-media.ts'

/**
 * SBが持っていた画像・動画（匿名化で `…example.test/uploads/…` になったもの）は元に戻せない。
 * 壊れた画像のマークのまま見本に出さず、ほかの見本と同じ灰色の「画像」「動画」の仮の絵にする。
 */
describe('戻せない画像・動画を仮の絵にする', () => {
  it('img の src と srcset', () => {
    const html =
      '<img src="https://sample80.example.test/uploads/article_photo/photo/1/sample_token_00aa.png" ' +
      'srcset="https://sample80.example.test/uploads/a.webp 1x, https://sample80.example.test/uploads/b.webp 2x" alt="商品">'
    expect(replaceLostMedia(html)).toBe(`<img src="${IMAGE_PLACEHOLDER}" alt="商品">`)
  })

  it('スキームの無い example.test/uploads も（LPでは相対パスになって読めない）', () => {
    expect(replaceLostMedia('<img src="example.test/uploads/x.avif">')).toBe(`<img src="${IMAGE_PLACEHOLDER}">`)
  })

  it('picture の source は外す（仮の絵の img が出る）', () => {
    const html =
      '<picture><source srcset="https://sample92.example.test/uploads/a.avif" type="image/avif">' +
      '<img src="https://sample92.example.test/uploads/a.png"></picture>'
    expect(replaceLostMedia(html)).toBe(`<picture><img src="${IMAGE_PLACEHOLDER}"></picture>`)
  })

  it('動画は読み込み先を外して「動画」の仮の絵を表紙にする', () => {
    expect(replaceLostMedia('<video src="https://sample80.example.test/uploads/v.mp4" autoplay muted playsinline></video>')).toBe(
      `<video autoplay muted playsinline poster="${VIDEO_POSTER_PLACEHOLDER}"></video>`,
    )
    expect(
      replaceLostMedia('<video poster="https://sample80.example.test/uploads/p.jpg" muted><source src="https://sample80.example.test/uploads/v.mp4" type="video/mp4"></video>'),
    ).toBe(`<video poster="${VIDEO_POSTER_PLACEHOLDER}" muted></video>`)
  })

  it('スクリプトが差し替えに使う画像（data-img 等）も', () => {
    expect(replaceLostMedia('<li data-img="https://sample80.example.test/uploads/c.png">')).toBe(`<li data-img="${IMAGE_PLACEHOLDER}">`)
  })

  it('SBの外の画像・データURL・ほかの属性は触らない', () => {
    const keep = [
      '<img src="data:image/svg+xml,%3Csvg%3E%3C/svg%3E" alt="">',
      '<img src="https://cdn.jsdelivr.net/npm/x/a.png">',
      '<a href="https://sample09.example.test/ab_tests/UID_1/articles">',
      '<div style="background:url(https://sample80.example.test/uploads/bg.png)">',
    ]
    for (const html of keep) expect(replaceLostMedia(html)).toBe(html)
  })

  it('2回かけても同じ', () => {
    const once = replaceLostMedia('<video src="https://sample80.example.test/uploads/v.mp4"></video>')
    expect(replaceLostMedia(once)).toBe(once)
  })
})
