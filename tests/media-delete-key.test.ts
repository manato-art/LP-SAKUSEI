/**
 * Versionの編集画面で、選んだ画像・動画を Backspace / Delete で消す（2026-10-24 本人「画像にカーソルが合わさっていても、
 * バックキーやデリートキーで消えない」）。
 *
 * 画像を押すと選択枠は出るが、Quill の文字のカーソルは前の場所のままだった。Backspace は何も消えず、
 * Delete はカーソルのあった所の文字（上の文の頭）を消していた。
 */
import { describe, expect, it, vi } from 'vitest'
import { parseHTML } from 'linkedom'
import { isMediaDeleteKey } from '../src/app/panels/media-delete-key.ts'

const key = (k: string, extra: Record<string, unknown> = {}): KeyboardEvent =>
  ({ key: k, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, isComposing: false, ...extra }) as unknown as KeyboardEvent

describe('消すキー', () => {
  it('Backspace と Delete', () => {
    expect(isMediaDeleteKey(key('Backspace'))).toBe(true)
    expect(isMediaDeleteKey(key('Delete'))).toBe(true)
  })
  it('ほかのキー・修飾キーつき・日本語の変換中は消さない', () => {
    expect(isMediaDeleteKey(key('a'))).toBe(false)
    expect(isMediaDeleteKey(key('Backspace', { metaKey: true }))).toBe(false)
    expect(isMediaDeleteKey(key('Backspace', { ctrlKey: true }))).toBe(false)
    expect(isMediaDeleteKey(key('Backspace', { isComposing: true }))).toBe(false)
  })
})

describe('選んだ画像を消す', () => {
  async function setup(): Promise<{
    root: HTMLElement
    img: HTMLElement
    widgetImg: HTMLElement
    quill: { deleteText: ReturnType<typeof vi.fn>; setSelection: ReturnType<typeof vi.fn> }
    win: Window & typeof globalThis
  }> {
    const { window } = parseHTML(
      '<!doctype html><html><head></head><body><div class="ql-container"><div class="ql-editor"><p>上の文</p><p><img id="i"></p>' +
        '<section class="sb-widget-block"><img id="w"></section></div></div></body></html>',
    )
    const g = globalThis as unknown as Record<string, unknown>
    g['document'] = window.document
    g['HTMLImageElement'] = window.HTMLImageElement
    g['HTMLVideoElement'] = window.HTMLVideoElement
    const container = window.document.querySelector('.ql-container') as unknown as HTMLElement
    const root = window.document.querySelector('.ql-editor') as unknown as HTMLElement
    const img = window.document.getElementById('i') as unknown as HTMLElement
    const widgetImg = window.document.getElementById('w') as unknown as HTMLElement
    const blot = { kind: 'image' }
    const quill = {
      container,
      root,
      scroll: { find: (node: Node) => (node === img ? blot : null) },
      getIndex: (b: unknown) => (b === blot ? 4 : -1),
      deleteText: vi.fn(),
      setSelection: vi.fn(),
    }
    const { wireImageResize } = await import('../src/app/panels/image-resize.ts')
    wireImageResize(quill as never)
    return { root, img, widgetImg, quill, win: window as unknown as Window & typeof globalThis }
  }

  /** linkedom にはキーの出来事の作り方が無いので、ふつうの出来事にキーの中身を足して流す */
  const press = (root: HTMLElement, win: Window & typeof globalThis, k: string): boolean => {
    const event = new win.Event('keydown', { bubbles: true, cancelable: true })
    Object.assign(event, { key: k, metaKey: false, ctrlKey: false, altKey: false, isComposing: false })
    root.dispatchEvent(event)
    return event.defaultPrevented
  }
  const click = (el: HTMLElement, win: Window & typeof globalThis): void => {
    el.dispatchEvent(new win.Event('click', { bubbles: true, cancelable: true }))
  }

  it('画像を押してから Backspace を押すと、その画像を消す（文字は消さない）', async () => {
    const { root, img, quill, win } = await setup()
    click(img, win)
    expect(press(root, win, 'Backspace')).toBe(true)
    expect(quill.deleteText).toHaveBeenCalledWith(4, 1, 'user')
  })

  it('Delete でも消す', async () => {
    const { root, img, quill, win } = await setup()
    click(img, win)
    press(root, win, 'Delete')
    expect(quill.deleteText).toHaveBeenCalledWith(4, 1, 'user')
  })

  it('画像を選んでいないときは、今までどおり文字を消す（ここでは何もしない）', async () => {
    const { root, quill, win } = await setup()
    expect(press(root, win, 'Backspace')).toBe(false)
    expect(quill.deleteText).not.toHaveBeenCalled()
  })

  it('Widget の中の画像は消さない（Widget は Widget編集で直す）', async () => {
    const { root, widgetImg, quill, win } = await setup()
    click(widgetImg, win)
    expect(press(root, win, 'Backspace')).toBe(false)
    expect(quill.deleteText).not.toHaveBeenCalled()
  })
})
