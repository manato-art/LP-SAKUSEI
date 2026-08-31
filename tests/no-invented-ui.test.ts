import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 実物に無いUI文言をクローンが足していないか。
 *
 * 企画書 §3-5「実物がそうなっているなら、そのまま再現する。勝手に改善しない」。
 * 実際に「配信割合の合計が〇%です」という実物に無い赤字が、採取した実DOMの中に
 * 差し込まれていた（根拠は採取前に書かれた推測で、実測はそれを否定していた）。
 */
const CAPTURE_DIRS = ['src/app/fragments', 'capture/clean']

function allCapturedText(): string {
  const parts: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.html')) parts.push(readFileSync(full, 'utf8'))
    }
  }
  for (const dir of CAPTURE_DIRS) walk(dir)
  return parts.join('\n')
}

const INVENTED_PHRASES = [
  '100%になるよう調整してください',
  'SP表示に切替',
  'PC表示に切替',
]

describe('実物に無いUI文言を足していない', () => {
  const captured = allCapturedText()

  it.each(INVENTED_PHRASES)('「%s」は採取物に無い（＝作ってはいけない）', (phrase) => {
    expect(captured).not.toContain(phrase)
  })

  it.each(INVENTED_PHRASES)('「%s」をクローンのコードも出さない', (phrase) => {
    const sources: string[] = []
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) walk(full)
        else if (entry.name.endsWith('.ts')) sources.push(readFileSync(full, 'utf8'))
      }
    }
    walk('src/app')
    expect(sources.join('\n')).not.toContain(phrase)
  })
})
