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
  EXTERNAL_SAAS_PATTERNS,
  PRODUCTION_HOST_PATTERN,
  PRODUCTION_TOKEN_PATTERNS,
  SCAN_DIRS,
  SCAN_EXTENSIONS,
  SELF_EXCLUDE,
  SUSPICIOUS_MONEY_PATTERN,
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

function main(): void {
  const namesFlag = process.argv.indexOf('--names')
  const namesFile = namesFlag === -1 ? undefined : process.argv[namesFlag + 1]
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
    ...scanGitTracked(),
  ]

  if (namesFile !== undefined && existsSync(namesFile)) {
    const names = parseKnownNames(readFileSync(namesFile, 'utf8'))
    hits.push(...scanLiterals(files, '13-E 実名', names))
  } else {
    console.log('[gate] 注意: --names 未指定のため実名スキャンは未実施（採取後は必ず指定すること）')
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
