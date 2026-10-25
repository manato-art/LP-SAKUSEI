/**
 * 画面に「beyond」を出さない（2026-10-25 本人「beyondと言う文字は全部消してください。大文字小文字関係なしに」）。
 *
 * 本人の選択: 「SquadBeyond」はまるごと消して文を整える／計測の説明の squadbeyond_uid は「計測用の目印」と言い換える
 * （URLに付く名前＝計測の仕組みはそのまま）。
 * 残してよいのは、画面に出ない名前だけ（ファイル名・関数名・data-testid・計測の仕組みが実際に使う名前・
 * サイドバーのロゴの代わりの文字＝目印に使っている・コメント）。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseHTML } from 'linkedom'

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

/** 画面に出ない名前（これ以外の beyond は画面の文字とみなす） */
const INTERNAL = [
  /beyond-nav/,
  /beyond-topbar/,
  /Beyond(NavAnchors|TopBar|Back)/,
  /beyond-page-form/,
  /squadbeyond_uid/,
  /Squadbeyond Logo/,
  /squadbeyond-capture-quarantine/,
]
const isInternal = (line: string): boolean => INTERNAL.some((re) => re.test(line))
const isComment = (line: string): boolean => /^\s*(\*|\/\/|\/\*)/.test(line)

describe('画面に「beyond」を出さない', () => {
  it('画面とサーバーのコードの文字（コメント・画面に出ない名前を除く）', () => {
    const hits = ['src/app', 'src/shared', 'mock-server']
      .flatMap(walk)
      .filter((path) => path.endsWith('.ts'))
      .flatMap((path) =>
        readFileSync(path, 'utf8')
          .split('\n')
          .map((line, i) => ({ path, line: i + 1, text: line }))
          .filter(({ text }) => /beyond/i.test(text) && !isComment(text) && !isInternal(text)),
      )
      .map(({ path, line, text }) => `${path}:${line} ${text.trim()}`)
    expect(hits).toEqual([])
  })

  it('画面の土台（採取した画面）の文字・入力欄の薄い文字・読み上げの名前', () => {
    const used = new Set(
      walk('src/app')
        .filter((path) => path.endsWith('.ts'))
        .flatMap((path) => [...readFileSync(path, 'utf8').matchAll(/fragments\/([A-Za-z0-9_.-]+\.html)/g)].map((m) => m[1] ?? '')),
    )
    const hits: string[] = []
    for (const name of used) {
      const { document } = parseHTML(readFileSync(join('src/app/fragments', name), 'utf8'))
      const visit = (node: Node): void => {
        if (node.nodeType === 1) {
          const el = node as Element
          if (['SCRIPT', 'STYLE'].includes(el.tagName.toUpperCase())) return
          for (const attr of ['placeholder', 'title', 'aria-label', 'value']) {
            const value = el.getAttribute(attr)
            if (value !== null && /beyond/i.test(value)) hits.push(`${name} [${attr}] ${value}`)
          }
        }
        if (node.nodeType === 3 && /beyond/i.test(node.textContent ?? '')) hits.push(`${name} ${(node.textContent ?? '').trim()}`)
        node.childNodes.forEach(visit)
      }
      visit(document as unknown as Node)
    }
    expect(hits).toEqual([])
  })
})
