import { describe, it, expect } from 'vitest'
import { withAutoplayVideos } from '../src/app/lp-video.ts'

/** 指示⑬: 動画は常に再生（配信/プレビュー/DLでも）。<video> に自動再生属性を補う。 */
describe('withAutoplayVideos', () => {
  it('<video> に autoplay/muted/loop/playsinline を補う', () => {
    const out = withAutoplayVideos('<video src="x" controls></video>')
    for (const attr of ['autoplay', 'muted', 'loop', 'playsinline', 'controls']) {
      expect(out).toContain(attr)
    }
  })
  it('既にある属性は重複させない', () => {
    const out = withAutoplayVideos('<video src="x" autoplay muted></video>')
    expect((out.match(/autoplay/g) ?? []).length).toBe(1)
    expect((out.match(/muted/g) ?? []).length).toBe(1)
  })
  it('動画以外（img/GIF）は変えない', () => {
    const html = '<img src="a.gif"><p>text</p>'
    expect(withAutoplayVideos(html)).toBe(html)
  })
  it('複数の動画すべてに適用', () => {
    const out = withAutoplayVideos('<video src="a"></video><video src="b"></video>')
    expect((out.match(/autoplay/g) ?? []).length).toBe(2)
  })
})
