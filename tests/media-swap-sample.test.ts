/**
 * 見本の中の画像・動画を、もう一方の種類に差し替える（2026-10-27 本人「画像を動画に・その逆も」）。
 * 見本（取り込んだSBの見本・自作の見本）の右の欄の「動画に差し替え」「画像に差し替え」は editSample の toVideo・toImage を通る。
 * 要素の数が変わる（<picture>・<source>）ことがあるので、差し替えたあとは中身の一覧を作り直す（form-sample.ts の rebuild）。
 */
import { parseHTML } from 'linkedom'
import { beforeAll, describe, expect, it } from 'vitest'

// sample-dom.ts はブラウザの DOMParser と Element・Text を使う。linkedom の同じものを置く
beforeAll(() => {
  const { window } = parseHTML('<!doctype html><html><body></body></html>')
  const g = globalThis as Record<string, unknown>
  for (const name of ['DOMParser', 'Element', 'Text', 'Node', 'NodeFilter', 'HTMLElement']) g[name] ??= (window as unknown as Record<string, unknown>)[name]
})

const VIDEO = 'data:video/mp4;base64,AAAA'
const IMAGE = 'data:image/webp;base64,BBBB'

describe('見本の中の画像・動画を差し替える', () => {
  it('画像を動画に（自動で再生・音なし・くり返し・見た目のクラスは引き継ぐ）', async () => {
    const { editSample } = await import('../src/app/panels/nocode/sample-dom.ts')
    // e0=div e1=p e2=img
    const html = '<div class="box"><p>見出し</p><img class="photo" src="/uploads/a.png" alt=""></div>'
    const next = editSample(html, 'e2', { kind: 'toVideo', value: VIDEO })
    const { document } = parseHTML(`<div id="r">${next}</div>`)
    const video = document.querySelector('video')
    expect(document.querySelector('img')).toBeNull()
    expect(video?.getAttribute('class')).toBe('photo')
    expect(video?.getAttribute('src')).toBe(VIDEO)
    for (const flag of ['autoplay', 'muted', 'loop', 'playsinline']) expect(video?.hasAttribute(flag)).toBe(true)
  })

  it('動画を画像に（<source>・再生の設定は外す）', async () => {
    const { editSample } = await import('../src/app/panels/nocode/sample-dom.ts')
    const html = '<div class="box"><video class="v" autoplay muted loop><source src="/uploads/a.mp4" type="video/mp4"></video></div>'
    const next = editSample(html, 'e1', { kind: 'toImage', value: IMAGE })
    const { document } = parseHTML(`<div id="r">${next}</div>`)
    expect(document.querySelector('video')).toBeNull()
    expect(document.querySelector('source')).toBeNull()
    expect(document.querySelector('img')?.getAttribute('src')).toBe(IMAGE)
    expect(document.querySelector('img')?.getAttribute('class')).toBe('v')
  })

  it('種類が合わない所（画像でない所を動画に・使えない値）は変えない', async () => {
    const { editSample } = await import('../src/app/panels/nocode/sample-dom.ts')
    const html = '<div class="box"><p>見出し</p><img src="/uploads/a.png" alt=""></div>'
    expect(editSample(html, 'e1', { kind: 'toVideo', value: VIDEO })).toBe(html)
    expect(editSample(html, 'e2', { kind: 'toVideo', value: 'javascript:alert(1)' })).toBe(html)
    expect(editSample(html, 'e2', { kind: 'toImage', value: IMAGE })).toBe(html)
  })
})
