/**
 * 編集中のLPで、リンクの文字とURLの文字を青い文字＋青い下線で見せる（2026-10-27 本人の指示⑧
 * 「編集中のLPの中でも、URLを入れたりURLになっているテキストは青文字+青下線で表示してわかりやすくして欲しい」）。
 *
 * - リンク（本文の a[href]）: 公開LPと同じ見え方（ブラウザの標準の青 #0000EE・下線）。編集画面はアプリ全体の
 *   `body a{color:#000;text-decoration:none}` が効いて、ふつうの文字と見分けがつかなかった。
 *   色を付けたリンク（a の style）はその色のまま（公開LPと同じ）。Widget の中（ボタンなど）は変えない
 * - リンクを付けていないURLの文字（https://… ・www.…）: 編集画面でだけ同じ色で見せる（本文は書き換えない＝
 *   CSS の Custom Highlight。保存する中身・公開LPは変わらない）
 */
import type Quill from 'quill'
import { pageLife } from '../page-life.ts'

/** 公開LPのリンクの色（ブラウザの標準） */
const LINK_COLOR = '#0000EE'
const HIGHLIGHT = 'lp-url-text'

/** 編集画面の本文のリンクの見た目を1回だけ入れる */
export function injectEditorLinkCss(): void {
  if (document.getElementById('sb-editor-link-css') !== null) return
  const style = document.createElement('style')
  style.id = 'sb-editor-link-css'
  style.textContent =
    `.ql-editor>:not(.sb-widget-block) a[href]{color:${LINK_COLOR};text-decoration:underline;text-decoration-color:currentColor}` +
    `::highlight(${HIGHLIGHT}){color:${LINK_COLOR};text-decoration:underline}`
  document.head.append(style)
}

/** URLの文字（https://… か www.…）。文の終わりの句読点・閉じかっこは含めない */
const URL_TEXT = /(?:https?:\/\/|www\.)[A-Za-z0-9\-._~:/?#[\]@!$&'*+,;=%()]+/g
const TRAILING = /[.,;:!?'")\]]+$/

/** 文字の中のURLの場所（[はじめ, おわり)） */
export function urlRanges(text: string): ReadonlyArray<readonly [number, number]> {
  const out: Array<readonly [number, number]> = []
  for (const match of text.matchAll(URL_TEXT)) {
    const url = match[0].replace(TRAILING, '')
    const start = match.index ?? 0
    if (url.length > 'www.'.length) out.push([start, start + url.length])
  }
  return out
}

/** リンクの中・Widget の中・スクリプトの中の文字は飾らない */
function skipped(node: Node, root: HTMLElement): boolean {
  const parent = node.parentElement
  return parent === null || parent.closest('a[href], .sb-widget-block, script, style') !== null || !root.contains(parent)
}

/** 本文のリンクを付けていないURLの文字を、編集画面でだけ青く見せる（本文が変わるたびに付け直す） */
export function mountUrlTextHighlight(quill: Quill): void {
  if (typeof Highlight === 'undefined' || !('highlights' in CSS)) return
  const root = quill.root
  const highlight = new Highlight()
  CSS.highlights.set(HIGHLIGHT, highlight)
  const scan = (): void => {
    highlight.clear()
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const text = node.textContent ?? ''
      if (!/https?:\/\/|www\./.test(text) || skipped(node, root)) continue
      for (const [start, end] of urlRanges(text)) {
        const range = new Range()
        range.setStart(node, start)
        range.setEnd(node, end)
        highlight.add(range)
      }
    }
  }
  let timer = 0
  const later = (): void => {
    window.clearTimeout(timer)
    timer = window.setTimeout(scan, 150)
  }
  // Version を切り替えたとき（Quill の知らせが出ない）も拾うため、本文の変化を見る
  const observer = new MutationObserver(later)
  observer.observe(root, { childList: true, characterData: true, subtree: true })
  scan()
  pageLife().addEventListener(
    'abort',
    () => {
      observer.disconnect()
      window.clearTimeout(timer)
      CSS.highlights.delete(HIGHLIGHT)
    },
    { once: true },
  )
}
