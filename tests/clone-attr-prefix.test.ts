import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * クローンが配線用に足す属性は、実物の属性と見分けがつく接頭辞にする。
 *
 * 実物のアプリ自身が `data-sb-tracking` / `data-sb-link-name` を使っており、
 * クローンも `data-sb-*` を足していたため、忠実度の差分を取るときに
 * 「実物の属性」と「クローンが足した属性」が混ざって区別できなかった。
 */
function sourceFiles(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...sourceFiles(full))
    else if (entry.name.endsWith('.ts')) found.push(full)
  }
  return found
}

describe('クローンが足す属性の接頭辞', () => {
  it('実物と同じ data-sb- を新たに足していない', () => {
    const offenders: string[] = []
    for (const file of [...sourceFiles('src/app'), ...sourceFiles('mock-server')]) {
      const text = readFileSync(file, 'utf8')
      // 採取物から取り出したマークアップ定数の中の data-sb- は実物のものなので除く
      const added = [...text.matchAll(/setAttribute\(\s*'(data-sb-[a-z-]+)'/g)]
      const queried = [...text.matchAll(/\[(data-sb-[a-z-]+)[=\]]/g)]
      if (added.length > 0 || queried.length > 0) offenders.push(file)
    }
    expect(offenders).toEqual([])
  })
})
