import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { isLooping, toggleLoop, type LoopTarget } from '../src/app/panels/video-controls.ts'

/** DOMを使わずに `<video>` の属性まわりだけを真似た代役 */
function fakeVideo(initialLoop: boolean): LoopTarget {
  const attrs = new Set<string>(initialLoop ? ['loop'] : [])
  return {
    loop: initialLoop,
    hasAttribute: (n) => attrs.has(n),
    setAttribute: (n) => attrs.add(n),
    removeAttribute: (n) => attrs.delete(n),
  }
}

/**
 * キャンバスに置いた動画のループ再生切り替え。
 *
 * 動画は挿入時「常に再生（自動再生＋ループ）」で入る（指示⑬）。
 * それを後から切れるようにしたので、**切った状態が保存・復元で戻らない**ことを押さえる。
 */
describe('ループ再生の切り替え', () => {
  let video: LoopTarget

  beforeEach(() => {
    video = fakeVideo(true)
  })

  it('挿入直後はループON', () => {
    expect(isLooping(video)).toBe(true)
  })

  it('押すとOFFになり、属性もプロパティも落ちる', () => {
    expect(toggleLoop(video)).toBe(false)
    expect(video.hasAttribute('loop')).toBe(false)
    expect(video.loop).toBe(false)
  })

  it('もう一度押すとONに戻る', () => {
    toggleLoop(video)
    expect(toggleLoop(video)).toBe(true)
    expect(video.hasAttribute('loop')).toBe(true)
    expect(video.loop).toBe(true)
  })

  it('属性だけでなく DOM プロパティも変える（属性だけだと再生中に効かない環境がある）', () => {
    toggleLoop(video)
    expect(video.loop).toBe(false)
  })
})

describe('保存・復元でループ設定が戻らない', () => {
  const src = readFileSync('src/app/panels/media-blots.ts', 'utf8')
  const blot = src.slice(src.indexOf("static blotName = 'sbvideo'"), src.indexOf("class SbWidgetBlot"))

  it('value は src とループ状態を返す（src だけだと設定が消える）', () => {
    expect(blot).toContain("loop: node.hasAttribute('loop') ? 'on' : 'off'")
  })

  it('create は毎回ループを付け直さない（off のときは付けない）', () => {
    expect(blot).toContain("if (loop !== 'off') node.setAttribute('loop', 'loop')")
  })

  it('古い保存データ（src文字列だけ）はこれまで通りループONで復元する', () => {
    expect(blot).toContain("typeof value === 'string' ? 'on'")
  })
})

describe('切り替えバー', () => {
  const src = readFileSync('src/app/panels/video-controls.ts', 'utf8')

  it('動画のクリックで出す', () => {
    expect(src).toContain("target.tagName === 'VIDEO'")
  })

  it('変更後に Quill へ知らせる（保存はDOMから直列化される）', () => {
    expect(src).toContain('quill.update()')
  })

  it('絵文字ではなくSVGアイコンを使う', () => {
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u
    expect(emoji.test(src)).toBe(false)
    expect(src).toContain('<svg')
  })
})
