/**
 * 画像の欄にも動画の欄にも、画像・動画のどちらでも入る（2026-10-27 本人「背景を追加とかで、画像を入れられる場所は画像と動画の両方、
 * 動画を入れられる所も画像を入れられる。動画でも画像でも入ればいい」）。本人の決定: 動画は自動で再生・音なし・くり返し。
 * 背景の動画は面のいちばん後ろの層（.nc-bgv）で、位置・大きさは背景の画像と同じ数字で決める。
 */
import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'
import { readBlockFromCanvas } from '../src/app/panels/nocode/canvas-sync.ts'
import { bgCss, bgVideoDeclarations, bgVideoLayer, usesFreeBg, withBlockBgVideo } from '../src/app/panels/nocode/templates/bg-image.ts'
import { BUILDER_TEMPLATE } from '../src/app/panels/nocode/templates/builder.ts'
import { isVideoMedia, mediaTag, safeMedia } from '../src/app/panels/nocode/templates/kit.ts'
import type { ItemData } from '../src/app/panels/nocode/templates/types.ts'

const PNG = `data:image/png;base64,${'A'.repeat(40)}`
const MP4 = `data:video/mp4;base64,${'B'.repeat(40)}`
const UID = 'nc-media001'

const renderBlocks = (blocks: readonly ItemData[], extra: ItemData = {}): string =>
  BUILDER_TEMPLATE.render({ ...BUILDER_TEMPLATE.defaults(new Date(0)), ...extra, screens: [{ id: 's1', name: '画面①', blocks }] }, UID)

/** 書き出したHTMLの中の要素（CSS・スクリプトは見ない） */
function body(html: string): Element {
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`)
  return document.body as unknown as Element
}

describe('画像か動画かの見分け', () => {
  it('画像も動画も通し、それ以外は空にする。動画は自動で再生・音なし・くり返しで出す', () => {
    expect(safeMedia(PNG)).toBe(PNG)
    expect(safeMedia(MP4)).toBe(MP4)
    expect(safeMedia('/uploads/' + 'a'.repeat(64) + '.webm')).not.toBe('')
    expect(safeMedia('javascript:alert(1)')).toBe('')
    expect(isVideoMedia(MP4)).toBe(true)
    expect(isVideoMedia(PNG)).toBe(false)
    expect(mediaTag(MP4, { cls: 'x' })).toBe(`<video class="x" src="${MP4}" autoplay muted loop playsinline preload="metadata"></video>`)
    expect(mediaTag(PNG, { alt: '"写真"' })).toBe(`<img src="${PNG}" alt="&quot;写真&quot;">`)
  })
})

describe('部品の画像・動画の欄', () => {
  it('画像の部品に動画を選ぶと動画で出る（幅の指定も動画に効く）。保存の前の確かめも通る', () => {
    const html = renderBlocks([{ type: 'image', image: MP4, alt: '', action: 'none', width: 60 }])
    const video = body(html).querySelector('.nc-b-image video')
    expect(video?.getAttribute('src')).toBe(MP4)
    for (const flag of ['autoplay', 'muted', 'loop', 'playsinline']) expect(video?.hasAttribute(flag), flag).toBe(true)
    expect(html).toMatch(/\.nc-b-1 video\{width:60%;/)
    expect(BUILDER_TEMPLATE.validate({ ...BUILDER_TEMPLATE.defaults(new Date(0)), screens: [{ id: 's1', name: '画面①', blocks: [{ type: 'image', image: MP4 }] }] }, new Date(0))).toBeNull()
  })

  it('動画の部品に画像を選ぶと画像で出る（動画の部品の幅・置く位置のまま）', () => {
    const html = renderBlocks([{ type: 'video', video: PNG, autoplay: true, action: 'none', width: 70 }])
    const root = body(html)
    expect(root.querySelector('.nc-b-video video')).toBeNull()
    expect(root.querySelector('.nc-b-video img.nc-b-video__v')?.getAttribute('src')).toBe(PNG)
    expect(html).toContain('.nc-b-1 .nc-b-video__v{width:70%;')
  })

  it('画像と文章・画像を並べる・画像に文字・ビフォーアフター・写真・人物の写真にも動画が入る', () => {
    const html = renderBlocks([
      { type: 'imageText', image: MP4, heading: '見出し', text: '文' },
      { type: 'gallery', image1: MP4, image2: PNG },
      { type: 'cover', image: MP4, heading: '見出し', text: '' },
      { type: 'beforeAfter', before: MP4, after: PNG },
      { type: 'quote', text: '良い', photo: MP4, name: '名前' },
      { type: 'profile', name: '名前', text: '文', photo: MP4 },
      { type: 'speech', text: 'こんにちは', avatar: MP4 },
    ])
    const root = body(html)
    for (const where of ['.nc-b-imageText__img', '.nc-b-gallery__cell', '.nc-b-cover__bg', '.nc-b-beforeAfter__img', '.nc-b-quote__who', '.nc-b-profile__photo', '.nc-b-speech__face']) {
      expect(root.querySelector(`${where} video`)?.getAttribute('src'), where).toBe(MP4)
    }
    // 画像向けの見た目（丸く切る・覆う）は動画にも当てる
    expect(html).toContain(`.nc-b-profile__photo video{width:100%;height:100%;object-fit:cover}`)
  })

  it('「画像を大きく表示」に動画を選ぶと、操作ボタン付きの動画を大きく出す', () => {
    const html = renderBlocks([{ type: 'button', label: '見る', action: 'image', actImage: MP4 }])
    const pop = body(html).querySelector('.nc-pops video.nc-pop__video')
    expect(pop?.getAttribute('src')).toBe(MP4)
    expect(pop?.hasAttribute('controls')).toBe(true)
  })
})

describe('背景の動画', () => {
  const look = { bgImage: MP4, bgFit: 'free', bgSize: 150, bgX: 20, bgY: 80 }

  it('ボタンの背景に動画を選ぶと、押す所のいちばん後ろに動画の層が入る（文字はその上）', () => {
    const html = renderBlocks([{ type: 'button', label: '申し込む', color: '#E5573F', action: 'none', bgImage: MP4 }])
    const anchor = body(html).querySelector('.nc-b-button__a')
    const layer = anchor?.firstElementChild
    expect(layer?.className).toBe('nc-bgv')
    expect(layer?.getAttribute('aria-hidden')).toBe('true')
    const video = layer?.querySelector('video')
    expect(video?.getAttribute('src')).toBe(MP4)
    for (const flag of ['autoplay', 'muted', 'loop', 'playsinline']) expect(video?.hasAttribute(flag), flag).toBe(true)
    // CSS の背景の画像にはしない（動画は CSS の背景にできない）
    expect(html).not.toContain(`url("${MP4}")`)
    expect(html).toContain(`:where(.${UID} .nc-b-1 .nc-b-button__a){position:relative;isolation:isolate}`)
    expect(html).toContain(`.${UID} .nc-b-1 .nc-b-button__a>.nc-bgv{position:absolute;inset:0;overflow:hidden;border-radius:inherit;z-index:-1;pointer-events:none}`)
  })

  it('見出しなど部品そのものが面の部品は、部品のいちばん外の要素の中に入る', () => {
    const html = renderBlocks([{ type: 'heading', text: '見出し', bgImage: MP4 }])
    expect(body(html).querySelector('h2.nc-b-heading > .nc-bgv > video')).not.toBeNull()
  })

  it('Widget全体・画面ごとの背景にも動画を敷ける', () => {
    const html = BUILDER_TEMPLATE.render(
      { ...BUILDER_TEMPLATE.defaults(new Date(0)), bgImage: MP4, screens: [{ id: 's1', name: '画面①', bgImage: MP4, blocks: [{ type: 'text', text: '文' }] }] },
      UID,
    )
    const root = body(html)
    expect(root.querySelector(`.${UID} > .nc-bgv > video`)).not.toBeNull()
    expect(root.querySelector('[data-nc-screen="s1"] > .nc-bgv > video')).not.toBeNull()
  })

  it('見本の中の箱の背景の動画は、印の付いた要素の中に入る', () => {
    const block: ItemData = { type: 'sample', html: '<div class="card" data-nc-bg="b1"><p>中身</p></div>', bgs: [{ id: 'b1', bgImage: MP4 }] }
    const out = withBlockBgVideo(block, '<div class="nc-b nc-b-sample nc-b-1"><div class="card" data-nc-bg="b1"><p>中身</p></div></div>')
    expect(body(out).querySelector('[data-nc-bg="b1"] > .nc-bgv > video')?.getAttribute('src')).toBe(MP4)
  })

  it('位置と大きさは背景の画像と同じ数字（位置＝object-position、大きさ＝覆う大きさに対する%）。配信で測るスクリプトは要らない', () => {
    expect(bgVideoDeclarations({ image: MP4, fit: 'free', size: 150, x: 20, y: 80 })).toEqual({
      'object-position': '20% 80%',
      'transform-origin': '20% 80%',
      transform: 'scale(1.5)',
    })
    expect(bgVideoDeclarations({ image: MP4, fit: 'cover', size: 150, x: 50, y: 50 }).transform).toBe('none')
    expect(bgCss('.w', look)).toContain('.w>.nc-bgv>video{position:absolute;inset:0;width:100%;height:100%;max-width:none;margin:0;object-fit:cover;object-position:20% 80%;transform-origin:20% 80%;transform:scale(1.5)}')
    expect(usesFreeBg({ screens: [{ id: 's1', ...look }] })).toBe(false)
    expect(usesFreeBg({ screens: [{ id: 's1', ...look, bgImage: PNG }] })).toBe(true)
  })

  it('画像の背景は今までどおり CSS の背景（層は入れない）', () => {
    expect(bgVideoLayer({ bgImage: PNG })).toBe('')
    expect(bgCss('.w', { bgImage: PNG })).toContain(`background-image:url("${PNG}")!important`)
  })

  it('見たまま画面で文字を打ち直しても、背景の動画の層は文字・見本の中身に混ざらない', () => {
    const { document, window } = parseHTML(
      '<!doctype html><html><body>' +
        `<h2 class="nc-b nc-b-heading nc-b-1">${bgVideoLayer({ bgImage: MP4 })}見出し</h2>` +
        `<div class="nc-b nc-b-sample nc-b-2"><div data-nc-bg="b1">${bgVideoLayer({ bgImage: MP4 })}<p>中身</p></div></div>` +
        '</body></html>',
    )
    const g = globalThis as unknown as Record<string, unknown>
    g['Node'] = window.Node
    g['HTMLElement'] = window.HTMLElement
    const [heading, sample] = Array.from(document.body.children) as unknown as HTMLElement[]
    if (heading === undefined || sample === undefined) throw new Error('parse')
    expect(readBlockFromCanvas(heading, { type: 'heading', text: 'x' })).toEqual({ type: 'heading', text: '見出し' })
    const read = readBlockFromCanvas(sample, { type: 'sample', html: '<div data-nc-bg="b1"><p>中身</p></div>' })
    expect(String(read?.['html'])).not.toContain('nc-bgv')
    expect(String(read?.['html'])).toContain('<p>中身</p>')
  })
})
