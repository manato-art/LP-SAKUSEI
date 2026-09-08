import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  hasFlag,
  isLooping,
  toggleFlag,
  toggleLoop,
  willBlockAutoplay,
  type LoopTarget,
} from '../src/app/panels/video-controls.ts'

/** DOMを使わずに `<video>` の属性まわりだけを真似た代役 */
function fakeVideo(flags: readonly string[] = ['loop']): LoopTarget {
  const attrs = new Set<string>(flags)
  return {
    loop: attrs.has('loop'),
    autoplay: attrs.has('autoplay'),
    muted: attrs.has('muted'),
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
    video = fakeVideo(['loop'])
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

describe('自動再生とミュート', () => {
  it('自動再生を入れ替えられる', () => {
    const v = fakeVideo([])
    expect(toggleFlag(v, 'autoplay')).toBe(true)
    expect(v.autoplay).toBe(true)
    expect(toggleFlag(v, 'autoplay')).toBe(false)
    expect(v.hasAttribute('autoplay')).toBe(false)
  })

  it('ミュートを入れ替えられる', () => {
    const v = fakeVideo(['muted'])
    expect(hasFlag(v, 'muted')).toBe(true)
    expect(toggleFlag(v, 'muted')).toBe(false)
    expect(v.muted).toBe(false)
  })

  it('自動再生ONのままミュートを切ると、ブラウザに止められると分かる', () => {
    const v = fakeVideo(['autoplay', 'muted'])
    expect(willBlockAutoplay(v)).toBe(false)
    toggleFlag(v, 'muted')
    expect(willBlockAutoplay(v)).toBe(true)
  })

  it('自動再生が切ってあれば、音ありでも止められない', () => {
    expect(willBlockAutoplay(fakeVideo([]))).toBe(false)
  })
})

describe('複製', () => {
  const src = readFileSync('src/app/panels/video-controls.ts', 'utf8')

  it('すぐ下に置く（離れた場所に増えない）', () => {
    expect(src).toContain("insertAdjacentElement('afterend', copy)")
  })

  it('クローンは属性しか引き継がないので、再生まわりのプロパティを揃え直す', () => {
    expect(src).toContain("copy.loop = video.hasAttribute('loop')")
    expect(src).toContain("copy.autoplay = video.hasAttribute('autoplay')")
    expect(src).toContain("copy.muted = video.hasAttribute('muted')")
  })
})

describe('保存・復元でループ設定が戻らない', () => {
  const src = readFileSync('src/app/panels/media-blots.ts', 'utf8')
  const blot = src.slice(src.indexOf("static blotName = 'sbvideo'"), src.indexOf("class SbWidgetBlot"))

  it('value はループ・自動再生・ミュートの3つを返す', () => {
    for (const name of ['loop', 'autoplay', 'muted']) {
      expect(blot).toContain(`${name}: flag('${name}')`)
    }
  })

  it('create は切った設定を付け直さない（off のときは付けない）', () => {
    expect(blot).toContain("if (loop) node.setAttribute('loop', 'loop')")
    expect(blot).toContain("if (autoplay) node.setAttribute('autoplay', 'autoplay')")
    expect(blot).toContain("if (muted) node.setAttribute('muted', 'muted')")
  })

  it('古い保存データ（src文字列だけ）は指示⑬の既定で復元する', () => {
    expect(blot).toContain("typeof value === 'string' ? true")
  })
})

describe('右パネルの動画プロパティ', () => {
  const panel = readFileSync('src/app/panels/properties-video.ts', 'utf8')
  const props = readFileSync('src/app/panels/properties-panel.ts', 'utf8')
  const resize = readFileSync('src/app/panels/image-resize.ts', 'utf8')

  it('動画をクリックすると右パネルが動画モードになる', () => {
    expect(props).toContain("target.tagName === 'VIDEO'")
    expect(props).toContain('showVideoMode(target as HTMLVideoElement)')
  })

  it('再生設定・サイズ・複製を出す', () => {
    for (const label of ['ループ再生', '自動再生', 'ミュート', 'サイズ']) {
      expect(panel, `${label} が無い`).toContain(label)
    }
    expect(panel).toContain('duplicateVideo(video)')
  })

  it('変更後に Quill へ知らせる（保存はDOMから直列化される）', () => {
    expect(panel).toContain('deps.quill.update()')
  })

  it('「幅いっぱい」は幅を消すのではなく100%にする（消すだけだと何も起きないように見える）', () => {
    expect(panel).toContain("video.style.width = '100%'")
    expect(panel).not.toContain("video.style.width = ''")
  })

  it('差し替えは中身だけ入れ替え、大きさと再生設定は残す', () => {
    const swap = panel.slice(panel.indexOf('動画を差し替える'))
    expect(swap).toContain("picker.accept = 'video/*'")
    expect(swap).toContain('video.load()')
    // 幅や再生設定を触っていないこと
    expect(swap).not.toContain('removeAttribute(\'width\')')
    expect(swap).not.toContain('toggleFlag(')
  })

  it('動画以外のファイルを選んだら断る', () => {
    expect(panel).toContain("!file.type.startsWith('video/')")
  })

  it('音ありの自動再生になったら注意を出す（黙って効かないままにしない）', () => {
    expect(panel).toContain('willBlockAutoplay(video)')
  })

  it('動画も画像と同じリサイズ枠が出る', () => {
    expect(resize).toContain("target.tagName === 'VIDEO'")
    expect(resize).toContain('HTMLImageElement | HTMLVideoElement')
  })

  it('動画では preventDefault しない（再生操作を邪魔しない）', () => {
    const videoBranch = resize.slice(resize.indexOf("target.tagName === 'VIDEO'"))
    expect(videoBranch.slice(0, 260)).not.toContain('e.preventDefault()')
  })
})
