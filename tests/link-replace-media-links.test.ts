/**
 * 画像・動画に付けたリンクも、リンク置換の一覧に出す（2026-10-27 指示⑲ 本人「画像や動画に入れたリンクが表示されてない」）。
 * 画像・動画のリンクは <a> ではなく data-link-url（配信で <a> で包む）なので、一覧に出ていなかった。
 * 本文の中の順番どおりに並べ、置換・計測あり／なしの切り替えも同じようにできる。
 */
import { describe, expect, it } from 'vitest'
import { extractLinksFromHtml, replaceLinksInHtml, replaceableIndexes } from '../src/shared/link-html.ts'
import { settle, setupLinkReplacePanel } from './helpers/link-replace-panel.ts'

const HTML =
  '<p><a href="https://example.test/text">文字のリンク</a></p>' +
  '<p><img src="a.png" alt="申し込みの画像" data-link-url="https://example.test/img?sb_tracking=true"></p>' +
  '<p><img src="b.png"></p>' +
  '<video src="v.mp4" aria-label="紹介の動画" data-link-url="https://example.test/video" data-link-target="_self"></video>' +
  '<p><a href="https://example.test/last">最後</a></p>'

describe('画像・動画のリンクも数える', () => {
  it('本文の中の順番どおりに並ぶ。リンクの無い画像は数えない', () => {
    expect(extractLinksFromHtml(HTML).map((l) => [l.index, l.kind, l.text, l.href, l.isTracking, l.isNewTab])).toEqual([
      [0, 'text', '文字のリンク', 'https://example.test/text', false, false],
      [1, 'image', '申し込みの画像', 'https://example.test/img?sb_tracking=true', true, true],
      [2, 'video', '紹介の動画', 'https://example.test/video', false, false],
      [3, 'text', '最後', 'https://example.test/last', false, false],
    ])
    expect(replaceableIndexes(HTML, [0, 1, 2, 3, 4])).toEqual([0, 1, 2, 3])
  })

  it('画像・動画のリンクも置き換えられる（行き先・計測・開き方）。ほかの属性はそのまま', () => {
    const out = replaceLinksInHtml(HTML, [1, 2], { href: 'https://example.test/new', tracking: false, newTab: false })
    const links = extractLinksFromHtml(out)
    expect(links[1]).toMatchObject({ kind: 'image', href: 'https://example.test/new', isTracking: false, isNewTab: false })
    expect(links[2]).toMatchObject({ kind: 'video', href: 'https://example.test/new', isNewTab: false })
    expect(out).toContain('alt="申し込みの画像"')
    expect(out).toContain('aria-label="紹介の動画"')
    expect(links[0]?.href).toBe('https://example.test/text')
    expect(links[3]?.href).toBe('https://example.test/last')
  })
})

describe('一覧の行（画像・動画）', () => {
  it('画像・動画のリンクの行には「画像」「動画」と出る', async () => {
    const t = await setupLinkReplacePanel(HTML)
    expect(t.rowIndexes()).toEqual(['0', '1', '2', '3'])
    expect(t.panel.querySelector('[data-link-row="1"] [data-link-kind]')?.textContent).toBe('画像')
    expect(t.panel.querySelector('[data-link-row="2"] [data-link-kind]')?.textContent).toBe('動画')
    expect(t.panel.querySelector('[data-link-row="0"] [data-link-kind]')).toBeNull()
  })

  it('画像のリンクも、行の札で計測なしにできる（行き先・別タブはそのまま）', async () => {
    const t = await setupLinkReplacePanel(HTML)
    t.panel.querySelector('[data-link-row="1"] [data-link-tracking-toggle]')?.dispatchEvent(new t.window.Event('click'))
    await settle()
    expect(extractLinksFromHtml(t.body.innerHTML)[1]).toMatchObject({ kind: 'image', href: 'https://example.test/img', isTracking: false, isNewTab: true })
  })
})
