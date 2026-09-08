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

/**
 * エディタの右パネルで切った設定が、配信LPで復活しないこと。
 * 既定は「常に再生」（指示⑬）だが、切ったものには `data-sb-<名前>="off"` が入る。
 */
describe('エディタで切った再生設定を尊重する', () => {
  it('ループを切った動画には loop を付けない', () => {
    const out = withAutoplayVideos('<video src="x" data-sb-loop="off"></video>')
    expect(/(^|\s)loop(\s|=|>)/.test(out)).toBe(false)
    // 他の項目は既定どおり付く
    expect(out).toContain('autoplay')
    expect(out).toContain('muted')
  })

  it('印があれば、既に付いている loop も外す', () => {
    const out = withAutoplayVideos('<video src="x" loop data-sb-loop="off"></video>')
    expect(/(^|\s)loop(\s|=|>)/.test(out)).toBe(false)
  })

  it('自動再生・ミュートも同じように切れる', () => {
    const out = withAutoplayVideos(
      '<video src="x" data-sb-autoplay="off" data-sb-muted="off"></video>',
    )
    expect(/(^|\s)autoplay(\s|=|>)/.test(out)).toBe(false)
    expect(/(^|\s)muted(\s|=|>)/.test(out)).toBe(false)
    expect(out).toContain('loop')
  })

  it('印が無い動画（トグルを作る前の保存分）は今までどおり常に再生', () => {
    const out = withAutoplayVideos('<video src="x"></video>')
    for (const attr of ['autoplay', 'muted', 'loop', 'playsinline']) {
      expect(out, attr).toContain(attr)
    }
  })

  it('data-anim-loop があっても loop 属性は正しく付く（名前の部分一致で誤判定しない）', () => {
    const out = withAutoplayVideos('<video src="x" data-anim-loop="3"></video>')
    expect(/(^|\s)loop(\s|=|>)/.test(out)).toBe(true)
  })
})
