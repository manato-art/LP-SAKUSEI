/**
 * 画像・動画に計測URL（押したときに送る先）もあるときは、リンク置換の同じ行（箱）の中に出す
 * （2026-10-27 本人「下の計測リンクもある場合は、リンク置換の同じ箱の中に記載しいて欲しい」）。
 */
import { describe, expect, it } from 'vitest'
import { extractLinksFromHtml } from '../src/shared/link-html.ts'
import { setupLinkReplacePanel } from './helpers/link-replace-panel.ts'

const HTML =
  '<p><a href="https://example.test/text">文字</a></p>' +
  '<p><img src="a.png" data-link-url="https://example.test/lp?sb_tracking=true" data-tracking-urls=\'["https://t1.example.test/","https://t2.example.test/"]\'></p>' +
  '<video src="v.mp4" data-link-url="https://example.test/v" data-tracking-urls="not-json"></video>'

describe('画像・動画の計測URL', () => {
  it('リンクと一緒に計測URLも読む（壊れた値・文字のリンクは無し）', () => {
    expect(extractLinksFromHtml(HTML).map((l) => l.trackingUrls)).toEqual([[], ['https://t1.example.test/', 'https://t2.example.test/'], []])
  })

  it('同じ行の中に「計測URL」として並べる', async () => {
    const t = await setupLinkReplacePanel(HTML)
    const lines = [...t.panel.querySelectorAll('[data-link-row="1"] [data-link-tracking-url]')].map((el) => el.textContent)
    expect(lines).toEqual(['計測URLhttps://t1.example.test/', '計測URLhttps://t2.example.test/'])
    expect(t.panel.querySelector('[data-link-row="0"] [data-link-tracking-url]')).toBeNull()
    expect(t.panel.querySelector('[data-link-row="2"] [data-link-tracking-url]')).toBeNull()
  })
})
