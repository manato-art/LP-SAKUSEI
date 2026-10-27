/**
 * Versionの編集画面で、画像・動画の位置を 左・中央・右 から選ぶ（2026-10-18 本人「動画や画像の位置も左右で選びたい」）。
 *
 * - 画像は行の中の部品なので、その行を寄せる（Quill の行の align ＝ `ql-align-center` / `ql-align-right`。
 *   今のLPの中央の画像もこの形）。
 * - 動画は1行まるごとの部品なので、動画自身に寄せ方を持たせる（`data-sb-align` と左右の余白）。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'
import {
  applyImageAlign,
  applyVideoAlign,
  imageAlignOf,
  keepAlignOnResize,
  lineAlignOf,
  videoAlignOf,
} from '../src/app/panels/media-align.ts'

const dom = (body: string): Document => {
  const { window } = parseHTML(`<!doctype html><html><body>${body}</body></html>`)
  const g = globalThis as unknown as Record<string, unknown>
  g['document'] = window.document
  g['Event'] = window.Event
  return window.document as unknown as Document
}

describe('画像の位置＝その行の寄せ方', () => {
  it('左は寄せを外す・中央と右は Quill の行の寄せ', () => {
    expect(lineAlignOf('left')).toBe(false)
    expect(lineAlignOf('center')).toBe('center')
    expect(lineAlignOf('right')).toBe('right')
  })

  it('今の位置を、画像のある行から読む', () => {
    const doc = dom(
      '<div class="ql-editor"><p class="ql-align-right"><img id="r"></p><p class="ql-align-center"><a><img id="c"></a></p><p><img id="l"></p></div>',
    )
    expect(imageAlignOf(doc.getElementById('r') as unknown as HTMLImageElement)).toBe('right')
    expect(imageAlignOf(doc.getElementById('c') as unknown as HTMLImageElement)).toBe('center')
    expect(imageAlignOf(doc.getElementById('l') as unknown as HTMLImageElement)).toBe('left')
  })

  it('Widget の中の画像は選べない（Widget は Widget編集で直す）', () => {
    const doc = dom('<div class="ql-editor"><section class="sb-widget-block"><div><img id="w"></div></section></div>')
    expect(imageAlignOf(doc.getElementById('w') as unknown as HTMLImageElement)).toBeNull()
  })
})

/**
 * 本人「配置変わらない」（2026-10-18）: 大きさをつまんで変えた画像は、画像自身に
 * `display:block; margin-left:auto; margin-right:auto`（真ん中）が付いていて、行を寄せても動かなかった。
 * 欄も実際（真ん中）と違う「左」が光っていた。
 */
describe('大きさを変えた画像（画像自身に余白で位置が付いている）', () => {
  const BLOCK = 'width: 405px; height: auto; display: block; margin-left: auto; margin-right: auto;'
  const img = (line: string, style: string): HTMLImageElement => {
    const doc = dom(`<div class="ql-editor"><p${line}><img id="i" style="${style}"></p></div>`)
    return doc.getElementById('i') as unknown as HTMLImageElement
  }

  it('今の位置は画像自身の余白から読む（行が左でも真ん中なら「中央」）', () => {
    expect(imageAlignOf(img('', BLOCK))).toBe('center')
  })

  it('右・左を選ぶと画像自身の余白を変える（幅はそのまま）', () => {
    const i = img('', BLOCK)
    applyImageAlign(i, 'right')
    expect([i.style.marginLeft, i.style.marginRight]).toEqual(['auto', '0px'])
    expect(imageAlignOf(i)).toBe('right')
    applyImageAlign(i, 'left')
    expect([i.style.marginLeft, i.style.marginRight]).toEqual(['0px', 'auto'])
    expect(imageAlignOf(i)).toBe('left')
    expect(i.style.width).toBe('405px')
  })

  it('大きさを変えていない画像は余白を付けない（行の寄せで動く）', () => {
    const i = img(' class="ql-align-center"', '')
    applyImageAlign(i, 'right')
    expect(i.getAttribute('style') ?? '').toBe('')
  })
})

describe('大きさをつまんで変えても、今の位置を保つ', () => {
  it('右に寄せた行の画像は、塊にしても右のまま（以前は必ず真ん中になった）', () => {
    const doc = dom('<div class="ql-editor"><p class="ql-align-right"><img id="i"></p></div>')
    const i = doc.getElementById('i') as unknown as HTMLImageElement
    keepAlignOnResize(i)
    expect([i.style.display, i.style.marginLeft, i.style.marginRight]).toEqual(['block', 'auto', '0px'])
  })

  it('左の行の画像は左のまま・もう余白で右にした画像は右のまま', () => {
    const doc = dom(
      '<div class="ql-editor"><p><img id="l"></p><p><img id="r" style="display: block; margin-left: auto; margin-right: 0px;"></p></div>',
    )
    const l = doc.getElementById('l') as unknown as HTMLImageElement
    const r = doc.getElementById('r') as unknown as HTMLImageElement
    keepAlignOnResize(l)
    keepAlignOnResize(r)
    expect(imageAlignOf(l)).toBe('left')
    expect(imageAlignOf(r)).toBe('right')
  })

  it('動画は選んだ位置のまま', () => {
    const doc = dom('<div class="ql-editor"><video id="v" data-sb-align="right"></video></div>')
    const v = doc.getElementById('v') as unknown as HTMLVideoElement
    keepAlignOnResize(v)
    expect(videoAlignOf(v)).toBe('right')
    expect([v.style.marginLeft, v.style.marginRight]).toEqual(['auto', '0px'])
  })

  it('大きさのつまみは、真ん中の余白を決め打ちで付けない', () => {
    const src = readFileSync('src/app/panels/image-resize.ts', 'utf8')
    expect(src).not.toContain("img.style.marginLeft = 'auto'")
    expect(src).toContain('keepAlignOnResize(img)')
  })
})

describe('動画の位置＝動画自身の左右の余白', () => {
  const video = (): HTMLVideoElement => {
    const doc = dom('<div class="ql-editor"><video src="a.mp4" style="width: 300px;"></video></div>')
    return doc.querySelector('video') as unknown as HTMLVideoElement
  }

  it('中央・右は印と余白を付ける（配信でも同じ位置）', () => {
    const v = video()
    applyVideoAlign(v, 'center')
    expect(v.getAttribute('data-sb-align')).toBe('center')
    expect(v.style.marginLeft).toBe('auto')
    expect(v.style.marginRight).toBe('auto')
    expect(v.style.display).toBe('block')
    expect(videoAlignOf(v)).toBe('center')

    applyVideoAlign(v, 'right')
    expect(v.style.marginLeft).toBe('auto')
    expect(v.style.marginRight).toBe('0px')
    expect(videoAlignOf(v)).toBe('right')
  })

  it('左は印と余白を外す（今までと同じ＝左）・幅はそのまま', () => {
    const v = video()
    applyVideoAlign(v, 'right')
    applyVideoAlign(v, 'left')
    expect(v.hasAttribute('data-sb-align')).toBe(false)
    expect(v.style.marginLeft).toBe('')
    expect(v.style.marginRight).toBe('')
    expect(v.style.width).toBe('300px')
    expect(videoAlignOf(v)).toBe('left')
  })

  it('印の無い動画でも、大きさを変えたときの真ん中の余白があれば「中央」', () => {
    const doc = dom('<div class="ql-editor"><video id="v" style="display: block; margin-left: auto; margin-right: auto;"></video></div>')
    expect(videoAlignOf(doc.getElementById('v') as unknown as HTMLVideoElement)).toBe('center')
  })

  it('知らない印は左として読む', () => {
    const v = video()
    v.setAttribute('data-sb-align', 'ななめ')
    expect(videoAlignOf(v)).toBe('left')
  })
})

describe('「配置」のボタン（左・中央・右）', () => {
  it('3つのボタン。押すとその位置を知らせ、今の位置が光る', async () => {
    dom('')
    const { buildMediaAlignGroup, syncMediaAlign } = await import('../src/app/panels/properties-media-align.ts')
    const picked: string[] = []
    const el = buildMediaAlignGroup((align) => picked.push(align))
    const buttons = [...el.querySelectorAll<HTMLButtonElement>('button')]
    expect(el.querySelector('.sb-pg-title')?.textContent).toBe('配置')
    expect(buttons.map((b) => b.title)).toEqual(['左に寄せる', '中央に置く', '右に寄せる'])
    buttons[2]?.click()
    expect(picked).toEqual(['right'])
    syncMediaAlign(el, 'center')
    expect(buttons.map((b) => b.classList.contains('active'))).toEqual([false, true, false])
    expect(el.style.display).not.toBe('none')
    syncMediaAlign(el, null)
    expect(el.style.display).toBe('none')
  })
})

describe('画像・動画の右の欄への組み込み', () => {
  it('画像: 「サイズ」の下に配置。押すと画像のある行を寄せ、選び直したときに今の位置を出す', () => {
    const src = readFileSync('src/app/panels/properties-image.ts', 'utf8')
    expect(src).toContain('buildMediaAlignGroup(')
    expect(src).toMatch(/quill\.formatLine\(index, 1, 'align', lineAlignOf\(align\), 'user'\)/)
    expect(src).toContain('applyImageAlign(img, align)')
    expect(src).toContain('notifyEditorChanged(quill.root)')
    expect(src).toMatch(/previewGroup, srcRow, altRow, sizeGroup, alignGroup,/)
    expect(src).toMatch(/syncMediaAlign\(alignEl, imageAlignOf\(img\)\)/)
  })

  it('動画: 「サイズ」の下に配置。押すと動画自身を寄せる', () => {
    const src = readFileSync('src/app/panels/properties-video.ts', 'utf8')
    expect(src).toMatch(/withVideo\(\(video\) => applyVideoAlign\(video, align\)\)/)
    expect(src).toMatch(/sizeGroup, alignGroup,/)
    expect(src).toContain('syncMediaAlign(alignGroup, videoAlignOf(video))')
  })

  it('動画の部品は寄せ方も覚える（戻す・やり直す・貼り付けで消えない）', () => {
    const blots = readFileSync('src/app/panels/media-blots.ts', 'utf8')
    expect(blots).toMatch(/applyVideoAlign\(node, /)
    expect(blots).toMatch(/align: videoAlignOf\(node\)/)
  })
})
