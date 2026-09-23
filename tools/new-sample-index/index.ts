/**
 * 自作の見本の一覧（samples/index.ts）を、ファイルから組み直す道具（2026-09-23）。
 *
 * `npm run sample-index`。見本を足したら回す（100種まで増やすので、手で並べると抜ける）。
 * 並びは `SAMPLE_CATEGORIES` の順（＝ライブラリの左の並び＝LPの上から下）、同じ種類の中はファイル名順。
 */
import { readdirSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { SAMPLE_CATEGORIES, type NewSample } from '../../src/app/panels/nocode/samples/kit.ts'

const DIR = 'src/app/panels/nocode/samples'
const NOT_SAMPLES = new Set(['kit.ts', 'index.ts'])

interface Found {
  readonly file: string
  readonly exportName: string
  readonly category: string
}

async function collect(): Promise<Found[]> {
  const files = readdirSync(DIR)
    .filter((f) => f.endsWith('.ts') && !NOT_SAMPLES.has(f))
    .sort()
  const found: Found[] = []
  for (const file of files) {
    const module = (await import(pathToFileURL(resolve(join(DIR, file))).href)) as Record<string, unknown>
    for (const [exportName, value] of Object.entries(module)) {
      if (typeof value !== 'object' || value === null || !('html' in value) || !('category' in value)) continue
      found.push({ file: basename(file, '.ts'), exportName, category: (value as NewSample).category })
    }
  }
  return found
}

function order(a: Found, b: Found): number {
  const ai = SAMPLE_CATEGORIES.indexOf(a.category as NewSample['category'])
  const bi = SAMPLE_CATEGORIES.indexOf(b.category as NewSample['category'])
  return ai === bi ? a.file.localeCompare(b.file) : ai - bi
}

async function main(): Promise<void> {
  const found = (await collect()).sort(order)
  const imports = [...found]
    .sort((a, b) => a.exportName.localeCompare(b.exportName))
    .map((f) => `import { ${f.exportName} } from './${f.file}.ts'`)
    .join('\n')
  const byCategory = SAMPLE_CATEGORIES.map((category) => {
    const list = found.filter((f) => f.category === category)
    return list.length === 0 ? '' : `  // ${category}（${list.length}本）\n${list.map((f) => `  ${f.exportName},`).join('\n')}`
  }).filter((block) => block !== '')

  const text = `/**
 * 自作の見本の一覧（2026-09-23・本人の依頼「SBから持ってきた見本は使い勝手が悪いので0から作り直す。100種目指そう」）。
 *
 * 並び順＝ライブラリの左の種類の順＝LPの上から下（冒頭 → … → フッター）。
 * **このファイルは \`npm run sample-index\` が組み直す**（見本を足したら回す）。手で並べ替えない。
 * 作りの決まりは docs/見本の作り方.md と kit.ts、確かめは npm run sample-check。
 */
${imports}
import type { NewSample } from './kit.ts'

export { SAMPLE_CATEGORIES } from './kit.ts'
export type { NewSample, SampleCategory } from './kit.ts'

export const NEW_SAMPLES: readonly NewSample[] = [
${byCategory.join('\n')}
]
`
  writeFileSync(join(DIR, 'index.ts'), text)
  console.log(`[sample-index] ${found.length}本を並べ直した`)
  for (const category of SAMPLE_CATEGORIES) {
    const n = found.filter((f) => f.category === category).length
    console.log(`  ${category}: ${n}`)
  }
}

void main()
