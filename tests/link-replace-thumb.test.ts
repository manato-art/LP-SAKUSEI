/**
 * リンク置換の一覧の、画像・動画の行の小さなサムネ（2026-10-27 指示㉗ 本人「画像と動画は小さくサムネを載せて欲しい・容量食うならやめる」）。
 * 新しく読み込まない: 編集画面にもう出ている画像・動画（同じ要素）から小さな絵に描き写す。どの行がどの要素かを確かめる。
 */
import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'
import { extractLinksFromHtml } from '../src/shared/link-html.ts'
import { mediaElementsByIndex } from '../src/app/panels/link-replace-thumb.ts'
import { setupLinkReplacePanel } from './helpers/link-replace-panel.ts'

const HTML =
  '<p><a href="https://example.test/a">文字</a></p>' +
  '<p><img src="one.png" data-link-url="#"></p>' +
  '<p><img src="plain.png"></p>' +
  '<p><img src="two.png" data-link-url="https://example.test/two"></p>' +
  '<video src="v.mp4" data-link-url="https://example.test/v"></video>'

describe('行と編集画面の画像・動画を結ぶ', () => {
  it('リンクの付いた画像・動画の何番目かで結ぶ（リンクの無い画像は数えない・一覧に出さない「#」の画像も数えには入れる）', () => {
    const { document } = parseHTML(`<!doctype html><html><body><div id="b">${HTML}</div></body></html>`)
    const body = document.getElementById('b') as unknown as HTMLElement
    const map = mediaElementsByIndex(body, extractLinksFromHtml(body.innerHTML))
    expect(map.get(0)).toBeUndefined()
    expect(map.get(1)?.getAttribute('src')).toBe('one.png')
    expect(map.get(2)?.getAttribute('src')).toBe('two.png')
    expect(map.get(3)?.getAttribute('src')).toBe('v.mp4')
  })
})

describe('一覧の行のサムネ', () => {
  it('画像・動画の行にだけ小さなサムネを付ける', async () => {
    const t = await setupLinkReplacePanel(HTML)
    expect(t.rowIndexes()).toEqual(['0', '2', '3'])
    expect(t.panel.querySelector('[data-link-row="0"] [data-link-thumb]')).toBeNull()
    expect(t.panel.querySelector('[data-link-row="2"] [data-link-thumb]')).not.toBeNull()
    expect(t.panel.querySelector('[data-link-row="3"] [data-link-thumb]')).not.toBeNull()
  })
})
