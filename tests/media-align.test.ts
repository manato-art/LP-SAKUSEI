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
  applyVideoAlign,
  imageAlignOf,
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
    expect(src).toMatch(/previewGroup, srcRow, altRow, sizeGroup, alignGroup,/)
    expect(src).toMatch(/syncMediaAlign\(alignEl, imageAlignOf\(img\)\)/)
  })

  it('動画: 「サイズ」の下に配置。押すと動画自身を寄せる', () => {
    const src = readFileSync('src/app/panels/properties-video.ts', 'utf8')
    expect(src).toMatch(/withVideo\(\(video\) => applyVideoAlign\(video, align\)\)/)
    expect(src).toMatch(/container\.append\(srcRow, sizeGroup, alignGroup, playGroup, actionGroup\)/)
    expect(src).toContain('syncMediaAlign(alignGroup, videoAlignOf(video))')
  })

  it('動画の部品は寄せ方も覚える（戻す・やり直す・貼り付けで消えない）', () => {
    const blots = readFileSync('src/app/panels/media-blots.ts', 'utf8')
    expect(blots).toMatch(/applyVideoAlign\(node, /)
    expect(blots).toMatch(/align: videoAlignOf\(node\)/)
  })
})
