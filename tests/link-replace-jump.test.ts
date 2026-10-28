/**
 * リンク置換の一覧の行を押すと、本文のそのリンクの場所へ移る（2026-10-28 指示36 本人「余白を押したらその場所に飛ぶように」）。
 *
 *   - 行のチェック（置換の選択）はチェックの所だけ。前は行全体が label で、どこを押してもチェックが付け外しされた
 *   - 計測あり／なしの札は今までどおり（押しても移らない）
 *   - 一覧の番号（本文の文字から数えた出現順）と本文の要素を結ぶ。`#` だけのリンクも番号を持つ（一覧には出ない）
 */
import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'
import { renderLinkRows } from '../src/app/panels/link-replace-rows.ts'
import { jumpToLink, linkElementsByIndex } from '../src/app/panels/link-replace-jump.ts'
import { extractLinksFromHtml, listedLinks } from '../src/shared/link-html.ts'

function dom(html = ''): Document {
  const { document } = parseHTML(`<!doctype html><html><body><div id="h"></div><div id="body">${html}</div></body></html>`)
  ;(globalThis as unknown as Record<string, unknown>)['document'] = document
  return document
}

const click = (doc: Document, el: Element | null | undefined): void => {
  // linkedom には MouseEvent が無いので、泡立つ Event で押したことにする
  const Event = (doc.defaultView as unknown as { Event: typeof globalThis.Event }).Event
  el?.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }))
}

describe('リンク置換の一覧の行を押すと、その場所へ移る', () => {
  it('行の余白・題名を押すと移る。チェックと計測の札を押しても移らない', () => {
    const doc = dom()
    const host = doc.getElementById('h') as unknown as HTMLElement
    const links = extractLinksFromHtml('<a href="https://a.example.test/">買う</a>')
    const jumped: number[] = []
    const toggledTracking: number[] = []
    renderLinkRows(host, links, {
      selected: new Set(),
      onToggle: () => undefined,
      onTrackingToggle: (l) => toggledTracking.push(l.index),
      onJump: (l) => jumped.push(l.index),
    })
    const row = host.querySelector('[data-link-row="0"]')
    click(doc, row)
    click(doc, row?.querySelector('.lr-row__title'))
    expect(jumped).toEqual([0, 0])
    click(doc, row?.querySelector('.lr-row__check'))
    click(doc, row?.querySelector('[data-link-tracking-toggle]'))
    expect(jumped).toEqual([0, 0])
    expect(toggledTracking).toEqual([0])
  })

  it('行は label にしない（行のどこを押してもチェックが付け外しされていた）', () => {
    const doc = dom()
    const host = doc.getElementById('h') as unknown as HTMLElement
    renderLinkRows(host, extractLinksFromHtml('<a href="https://a.example.test/">買う</a>'), {
      selected: new Set(),
      onToggle: () => undefined,
      onJump: () => undefined,
    })
    expect(host.querySelector('[data-link-row]')?.tagName).not.toBe('LABEL')
    // チェックは小さな label の中（押しやすい広さ）
    expect(host.querySelector('[data-link-row] label .lr-row__check')).not.toBeNull()
  })
})

describe('一覧の番号と本文の要素を結ぶ', () => {
  it('文字のリンク・画像・動画を出現順に結ぶ（# だけのリンクも番号を持つ）', () => {
    const html =
      '<p><a href="#">目印</a></p>' +
      '<p><a href="https://a.example.test/">買う</a></p>' +
      '<p><img src="x.png" data-link-url="https://img.example.test/"></p>' +
      '<p><img src="y.png"></p>' +
      '<p><video src="v.mp4" data-link-url="https://video.example.test/"></video></p>' +
      '<p><a href="https://b.example.test/">申し込む</a></p>'
    const doc = dom(html)
    const body = doc.getElementById('body') as unknown as HTMLElement
    const map = linkElementsByIndex(body, extractLinksFromHtml(body.innerHTML))
    const listed = listedLinks(body.innerHTML)
    expect(listed.map((l) => l.index)).toEqual([1, 2, 3, 4])
    expect(map.get(1)?.textContent).toBe('買う')
    expect(map.get(2)?.getAttribute('data-link-url')).toBe('https://img.example.test/')
    expect(map.get(3)?.tagName).toBe('VIDEO')
    expect(map.get(4)?.textContent).toBe('申し込む')
  })

  it('本文に見つからないリンクは結ばない（ほかの行の結び先がずれない）', () => {
    const doc = dom('<p><a href="https://a.example.test/">買う</a></p>')
    const body = doc.getElementById('body') as unknown as HTMLElement
    // 一覧だけにあって本文に無いリンク（読み込み直す前など）
    const links = extractLinksFromHtml('<a href="https://gone.example.test/">消えた</a><a href="https://a.example.test/">買う</a>')
    const map = linkElementsByIndex(body, links)
    expect(map.has(0)).toBe(false)
    expect(map.get(1)?.textContent).toBe('買う')
  })
})

describe('その場所へ移る', () => {
  it('真ん中へ送る（本文の要素には何も書き込まない）', () => {
    const doc = dom('<p><a id="t" href="https://a.example.test/">買う</a></p>')
    const target = doc.getElementById('t') as unknown as HTMLElement
    const calls: unknown[] = []
    ;(target as unknown as { scrollIntoView: (o: unknown) => void }).scrollIntoView = (o) => calls.push(o)
    const before = doc.getElementById('body')?.innerHTML
    jumpToLink(target)
    expect(calls).toEqual([{ block: 'center' }])
    // 保存される本文の HTML は変えない（印やクラスを付けると、そのまま保存されてしまう）
    expect(doc.getElementById('body')?.innerHTML).toBe(before)
  })

  it('枠は編集画面の中（本文の外）に置き、右のパネルにかぶさらない・塗らずに線だけ（2026-10-28 本人「かぶさってしまうのが見ずらい」）', () => {
    const { document: doc } = parseHTML(
      '<!doctype html><html><body><div class="ql-container"><div class="ql-editor" id="body"><p><a id="t" href="https://a.example.test/">買う</a></p></div></div></body></html>',
    )
    ;(globalThis as unknown as Record<string, unknown>)['document'] = doc
    const target = doc.getElementById('t') as unknown as HTMLElement
    ;(target as unknown as { scrollIntoView: () => void }).scrollIntoView = () => undefined
    const before = doc.getElementById('body')?.innerHTML
    jumpToLink(target)
    const flash = doc.querySelector('[data-link-jump-flash]')
    // 編集画面の箱（.ql-container）の中＝本文と一緒に動き、画面の上に重なる右のパネル（z-index 9600）より下
    expect(flash?.parentElement?.className).toBe('ql-container')
    expect(doc.getElementById('body')?.innerHTML).toBe(before)
    const style = flash?.getAttribute('style') ?? ''
    expect(style).toContain('position:absolute')
    expect(style).not.toContain('position:fixed')
    expect(style).not.toMatch(/background:rgba/)
  })
})
