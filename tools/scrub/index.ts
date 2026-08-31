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
import { homedir } from 'node:os'
import {
  collectFromJson,
  collectKnownEntries,
  collectUrlIdentifiers,
  mergeMaps,
  parseKnownEntries,
  type ScrubMap,
} from './dictionary.ts'
import { loadRouteWordsFromManifest } from '../shared/url-identifier.ts'
import { scrubJson, scrubText, type HostRewrite } from './scrub.ts'

const SCRUB_MAP_PATH = 'scrub-map.json'
const TEXT_EXTENSIONS = new Set(['.html', '.htm', '.css', '.js', '.txt', '.md', '.har', '.svg'])
/** gate と共有する実名リスト。実名が入るので .gitignore 済み。 */
const DEFAULT_NAMES_FILE = '.gate-names.local'

/** 実行設定（本番ホスト名が入るので .gitignore 済み）。毎回の引数指定を覚えなくて済むようにする。 */
const LOCAL_CONFIG_FILE = '.scrub.local.json'

interface LocalConfig {
  readonly in?: string
  readonly out?: string
  readonly hostPattern?: string
}

function readLocalConfig(): LocalConfig {
  if (!existsSync(LOCAL_CONFIG_FILE)) return {}
  return JSON.parse(readFileSync(LOCAL_CONFIG_FILE, 'utf8')) as LocalConfig
}

function expandHome(target: string): string {
  return target.startsWith('~/') ? join(homedir(), target.slice(2)) : target
}

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
  const local = readLocalConfig()
  const inDir = get('--in') ?? local.in
  const outDir = get('--out') ?? local.out ?? 'capture/clean'
  if (inDir === undefined) {
    throw new Error(
      `--in <隔離ディレクトリ> を指定するか、${LOCAL_CONFIG_FILE} に in を書いてください`,
    )
  }
  const hostPattern = get('--host-pattern') ?? local.hostPattern
  if (hostPattern === undefined) {
    // 本番ホストのパターンはソースに固定で書かない（§3-2）。
    // 未指定のまま既定値で走ると「匿名化したつもりで本番ドメインが残る」ので、必ず止める。
    throw new Error(
      `--host-pattern を指定するか、${LOCAL_CONFIG_FILE} に hostPattern を書いてください`,
    )
  }
  return {
    inDir: expandHome(inDir),
    outDir,
    // gate と同じ実名リストを既定で読む。別々に指定できると片方だけ忘れて素通りする。
    namesFile: get('--names') ?? DEFAULT_NAMES_FILE,
    hostPattern,
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
  // 1-b) fixtures を採っていないページのIDは辞書に載らない。
  //      DOM/CSS 本文を走査し、URLの形（/ab_tests/<id> 等）から実IDを拾う。
  const routeWords = loadRouteWordsFromManifest(readFileSync('docs/routes.json', 'utf8'))
  let urlIdFiles = 0
  for (const file of files) {
    if (!TEXT_EXTENSIONS.has(extname(file))) continue
    collectUrlIdentifiers(readFileSync(file, 'utf8'), collected, routeWords)
    urlIdFiles += 1
  }
  console.log(`[scrub] URL形のID走査: ${urlIdFiles}ファイル`)

  if (args.namesFile !== undefined && existsSync(args.namesFile)) {
    const entries = parseKnownEntries(readFileSync(args.namesFile, 'utf8'))
    collectKnownEntries(entries, collected)
    console.log(`[scrub] 実名リストを適用: ${entries.length}語（${args.namesFile}）`)
  } else {
    console.warn(`[scrub] 警告: 実名リストが無い（${DEFAULT_NAMES_FILE}）。DOM本文の実名が残る可能性がある`)
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
