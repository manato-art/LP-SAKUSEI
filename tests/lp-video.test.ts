import { describe, it, expect } from 'vitest'
import { withAutoplayVideos } from '../src/app/lp-video.ts'

/** 指示⑬: 動画は常に再生（配信/プレビュー/DLでも）。<video> に自動再生属性を補う。 */
describe('withAutoplayVideos', () => {
  it('<video> に autoplay/muted/loop/playsinline を補う', () => {
    const out = withAutoplayVideos('<video src="x" controls></video>')
    for (const attr of ['autoplay', 'muted', 'loop', 'playsinline']) {
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

/**
 * 2026-10-26 SB本体の検証ページと比べて発覚: SB本体は取り込んだ見本の動画に autoplay/loop を足さない。
 * EBIyon が足すと、見本 18909（動画の上にサムネイル）は読み込み時から再生され、押すと「止める」側に動いていた。
 * 取り込んだ見本（.sb-custom-part）の中の動画は、書かれたままにする。
 */
describe('取り込んだ見本の中の動画は変えない', () => {
  const sbPart = (inner: string): string =>
    `<section class="sb-widget-block" data-widget-block="true"><div id="sb-part-18909" class="sb-custom-part sbtoken"><div class="video__container"><div class="x">${inner}</div></div></div><style data-sb-custom-style="">#sb-part-18909.sbtoken .x{color:red}</style></section>`

  it('取り込んだ見本の <video> には autoplay/loop を足さない', () => {
    const video = '<video muted="true" playsinline="" class="js-video"><source src="a.mp4" type="video/mp4"></video>'
    const html = sbPart(video)
    expect(withAutoplayVideos(html)).toBe(html)
  })

  it('取り込んだ見本の外の動画には、これまで通り足す', () => {
    const out = withAutoplayVideos(`${sbPart('<video src="in"></video>')}<video src="out"></video>`)
    expect(out).toContain('<video src="in"></video>')
    expect(out).toContain('<video src="out" autoplay muted loop playsinline>')
  })
})

/**
 * 自動で再生する動画には、操作ボタン（再生・停止・10秒戻る/進む・全画面）を出さない
 * （2026-10-30 本人「スマホで見るとこんな感じになってしまう。止めるとかなしでOK」）。
 * 編集画面は controls 付きで保存する（media-blots.ts）ので、配信で外す。押さないと再生できない動画には残す。
 */
describe('動画の操作ボタン', () => {
  it('自動で再生する動画には出さない（編集画面が保存した controls="controls" も外す）', () => {
    const saved =
      '<video src="x" controls="controls" playsinline="playsinline" preload="metadata" loop="" autoplay="" muted="muted" style="max-width: 100%;">'
    const out = withAutoplayVideos(saved)
    expect(out).not.toMatch(/(^|\s)controls(\s|=|>)/)
    expect(out).toContain('autoplay')
    expect(out).toContain('style="max-width: 100%;"')
  })

  it('自動再生を切った動画には残す（押さないと再生できない）', () => {
    const out = withAutoplayVideos('<video src="x" controls="controls" muted loop playsinline data-sb-autoplay="off">')
    expect(out).toContain('controls')
    expect(out).not.toMatch(/(^|\s)autoplay(\s|=|>)/)
  })

  it('音ありの動画には残す（ブラウザが自動再生を止めるので、押して再生する）', () => {
    const out = withAutoplayVideos('<video src="x" controls="controls" autoplay loop playsinline data-sb-muted="off">')
    expect(out).toContain('controls')
  })

  it('名前に controls を含むほかの属性は外さない', () => {
    const out = withAutoplayVideos('<video src="x" controls data-nc-controls="1">')
    expect(out).toContain('data-nc-controls="1"')
    expect(out).not.toMatch(/(^|\s)controls(\s|=|>)/)
  })
})
