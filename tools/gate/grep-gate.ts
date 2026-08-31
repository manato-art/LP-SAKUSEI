import { loadRouteWordsFromManifest } from '../shared/url-identifier.ts'
/**
 * grepゲート（企画書 §5-5「通過必須」・§13-E/F/G）。
 *
 *   npx tsx tools/gate/grep-gate.ts [--names <実名リスト>]
 *
 * 1件でもヒットしたら exit 1 で止める。土台化・コミットはこのゲートを通ってから。
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { extname, join } from 'node:path'
import {
  EXTERNAL_HOST_ALLOWLIST,
  EXTERNAL_HOST_PATTERN,
  EXTERNAL_SAAS_PATTERNS,
  PRODUCTION_HOST_PATTERN,
  PRODUCTION_TOKEN_PATTERNS,
  SCAN_DIRS,
  SCAN_EXTENSIONS,
  SELF_EXCLUDE,
  SUSPICIOUS_MONEY_PATTERN,
  findUrlIdentifierLeaks,
} from './denylist.ts'
import { parseKnownNames } from '../scrub/dictionary.ts'

interface Hit {
  gate: string
  file: string
  line: number
  excerpt: string
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((entry) => {
    if (entry === 'node_modules' || entry.startsWith('.')) return []
    const full = join(dir, entry)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

function scanFiles(): string[] {
  return SCAN_DIRS.flatMap(walk)
    .filter((f) => SCAN_EXTENSIONS.includes(extname(f)))
    .filter((f) => !SELF_EXCLUDE.some((ex) => f.endsWith(ex)))
}

function scanPattern(files: readonly string[], gate: string, pattern: RegExp): Hit[] {
  // グローバル正規表現は lastIndex を持ち回るため、非グローバルの複製で1行ずつ判定する
  const perLine = new RegExp(pattern.source, pattern.flags.replace('g', ''))
  const hits: Hit[] = []
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, index) => {
      const match = perLine.exec(line)
      if (match !== null) {
        hits.push({ gate, file, line: index + 1, excerpt: match[0].slice(0, 80) })
      }
    })
  }
  return hits
}

/**
 * 採取品質の検査（2026-08-31 の実採取で踏んだ罠）。
 * SPAは存在しないパスにも 200 で index.html を返すため、
 * 「ダウンロード成功」に見えて中身がHTMLというアセットが混入する。
 * バイナリ想定の拡張子なのに中身がHTMLなら不合格にする。
 */
const BINARY_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.woff', '.woff2', '.ttf', '.eot', '.otf']

function scanFallbackAssets(): Hit[] {
  const hits: Hit[] = []
  for (const dir of SCAN_DIRS) {
    for (const file of walk(dir)) {
      if (!BINARY_EXTENSIONS.includes(extname(file).toLowerCase())) continue
      const head = readFileSync(file).subarray(0, 200).toString('utf8').toLowerCase()
      if (head.includes('<!doctype html') || head.includes('<html')) {
        hits.push({
          gate: '採取品質 SPAフォールバック誤取得',
          file,
          line: 0,
          excerpt: 'バイナリ想定だが中身がHTML（再取得が必要）',
        })
      }
    }
  }
  return hits
}

/** §13-F: 許可リスト外の外部ホストを検出する */
function scanExternalHosts(files: readonly string[]): Hit[] {
  const hits: Hit[] = []
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, index) => {
      const matches = line.match(EXTERNAL_HOST_PATTERN) ?? []
      for (const url of new Set(matches)) {
        if (EXTERNAL_HOST_ALLOWLIST.some((re) => re.test(url))) continue
        hits.push({ gate: '13-F 外部ホスト', file, line: index + 1, excerpt: url.slice(0, 60) })
      }
    })
  }
  return hits
}

function scanLiterals(files: readonly string[], gate: string, literals: readonly string[]): Hit[] {
  const hits: Hit[] = []
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, index) => {
      for (const literal of literals) {
        if (line.includes(literal)) {
          hits.push({ gate, file, line: index + 1, excerpt: literal })
        }
      }
    })
  }
  return hits
}

/** §13-E: 生キャプチャ・秘密ファイルがgit管理下に入っていないこと */
function scanGitTracked(): Hit[] {
  try {
    const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n')
    const forbidden = ['scrub-map.json', '.env', 'capture/raw/', 'quarantine']
    return tracked
      .filter((f) => f !== '' && forbidden.some((bad) => f.includes(bad)))
      .map((f) => ({ gate: '13-E gitトラッキング', file: f, line: 0, excerpt: f }))
  } catch {
    // gitリポジトリでない場合はこのゲートをスキップ（他ゲートは実行する）
    return []
  }
}

/**
 * 実名リストの既定の置き場。
 * 実名そのものが入るファイルなので .gitignore 済み（コミットしてはいけない）。
 * --names を毎回付け忘れると実名スキャンが黙って素通りするので、既定でここを見る。
 */
const DEFAULT_NAMES_FILE = '.gate-names.local'

function resolveNamesFile(): string | undefined {
  const namesFlag = process.argv.indexOf('--names')
  if (namesFlag !== -1) return process.argv[namesFlag + 1]
  return existsSync(DEFAULT_NAMES_FILE) ? DEFAULT_NAMES_FILE : undefined
}

/**
 * ルートの固定語の許可リストを docs/routes.json から作る。
 * 形（小文字か否か）だけでは全部小文字の実IDを取りこぼすため、
 * 「ルート表に載っている語だけが構造語」という強い基準に切り替える。
 */
function loadRouteWords(): string[] {
  return loadRouteWordsFromManifest(readFileSync('docs/routes.json', 'utf8'))
}

/** URLの形をした実IDの残存を走査する。長さ閾値では9文字のIDを取りこぼすため。 */
function scanUrlIdentifiers(files: readonly string[], routeWords: readonly string[]): Hit[] {
  return files.flatMap((file) => {
    const lines = readFileSync(file, 'utf8').split('\n')
    return lines.flatMap((line, index) =>
      findUrlIdentifierLeaks(line, routeWords).map((value) => ({
        gate: '13-E URL形の実ID',
        file,
        line: index + 1,
        excerpt: value,
      })),
    )
  })
}

function main(): void {
  const namesFile = resolveNamesFile()
  const files = scanFiles()

  const hits: Hit[] = [
    ...scanPattern(files, '13-F 本番ドメイン', PRODUCTION_HOST_PATTERN),
    ...EXTERNAL_SAAS_PATTERNS.flatMap(({ name, pattern }) =>
      scanPattern(files, `13-G 外部SaaS(${name})`, pattern),
    ),
    ...PRODUCTION_TOKEN_PATTERNS.flatMap(({ name, pattern }) =>
      scanPattern(files, `5-5 本番トークン(${name})`, pattern),
    ),
    ...scanPattern(files, '13-E 実金額らしい値', SUSPICIOUS_MONEY_PATTERN),
    ...scanExternalHosts(files),
    ...scanUrlIdentifiers(files, loadRouteWords()),
    ...scanFallbackAssets(),
    ...scanGitTracked(),
  ]

  if (namesFile !== undefined && existsSync(namesFile)) {
    const names = parseKnownNames(readFileSync(namesFile, 'utf8'))
    hits.push(...scanLiterals(files, '13-E 実名', names))
    console.log(`[gate] 実名スキャン実施: ${names.length}語（${namesFile}）`)
  } else {
    console.error(
      `[gate] 不合格: 実名リストが無いため実名スキャンを実施できない。` +
        `${DEFAULT_NAMES_FILE} を作るか --names <ファイル> を指定すること`,
    )
    process.exitCode = 1
  }

  console.log(`[gate] 走査対象: ${files.length}ファイル / ${SCAN_DIRS.join(', ')}`)
  if (hits.length === 0) {
    console.log('[gate] 合格: denylist ヒット 0件')
    return
  }
  console.error(`[gate] 不合格: ${hits.length}件ヒット`)
  for (const hit of hits.slice(0, 50)) {
    console.error(`  [${hit.gate}] ${hit.file}:${hit.line}  ${hit.excerpt}`)
  }
  if (hits.length > 50) console.error(`  ...ほか ${hits.length - 50}件`)
  process.exitCode = 1
}

main()
