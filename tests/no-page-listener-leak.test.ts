/**
 * 画面全体（document・window）への見張りは、外す手だてを必ず持つ（2026-10-25 本人「クロームのメモリ見たら1.2Gだった」）。
 *
 * 外さない見張りは、中の処理が覚えている画面（LPの編集画面・Widget編集）を丸ごとつかみ続け、画面を開くたびにメモリに溜まる
 * （手元: LPの編集画面を3回行き来 → 前の画面3つが残った／Widget編集を8回開いて閉じる → 8つ全部残った）。
 * 見張りを足すときは、寿命（{ signal }・page-life.ts の pageLife() や Widget編集の寿命）で外すか、同じファイルで
 * removeEventListener で外す（開いている間だけの小窓など）。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

/** どこからも使っていないファイル（使い始めるときは見張りに寿命を付ける） */
const UNUSED = ['src/app/panels/minimap.ts']

/** 配信のLPで動くスクリプトの文（LPのページの寿命＝見張りの寿命。編集画面では動かない） */
const isLpScript = (path: string): boolean => /\/templates\/[a-z-]+-script\.ts$/.test(path)

/** アプリを開いている間に1回だけ仕込む見張り（画面を描くたびには足さない・旗で2回目をしない） */
const ONCE: readonly string[] = [
  'src/app/pages/report-dom.ts click',
  'src/app/pages/report-row-menu.ts click',
  'src/app/pages/report-row-menu.ts keydown',
  'src/app/main.ts hashchange',
  'src/app/shell.ts resize',
  'src/app/shell.ts hashchange',
  'src/app/shell.ts THEME_MODE_EVENT',
  'src/app/pages/editor-layout.ts beforeunload',
]

/** start の「(」から対になる「)」までの文字（文字列の中の括弧は数えない・おおよそでよい） */
function callText(src: string, start: number): string {
  let depth = 0
  let quote: string | null = null
  for (let i = start; i < src.length; i++) {
    const c = src[i]
    if (quote !== null) {
      if (c === '\\') i++
      else if (c === quote) quote = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') quote = c
    else if (c === '(') depth++
    else if (c === ')') {
      depth--
      if (depth === 0) return src.slice(start, i + 1)
    }
  }
  return src.slice(start)
}

describe('画面全体への見張りは外せる', () => {
  it('document・window への addEventListener は、寿命（signal）で外すか、同じファイルで removeEventListener する', () => {
    const offenders: string[] = []
    for (const path of walk('src/app').filter((p) => p.endsWith('.ts') && !UNUSED.includes(p) && !isLpScript(p))) {
      const src = readFileSync(path, 'utf8')
      // window. を書かない addEventListener(…) も window への見張り
      for (const m of src.matchAll(/(?:\b(document|window)\.|(?<![.\w$]))addEventListener\(/g)) {
        const at = (m.index ?? 0) + m[0].length - 1
        const call = callText(src, at)
        const type = /^\(\s*(['"]?)([A-Za-z_]+)\1/.exec(call)?.[2] ?? ''
        // コメントの中は数えない
        const lineStart = src.lastIndexOf('\n', m.index ?? 0) + 1
        if (/^\s*(\*|\/\/)/.test(src.slice(lineStart, m.index))) continue
        if (/\bsignal\b/.test(call)) continue
        if (type !== '' && new RegExp(`removeEventListener\\(\\s*['"]${type}['"]`).test(src)) continue
        if (ONCE.includes(`${path} ${type}`)) continue
        const line = src.slice(0, m.index).split('\n').length
        offenders.push(`${path}:${line} ${m[1] ?? 'window'} ${type}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
