/**
 * 動画の右の設定にも、画像と同じことができる欄を出す（2026-10-27 指示㉑ 本人「動画にもリンク入れたい」「画像でできること全部入れて」）。
 * リンク設定（行き先・開き方）・計測URL・アニメーション・代替テキスト・削除。
 */
import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'

async function setup() {
  const { window } = parseHTML('<!doctype html><html><body><div class="ql-editor"><video src="a.mp4" controls></video></div></body></html>')
  const g = globalThis as unknown as Record<string, unknown>
  for (const key of ['document', 'window', 'Event', 'HTMLElement', 'HTMLInputElement', 'HTMLVideoElement', 'HTMLSelectElement', 'Node']) {
    g[key] = (window as unknown as Record<string, unknown>)[key]
  }
  // linkedom の select は value を入れられない（読むだけ）。入れられるようにする
  const selectProto = (window as unknown as { HTMLSelectElement: { prototype: object } }).HTMLSelectElement.prototype
  Object.defineProperty(selectProto, 'value', {
    configurable: true,
    get(this: Element) {
      return this.getAttribute('data-value') ?? ''
    },
    set(this: Element, v: string) {
      this.setAttribute('data-value', v)
    },
  })
  const root = window.document.querySelector('.ql-editor') as unknown as HTMLElement
  const video = root.querySelector('video') as unknown as HTMLVideoElement
  let current: HTMLVideoElement | null = video
  const deleted: number[] = []
  const quill = {
    root,
    update: () => undefined,
    scroll: { find: () => ({}) },
    getIndex: () => 3,
    deleteText: (index: number) => deleted.push(index),
  }
  const { buildVideoBody } = await import('../src/app/panels/properties-video.ts')
  const body = buildVideoBody({ quill: quill as never, getVideo: () => current, setVideo: (v) => (current = v), showImage: () => undefined })
  body.sync?.(video)
  const titles = [...body.querySelectorAll('.sb-pg-title')].map((t) => t.textContent)
  const change = (input: HTMLInputElement | HTMLSelectElement | null, value: string): void => {
    if (input === null) throw new Error('欄が無い')
    // eslint-disable-next-line no-param-reassign -- 欄に打つ
    input.value = value
    input.dispatchEvent(new window.Event('change'))
  }
  return { window, body, video, titles, change, deleted }
}

describe('動画の設定（画像と同じことができる）', () => {
  it('リンク設定・計測URL・アニメーションの欄がある', async () => {
    const { titles } = await setup()
    expect(titles).toEqual(expect.arrayContaining(['リンク設定', '計測URL', 'アニメーション']))
  })

  it('リンクの行き先と開き方を動画に付ける', async () => {
    const { body, video, change } = await setup()
    change(body.querySelector('input[placeholder="https://"]'), 'https://example.com/lp')
    expect(video.getAttribute('data-link-url')).toBe('https://example.com/lp')
    change(body.querySelector('.sb-link-target-select'), '_self')
    expect(video.getAttribute('data-link-target')).toBe('_self')
  })

  it('アニメーションを動画に付ける', async () => {
    const { window, body, video } = await setup()
    const fade = [...body.querySelectorAll('.sb-pr-anim-btn')].find((b) => b.getAttribute('data-anim-id') !== '')
    fade?.dispatchEvent(new window.Event('click'))
    expect(video.getAttribute('data-anim')).toBe(fade?.getAttribute('data-anim-id'))
  })

  it('代替テキストを動画に付ける（aria-label）', async () => {
    const { body, video, change } = await setup()
    change(body.querySelector('input[placeholder="代替テキスト"]'), '商品の紹介')
    expect(video.getAttribute('aria-label')).toBe('商品の紹介')
  })

  it('動画を削除できる', async () => {
    const { window, body, deleted } = await setup()
    const remove = [...body.querySelectorAll('button')].find((b) => b.textContent?.includes('動画を削除'))
    remove?.dispatchEvent(new window.Event('click'))
    expect(deleted).toEqual([3])
  })
})
