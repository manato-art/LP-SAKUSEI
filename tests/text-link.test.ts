/**
 * 文字のリンク（右のプロパティ「書式」→ リンク）でも、クリック数を数えるリンクにできる（2026-09-25）。
 *
 * 以前の「リンクを設定」はURLの欄だけで、付けたリンクには計測の目印（sb_tracking）が付かなかった。
 * 目印を付けられる浮かぶツールバーは非表示（editor-layout.ts の hideFloatingToolbar）なので、
 * 文字のリンクを数えるには「リンク置換」で変えるしかなく、申し込みボタンの CLICK と CV が 0 のままになっていた。
 * → 「リンクを設定」に「クリック数をレポートで数える」を足す。新しいリンクは数える（Widget・リンク置換と同じ）、
 *   いまあるリンクを開いたときは、いまの状態を出す。
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { installDom } from './helpers/dom.ts'
import { extractLinksFromHtml, isTrackingLink } from '../src/shared/link-html.ts'
import { applyTextLink, textLinkHref, textLinkState } from '../src/app/panels/text-link.ts'

beforeAll(() => {
  installDom()
})

/** Quill の代わり（formatText の呼び出しを本文の DOM に写すだけ） */
function fakeQuill(html: string) {
  const root = document.createElement('div')
  root.innerHTML = html
  const calls: Array<{ index: number; length: number; value: string | false }> = []
  return {
    root,
    calls,
    formatText(index: number, length: number, name: string, value: string | false) {
      if (name !== 'link') return
      calls.push({ index, length, value })
      const target = root.querySelector('span[data-sel]')
      if (target === null) return
      if (value === false) {
        target.querySelector('a')?.replaceWith(...[...(target.querySelector('a')?.childNodes ?? [])])
        return
      }
      const a = target.querySelector('a') ?? document.createElement('a')
      a.setAttribute('href', value)
      if (a.parentNode === null) {
        a.append(...[...target.childNodes])
        target.append(a)
      }
    },
    getLines() {
      return [...root.querySelectorAll('p')].map((p) => ({ domNode: p }))
    },
  }
}

describe('リンクを設定を開いたときの状態', () => {
  it('新しいリンクは「数える」から始まる', () => {
    expect(textLinkState('', null)).toEqual({ url: '', tracking: true })
  })

  it('数えるリンクを開くと、欄には目印を外したURLを出し、チェックは入っている', () => {
    expect(textLinkState('https://shop.example.com/buy?utm_source=fb&sb_tracking=true', null)).toEqual({
      url: 'https://shop.example.com/buy?utm_source=fb',
      tracking: true,
    })
  })

  it('数えないリンクを開くと、チェックは外れている', () => {
    expect(textLinkState('https://shop.example.com/buy', null)).toEqual({ url: 'https://shop.example.com/buy', tracking: false })
  })

  it('電話は属性で数えるかどうかを見る', () => {
    expect(textLinkState('tel:0120000000', 'true')).toEqual({ url: 'tel:0120000000', tracking: true })
    expect(textLinkState('tel:0120000000', null)).toEqual({ url: 'tel:0120000000', tracking: false })
  })
})

describe('リンク先に付ける目印', () => {
  it('数えるときは URL に sb_tracking=true を付け、計測リンクとして扱われる', () => {
    const href = textLinkHref('https://shop.example.com/buy?utm_source=fb', true)
    expect(href).toBe('https://shop.example.com/buy?utm_source=fb&sb_tracking=true')
    expect(isTrackingLink(href, null)).toBe(true)
  })

  it('数えないときは目印を外す', () => {
    expect(textLinkHref('https://shop.example.com/buy?sb_tracking=true', false)).toBe('https://shop.example.com/buy')
  })

  it('電話とページ内の移動（#）は URL を変えない', () => {
    expect(textLinkHref('tel:0120000000', true)).toBe('tel:0120000000')
    expect(textLinkHref('#form', true)).toBe('#form')
  })
})

describe('本文への反映', () => {
  it('チェックを入れて設定すると、本文のリンクが計測リンクになる（リンク置換にも「計測あり」で出る）', () => {
    const quill = fakeQuill('<p><span data-sel>今すぐ申し込む</span></p>')
    applyTextLink(quill, { index: 0, length: 7 }, { url: 'https://shop.example.com/buy', tracking: true })
    const links = extractLinksFromHtml(quill.root.innerHTML)
    expect(links).toHaveLength(1)
    expect(links[0]?.isTracking).toBe(true)
  })

  it('電話を数えるときは <a> に data-sb-tracking="true" を付け、数えないときは外す', () => {
    const quill = fakeQuill('<p><span data-sel>電話する</span></p>')
    applyTextLink(quill, { index: 0, length: 4 }, { url: 'tel:0120000000', tracking: true })
    expect(quill.root.querySelector('a')?.getAttribute('data-sb-tracking')).toBe('true')
    expect(extractLinksFromHtml(quill.root.innerHTML)[0]?.isTracking).toBe(true)

    applyTextLink(quill, { index: 0, length: 4 }, { url: 'tel:0120000000', tracking: false })
    expect(quill.root.querySelector('a')?.hasAttribute('data-sb-tracking')).toBe(false)
  })

  it('URL を空にするとリンクを外す', () => {
    const quill = fakeQuill('<p><span data-sel><a href="https://shop.example.com/old">文字</a></span></p>')
    applyTextLink(quill, { index: 0, length: 2 }, { url: '', tracking: true })
    expect(quill.calls.at(-1)?.value).toBe(false)
    expect(quill.root.querySelector('a')).toBeNull()
  })
})
