/**
 * 匿名化CLI（企画書 §5-1[2]・§5-5）。
 *
 *   npx tsx tools/scrub/index.ts --in ~/squadbeyond-capture-quarantine --out capture/clean
 *
 * 入力（隔離ディレクトリ）は絶対にコミットしない。出力（capture/clean/）だけがコミット可。
 * 実行後は必ず grepゲート（tools/gate/grep-gate.ts）を通すこと。ゲート不合格なら土台化しない。
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs'
import { dirname, join, relative, extname } from 'node:path'
import { collectFromJson, collectKnownNames, mergeMaps, parseKnownNames, type ScrubMap } from './dictionary.ts'
import { scrubJson, scrubText, type HostRewrite } from './scrub.ts'

const SCRUB_MAP_PATH = 'scrub-map.json'
const TEXT_EXTENSIONS = new Set(['.html', '.htm', '.css', '.js', '.txt', '.md', '.har', '.svg'])
const JSON_EXTENSIONS = new Set(['.json'])

interface Args {
  inDir: string
  outDir: string
  namesFile: string | undefined
  hostPattern: string
}

function parseArgs(argv: readonly string[]): Args {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag)
    return i === -1 ? undefined : argv[i + 1]
  }
  const inDir = get('--in')
  const outDir = get('--out') ?? 'capture/clean'
  if (inDir === undefined) {
    throw new Error('--in <隔離ディレクトリ> を指定してください（例: ~/squadbeyond-capture-quarantine）')
  }
  return {
    inDir,
    outDir,
    namesFile: get('--names'),
    // 採取対象ホストは引数で渡す（本番ドメインをソースに固定で書かない・§3-2）
    hostPattern: get('--host-pattern') ?? '(?:https?://)?[a-z0-9-]+\\.PRODUCTION_HOST',
  }
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

function loadMap(): ScrubMap {
  if (!existsSync(SCRUB_MAP_PATH)) return {}
  return JSON.parse(readFileSync(SCRUB_MAP_PATH, 'utf8')) as ScrubMap
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  if (!existsSync(args.inDir)) {
    console.error(`[scrub] 入力ディレクトリがありません: ${args.inDir}`)
    process.exitCode = 1
    return
  }
  const hosts: HostRewrite = { productionHostPattern: new RegExp(args.hostPattern, 'gi') }
  const files = walk(args.inDir)

  // 1) 辞書構築: fixtures(JSON) のフィールド名を手がかりに literal を集める
  const map: ScrubMap = loadMap()
  const collected: ScrubMap = {}
  for (const file of files) {
    if (!JSON_EXTENSIONS.has(extname(file))) continue
    try {
      collectFromJson(JSON.parse(readFileSync(file, 'utf8')), collected)
    } catch (error) {
      console.warn(`[scrub] JSON解析に失敗（スキップ）: ${file}: ${(error as Error).message}`)
    }
  }
  if (args.namesFile !== undefined && existsSync(args.namesFile)) {
    collectKnownNames(parseKnownNames(readFileSync(args.namesFile, 'utf8')), collected)
  }
  const finalMap = mergeMaps(map, collected)

  // 2) 適用
  let written = 0
  const strippedTally = new Map<string, number>()
  for (const file of files) {
    const ext = extname(file)
    const target = join(args.outDir, relative(args.inDir, file))
    mkdirSync(dirname(target), { recursive: true })
    if (JSON_EXTENSIONS.has(ext)) {
      const parsed = JSON.parse(readFileSync(file, 'utf8')) as unknown
      writeFileSync(target, `${JSON.stringify(scrubJson(parsed, finalMap, hosts), null, 2)}\n`)
      written += 1
    } else if (TEXT_EXTENSIONS.has(ext)) {
      const result = scrubText(readFileSync(file, 'utf8'), finalMap, hosts)
      for (const name of result.stripped) {
        strippedTally.set(name, (strippedTally.get(name) ?? 0) + 1)
      }
      writeFileSync(target, result.text)
      written += 1
    } else {
      // 画像等のバイナリはそのまま複製（値を持たないため）
      writeFileSync(target, readFileSync(file))
      written += 1
    }
  }

  // 3) 写像を保存（非コミット・.gitignore 済み）
  writeFileSync(SCRUB_MAP_PATH, `${JSON.stringify(finalMap, null, 2)}\n`)

  console.log(`[scrub] ${written}ファイルを ${args.outDir} へ出力`)
  console.log(`[scrub] 置換辞書: ${Object.keys(finalMap).length}件（${SCRUB_MAP_PATH}・非コミット）`)
  for (const [name, count] of strippedTally) console.log(`[scrub] 除去: ${name} ×${count}`)
  console.log('[scrub] 次に必ず実行: npx tsx tools/gate/grep-gate.ts')
}

main()
