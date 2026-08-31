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
  }
  return written
}
