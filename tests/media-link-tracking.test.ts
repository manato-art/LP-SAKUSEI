/**
 * 画像・動画のリンクに「計測リンクにする」を付ける（2026-10-27 指示⑳ 本人「画像や動画に対してのリンクの際に計測のチェックを追加して・
 * デフォルトはチェックなし」「一見、計測を変更できるかわからないので、わかりやすいデザイン」）。
 * URL の欄には計測の目印（sb_tracking）を外したURLを出し、計測はチェックで表す（文字のリンクの「リンクを設定」と同じ）。
 */
import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'

async function setup(attrs = '') {
  const { window } = parseHTML(`<!doctype html><html><body><img src="a.png" ${attrs}></body></html>`)
  const g = globalThis as unknown as Record<string, unknown>
  for (const key of ['document', 'window', 'Event', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'Node']) {
    g[key] = (window as unknown as Record<string, unknown>)[key]
  }
  // linkedom の input には checked が無い。属性で読み書きできるようにする
  const inputProto = (window as unknown as { HTMLInputElement: { prototype: object } }).HTMLInputElement.prototype
  Object.defineProperty(inputProto, 'checked', {
    configurable: true,
    get(this: Element) {
      return this.hasAttribute('checked')
    },
    set(this: Element, on: boolean) {
      if (on) this.setAttribute('checked', '')
      else this.removeAttribute('checked')
    },
  })
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
  const img = window.document.querySelector('img') as unknown as HTMLElement
  const { buildMediaLinkGroup } = await import('../src/app/panels/properties-media-extras.ts')
  const section = buildMediaLinkGroup({ current: () => img, apply: (change) => change(img) })
  section.sync(img)
  const url = section.el.querySelector<HTMLInputElement>('input[placeholder="https://"]')
  const track = section.el.querySelector<HTMLInputElement>('[data-media-link-track]')
  if (url === null || track === null) throw new Error('欄が無い')
  const type = (value: string): void => {
    url.value = value
    url.dispatchEvent(new window.Event('change'))
  }
  const toggle = (on: boolean): void => {
    track.checked = on
    track.dispatchEvent(new window.Event('change'))
  }
  return { section, img, url, track, type, toggle }
}

describe('画像・動画のリンクの開き方（2026-10-27 指示㉖ 本人「ターゲット→開き方にして」）', () => {
  it('欄の名前は「開き方」', async () => {
    const t = await setup()
    const labels = [...t.section.el.querySelectorAll('.sb-pr-label')].map((l) => l.textContent)
    expect(labels).toContain('開き方')
    expect(labels).not.toContain('ターゲット')
  })
})

describe('画像・動画のリンクの「計測リンクにする」', () => {
  it('名前は「計測リンクにする」で、最初はチェックなし。そのままURLを入れると計測なしのリンク', async () => {
    const t = await setup()
    expect(t.track.closest('label')?.textContent).toContain('計測リンクにする')
    expect(t.track.checked).toBe(false)
    t.type('https://example.com/lp')
    expect(t.img.getAttribute('data-link-url')).toBe('https://example.com/lp')
  })

  it('チェックを入れると計測の目印を付け、外すと外す', async () => {
    const t = await setup()
    t.type('https://example.com/lp')
    t.toggle(true)
    expect(t.img.getAttribute('data-link-url')).toBe('https://example.com/lp?sb_tracking=true')
    t.toggle(false)
    expect(t.img.getAttribute('data-link-url')).toBe('https://example.com/lp')
  })

  it('計測ありのリンクを開くと、チェックが入っていて、URLの欄は目印を外した形', async () => {
    const t = await setup('data-link-url="https://example.com/lp?utm_source=fb&sb_tracking=true"')
    expect(t.track.checked).toBe(true)
    expect(t.url.value).toBe('https://example.com/lp?utm_source=fb')
    // URL を直しても計測はそのまま
    t.type('https://example.com/other')
    expect(t.img.getAttribute('data-link-url')).toBe('https://example.com/other?sb_tracking=true')
  })
})
