import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'

/**
 * ブラウザ標準の confirm() / alert() / prompt() を使わない。
 *
 * 標準ダイアログは「lp-sakusei-production.up.railway.app の内容」という
 * 素の見出しが出てアプリから浮くうえ、文言も整えられない（改行・補足・強調が置けない）。
 * 代わりに src/app/dialog.ts の confirmCard / promptCard を使う。
 *
 * このテストは**ソースを読んで**見張る。1件でも戻ったらここで落ちる。
 */

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

/** コメント行は対象外（説明のために名前を書くことがある） */
function codeLines(source: string): { line: string; no: number }[] {
  return source
    .split('\n')
    .map((line, i) => ({ line, no: i + 1 }))
    .filter(({ line }) => {
      const t = line.trim()
      return !t.startsWith('*') && !t.startsWith('//') && !t.startsWith('/*')
    })
}

const NATIVE = /(?<![.\w])(?:window\.|globalThis\.)?(confirm|alert|prompt)\s*\(/

describe('ダイアログ', () => {
  it('ブラウザ標準の confirm / alert / prompt を呼んでいない', () => {
    const files = [...walk('src'), ...walk('mock-server')].filter((f) => extname(f) === '.ts')
    const hits: string[] = []
    for (const file of files) {
      for (const { line, no } of codeLines(readFileSync(file, 'utf8'))) {
        // アプリ内カード（confirmCard / promptCard）は対象外
        if (line.includes('confirmCard') || line.includes('promptCard')) continue
        if (NATIVE.test(line)) hits.push(`${file}:${no} ${line.trim()}`)
      }
    }
    expect(hits).toEqual([])
  })

  it('確認カードは削除操作を赤（danger）で出している', () => {
    const files = [...walk('src')].filter((f) => extname(f) === '.ts')
    const missing: string[] = []
    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      // 「削除する」を実行ラベルにしているのに danger を付けていない箇所を探す
      for (const m of source.matchAll(/confirmCard\(\{[\s\S]{0,400}?\}\)/g)) {
        const block = m[0]
        if (block.includes("submitLabel: '削除する'") && !block.includes('danger: true')) {
          missing.push(file)
        }
      }
    }
    expect(missing).toEqual([])
  })

  it('取り消せない操作には理由を添えている', () => {
    const source = readFileSync('src/app/pages/bulk-tags-page.ts', 'utf8')
    expect(source).toContain('元に戻せません')
  })
})
