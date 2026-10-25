/**
 * 「大きさを自分で決める」背景の画像を、配信のLPで枠いっぱいに覆う大きさに対して%にする（2026-10-25 本人「スマホで確認すると、
 * 画像入れるところがおかしい」＝スマホで細くなったボタンの上下に色が出た）。
 *
 * CSSだけでは「枠いっぱいに覆う大きさ×%」を書けない（横幅に対する%しか書けない）ので、配信で動く小さなスクリプトが
 * 枠と画像の大きさを測って px で当てる。印は --nc-bgfree（大きさ%）。ここでは DOM の代わりを作って、スクリプトの文を動かす。
 */
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { BG_FIT_SCRIPT } from '../src/app/panels/nocode/templates/bg-fit-script.ts'

interface FakeEl {
  offsetWidth: number
  offsetHeight: number
  vars: Record<string, string>
  bg: string
  inEditor?: boolean
  set: Record<string, [string, string]>
  style: { setProperty: (name: string, value: string, priority: string) => void; removeProperty: (name: string) => void }
  closest: (selector: string) => unknown
}

function el(over: Partial<Pick<FakeEl, 'offsetWidth' | 'offsetHeight' | 'vars' | 'bg' | 'inEditor'>> = {}): FakeEl {
  const set: Record<string, [string, string]> = {}
  const self: FakeEl = {
    offsetWidth: 0,
    offsetHeight: 0,
    vars: {},
    bg: 'none',
    ...over,
    set,
    style: {
      setProperty: (name, value, priority) => (set[name] = [value, priority]),
      removeProperty: (name) => delete set[name],
    },
    closest: (selector) => (selector === '.ql-editor' && self.inEditor === true ? {} : null),
  }
  return self
}

/** 画像の元の大きさ（読み込むとすぐ onload） */
const NATURAL: Record<string, [number, number]> = { 'https://lp.test/uploads/a.png': [460, 168] }

function run(root: FakeEl, children: readonly FakeEl[]): { resize: () => void; refit: () => void; observed: unknown[] } {
  const observed: unknown[] = []
  let onResize = (): void => undefined
  class FakeImage {
    naturalWidth = 0
    naturalHeight = 0
    onload: (() => void) | null = null
    set src(value: string) {
      const size = NATURAL[value]
      if (size === undefined) return
      this.naturalWidth = size[0]
      this.naturalHeight = size[1]
      this.onload?.()
    }
  }
  class FakeResizeObserver {
    constructor(callback: () => void) {
      onResize = callback
    }
    observe(target: unknown): void {
      observed.push(target)
    }
    disconnect(): void {
      observed.length = 0
    }
  }
  const all = [root, ...children]
  const fakeRoot = Object.assign(root, {
    querySelectorAll: (selector: string) => (selector === '*' ? children : []),
    addEventListener: () => undefined,
  })
  runInNewContext(BG_FIT_SCRIPT, {
    document: { querySelectorAll: (selector: string) => (selector === '[data-nc-bgfree]' ? [fakeRoot] : []) },
    window: { ResizeObserver: FakeResizeObserver, addEventListener: () => undefined },
    ResizeObserver: FakeResizeObserver,
    Image: FakeImage,
    getComputedStyle: (target: FakeEl) => {
      if (!all.includes(target)) throw new Error('unknown element')
      return { getPropertyValue: (name: string) => target.vars[name] ?? '', backgroundImage: target.bg }
    },
    setTimeout: (fn: () => void) => fn(),
  })
  return { resize: () => onResize(), refit: () => (fakeRoot as unknown as { __ncBgFit: () => void }).__ncBgFit(), observed }
}

const IMAGE = 'url("https://lp.test/uploads/a.png")'

describe('配信のLPで、自由な大きさの背景の画像を枠いっぱいに覆う大きさに合わせる', () => {
  it('スマホの細いボタン（343×159）: 上下まで覆う大きさ（覆う大きさの108%）を px で当てる', () => {
    const button = el({ offsetWidth: 343, offsetHeight: 159, vars: { '--nc-bgfree': '108' }, bg: IMAGE })
    run(el({ offsetWidth: 375, offsetHeight: 600 }), [button])
    // 覆う大きさ＝ 460 × max(343/460, 159/168) ＝ 435.36px → 108% ＝ 470.19px
    expect(button.set['background-size']).toEqual(['470.19px auto', 'important'])
  })

  it('枠の大きさが変わったら（PCの幅・画面の切り替えで出たとき）測り直す', () => {
    const button = el({ offsetWidth: 343, offsetHeight: 159, vars: { '--nc-bgfree': '108' }, bg: IMAGE })
    const page = run(el(), [button])
    expect(page.observed).toContain(button)
    button.offsetWidth = 520
    page.resize()
    // PC: 覆う大きさ＝横幅（520）→ 108% ＝ 561.6px（今までの「横幅の108%」と同じ）
    expect(button.set['background-size']).toEqual(['561.6px auto', 'important'])
  })

  it('印の無い要素・隠れている（大きさ0の）要素・印はあっても画像の無い要素は触らない', () => {
    const plain = el({ offsetWidth: 300, offsetHeight: 100, bg: IMAGE })
    const hidden = el({ offsetWidth: 0, offsetHeight: 0, vars: { '--nc-bgfree': '100' }, bg: IMAGE })
    const noImage = el({ offsetWidth: 300, offsetHeight: 100, vars: { '--nc-bgfree': '100' } })
    run(el(), [plain, hidden, noImage])
    expect(plain.set).toEqual({})
    expect(hidden.set).toEqual({})
    expect(noImage.set).toEqual({})
  })

  it('Widgetの外枠そのもの（Widget全体の背景）も合わせる', () => {
    const root = el({ offsetWidth: 343, offsetHeight: 800, vars: { '--nc-bgfree': '100' }, bg: IMAGE })
    run(root, [])
    // 覆う大きさ＝ 460 × max(343/460, 800/168) ＝ 2190.48px
    expect(root.set['background-size']).toEqual(['2190.48px auto', 'important'])
  })

  it('Widget編集で見た目（CSS）だけ変えたとき: 外枠の __ncBgFit で測り直す（大きさ・画像・合わせ方の変化に付いていく）', () => {
    const button = el({ offsetWidth: 343, offsetHeight: 159, vars: { '--nc-bgfree': '100' }, bg: IMAGE })
    const other = el({ offsetWidth: 300, offsetHeight: 100, bg: IMAGE })
    const page = run(el(), [button, other])
    expect(button.set['background-size']?.[0]).toBe('435.36px auto')
    // 大きさを 108 に
    button.vars['--nc-bgfree'] = '108'
    page.refit()
    expect(button.set['background-size']?.[0]).toBe('470.19px auto')
    // 「いっぱい」に戻した → 当てた大きさを外す（CSSの cover が効く）
    button.vars = {}
    page.refit()
    expect(button.set).toEqual({})
    // ほかの面を自由な大きさにした → その面も合わせる
    other.vars['--nc-bgfree'] = '100'
    page.refit()
    // 覆う大きさ＝ 460 × max(300/460, 100/168) ＝ 300px（横長の枠は横幅いっぱい）
    expect(other.set['background-size']?.[0]).toBe('300px auto')
    expect(page.observed).toEqual([other])
  })

  it('LPの編集画面（.ql-editor の中）では動かない', () => {
    const button = el({ offsetWidth: 343, offsetHeight: 159, vars: { '--nc-bgfree': '108' }, bg: IMAGE })
    run(el({ inEditor: true }), [button])
    expect(button.set).toEqual({})
  })
})
