/**
 * プレビューでも画像のリンクを押せる（2026-09-24 全体点検36: 配信LPだけにスクリプトが入っていて、
 * プレビューでは画像を押しても何も起きなかった）。プレビューは「計測されません」なので計測URLへは送らない。
 */
import { describe, expect, it } from 'vitest'
import { imageLinkScript } from '../mock-server/routes/delivery-image-links.ts'

describe('画像リンクのスクリプト', () => {
  it('配信LP用は、画像をリンクにして計測URLへも送る', () => {
    const script = imageLinkScript(true)
    expect(script).toContain("querySelectorAll('img[data-link-url]')")
    expect(script).toContain('sendBeacon')
  })

  it('プレビュー用は、画像をリンクにするが計測URLへは送らない', () => {
    const script = imageLinkScript(false)
    expect(script).toContain("querySelectorAll('img[data-link-url]')")
    expect(script).not.toContain('sendBeacon')
    expect(script).not.toContain('new Image().src')
  })
})
