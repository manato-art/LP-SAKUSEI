/**
 * 採取したページから `#root` の中身だけを取り出して「断片」として保存する。
 *
 * 企画書 §11 の本来のやり方: 採取したDOMを**そのまま土台にして**、
 * 挙動だけを後から付ける。部品ごとに切り出して組み直すと、本物との差が出る。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { rewriteSubstrate } from './rewrite.ts'

const CLEAN_DIR = 'capture/clean'
const OUT_DIR = 'src/app/fragments'

/** `<div id="root">…</div>` の中身だけを取り出す */
export function extractRootInner(html: string): string | null {
  const at = html.indexOf('id="root"')
  if (at === -1) return null
  const open = html.indexOf('>', at) + 1
  // #root の対応する閉じタグを深さ数えで探す
  let depth = 1
  let i = open
  while (i < html.length && depth > 0) {
    const nextOpen = html.indexOf('<div', i)
    const nextClose = html.indexOf('</div>', i)
    if (nextClose === -1) return null
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1
      i = nextOpen + 4
    } else {
      depth -= 1
      i = nextClose + 6
    }
  }
  return html.slice(open, i - 6)
}

/**
 * モーダルは `#root` の**外**（ReactModalPortal 等）に描画されるため、
 * `#root` の中身だけを取ると**モーダルが丸ごと抜け落ちる**（実装担当の指摘で判明）。
 * body 直下のポータル要素も拾って併せて出す。
 */
const PORTAL_MARKERS: readonly string[] = [
  'ReactModalPortal',
  'ReactModal__Overlay',
  'data-radix-portal',
  'MuiModal-root',
  'MuiPopover-root',
]

export function extractPortals(html: string): string[] {
  const out: string[] = []
  for (const marker of PORTAL_MARKERS) {
    let from = 0
    for (;;) {
      const at = html.indexOf(marker, from)
      if (at === -1) break
      // マーカーを含むタグの開始位置まで戻る
      const tagStart = html.lastIndexOf('<', at)
      if (tagStart === -1) break
      const block = extractElement(html, tagStart)
      if (block !== null && block.length > 200) out.push(block)
      from = at + marker.length
    }
  }
  return [...new Set(out)]
}

/** 開始タグ位置から対応する閉じタグまでを深さ数えで取り出す */
function extractElement(html: string, start: number): string | null {
  const tagMatch = /^<([a-zA-Z][\w-]*)/.exec(html.slice(start))
  if (tagMatch === null) return null
  const tag = tagMatch[1] as string
  const openRe = new RegExp(`<${tag}[\\s>/]`, 'g')
  const closeTag = `</${tag}>`
  let depth = 0
  let i = start
  while (i < html.length) {
    openRe.lastIndex = i
    const nextOpen = openRe.exec(html)
    const nextClose = html.indexOf(closeTag, i)
    if (nextClose === -1) return null
    if (nextOpen !== null && nextOpen.index < nextClose) {
      depth += 1
      i = nextOpen.index + 1
    } else {
      depth -= 1
      i = nextClose + closeTag.length
      if (depth === 0) return html.slice(start, i)
    }
  }
  return null
}

export function buildFragments(states: readonly { slug: string; state: string }[]): number {
  mkdirSync(OUT_DIR, { recursive: true })
  let written = 0
  for (const { slug, state } of states) {
    const domPath = join(CLEAN_DIR, slug, state, 'dom.html')
    if (!existsSync(domPath)) continue
    const { html } = rewriteSubstrate(readFileSync(domPath, 'utf8'))
    const inner = extractRootInner(html)
    if (inner === null) continue
    writeFileSync(join(OUT_DIR, `${slug}__${state}.html`), inner)
    written += 1

    // ポータル（モーダル等）は別ファイルで出す
    const portals = extractPortals(html)
    if (portals.length > 0) {
      writeFileSync(join(OUT_DIR, `${slug}__${state}.portals.html`), portals.join('\n'))
    }
  }
  return written
}
