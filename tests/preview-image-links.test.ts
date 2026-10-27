/**
 * プレビューでも画像のリンクを押せる（2026-09-24 全体点検36: 配信LPだけにスクリプトが入っていて、
 * プレビューでは画像を押しても何も起きなかった）。プレビューは「計測されません」なので計測URLへは送らない。
 */
import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'
import { imageLinkScript } from '../mock-server/routes/delivery-image-links.ts'

describe('画像リンクのスクリプト', () => {
  it('配信LP用は、画像をリンクにして計測URLへも送る', () => {
    const script = imageLinkScript(true)
    expect(script).toContain("querySelectorAll('img[data-link-url],video[data-link-url]')")
    expect(script).toContain('sendBeacon')
  })

  it('リンクを付けた動画も押せる。押すとリンク先へ移る（再生ボタンは出さない）・計測の目印もそのまま（2026-10-27 指示㉑）', () => {
    const { document } = parseHTML(
      '<!doctype html><html><body><p><video src="a.mp4" controls data-link-url="https://example.com/?sb_tracking=true" data-link-target="_self" style="margin-left:auto;margin-right:auto"></video></p><img src="b.png" data-link-url="https://example.com/b"></body></html>',
    )
    const run = new Function('document', imageLinkScript(false).replace(/^<script>/, '').replace(/<\/script>$/, ''))
    run(document)
    const video = document.querySelector('video')
    const link = video?.parentElement
    expect(link?.tagName).toBe('A')
    expect(link?.getAttribute('href')).toBe('https://example.com/?sb_tracking=true')
    expect(link?.getAttribute('target')).toBe('_self')
    expect(video?.hasAttribute('controls')).toBe(false)
    // 画像は今までどおり
    expect(document.querySelector('img')?.parentElement?.getAttribute('href')).toBe('https://example.com/b')
  })

  it('プレビュー用は、画像をリンクにするが計測URLへは送らない', () => {
    const script = imageLinkScript(false)
    expect(script).toContain("querySelectorAll('img[data-link-url],video[data-link-url]')")
    expect(script).not.toContain('sendBeacon')
    expect(script).not.toContain('new Image().src')
  })
})
