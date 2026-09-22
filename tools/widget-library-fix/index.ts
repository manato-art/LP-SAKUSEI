/**
 * 見本（Widgetライブラリ）の直しを、採取した見本データに当てる（2026-09-22・本人の依頼「見本をすべて確認して、
 * 押して動くものに作り変えて」）。`npm run widget-fix`。
 *
 * 見本は `capture/clean/widget-library/cat*\/grid.html.gz`（カテゴリーごと）と、ライブラリを開いた直後の25枚
 * （`src/app/fragments/…widget-library.portals.html`）の、カードの iframe srcdoc に1件ずつ入っている。
 * 直しはどれも「何度かけても同じ」なので、何度回してもよい。直していない見本は1文字も変えない。
 *
 * ⚠️ `npm run rehydrate` は見本を採取物から作り直す（痩せる）。回したら git checkout で戻すこと。
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'
import { fixSample } from './fix-sample.ts'
import { mapSrcdocs } from './srcdoc-codec.ts'

const LIBRARY_DIR = 'capture/clean/widget-library'
const FIRST_CARDS = 'src/app/fragments/ab_tests__UID__articles__widget-library.portals.html'

function fixGrid(html: string): { html: string; changed: number; total: number } {
  let changed = 0
  let total = 0
  const out = mapSrcdocs(html, (sample) => {
    total += 1
    const fixed = fixSample(sample)
    if (fixed !== sample) changed += 1
    return fixed
  })
  return { html: out, changed, total }
}

function main(): void {
  const dirs = readdirSync(LIBRARY_DIR)
    .filter((name) => /^cat\d+$/.test(name))
    .sort((a, b) => Number(a.slice(3)) - Number(b.slice(3)))
  for (const dir of dirs) {
    const path = join(LIBRARY_DIR, dir, 'grid.html.gz')
    const before = gunzipSync(readFileSync(path)).toString('utf8')
    const { html, changed, total } = fixGrid(before)
    if (html !== before) writeFileSync(path, gzipSync(Buffer.from(html, 'utf8'), { level: 9 }))
    console.log(`[widget-fix] ${dir}: ${changed}/${total} 件を直した`)
  }
  const first = readFileSync(FIRST_CARDS, 'utf8')
  const { html, changed, total } = fixGrid(first)
  if (html !== first) writeFileSync(FIRST_CARDS, html)
  console.log(`[widget-fix] 最初の25枚: ${changed}/${total} 件を直した`)
}

main()
