/**
 * 到達性の被覆率レポートを出す。
 *
 *   npm run coverage            … 要約だけ
 *   npm run coverage -- --full  … 未配線の要素を全部並べる
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import { buildCoverage, extractInteractive, extractWiredSelectors } from './extract.ts'

const FRAGMENT_DIR = 'src/app/fragments'
const SOURCE_DIRS = ['src/app', 'mock-server']

function listFiles(dir: string, ext: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) found.push(...listFiles(full, ext))
    else if (extname(entry) === ext) found.push(full)
  }
  return found
}

type Family = 'app' | 'component'

/**
 * 状態ごとの要素一覧を作る。
 *
 * data-test（アプリ自身の配線フック）と data-testid（デザインシステム側）は**混ぜない**。
 * 後者はアイコンやフォーカストラップなど押せない要素が大半で、
 * 一緒に数えると「到達できる画面の被覆率」という意味が壊れるため。
 */
function readCapturedByState(family: Family): Record<string, string[]> {
  const byState: Record<string, string[]> = {}
  for (const file of listFiles(FRAGMENT_DIR, '.html')) {
    const state = file.slice(FRAGMENT_DIR.length + 1).replace(/\.html$/, '')
    const found = extractInteractive(readFileSync(file, 'utf8'))
    const testIds = family === 'app' ? found.testIds : found.componentTestIds
    if (testIds.length > 0) byState[state] = [...testIds]
  }
  return byState
}

function readWiredSelectors(): string[] {
  const wired = new Set<string>()
  for (const dir of SOURCE_DIRS) {
    for (const file of listFiles(dir, '.ts')) {
      for (const testId of extractWiredSelectors(readFileSync(file, 'utf8'))) wired.add(testId)
    }
  }
  return [...wired]
}

function main(): void {
  const isFull = process.argv.includes('--full')
  const wiredTestIds = readWiredSelectors()
  const appByState = readCapturedByState('app')
  const componentByState = readCapturedByState('component')
  const appCoverage = buildCoverage(appByState, wiredTestIds)
  const componentCoverage = buildCoverage(componentByState, wiredTestIds)

  const percent = (ratio: number | null): string =>
    ratio === null ? '判定不能（採取物が空）' : `${Math.round(ratio * 100)}%`

  console.log('[被覆率] 採取した実物の操作可能要素と、クローンの配線の差分')
  console.log(`  採取した状態数: ${Object.keys(appByState).length}`)
  console.log('')
  console.log('  ■ data-test（アプリ自身の配線フック＝到達性の本命）')
  console.log(`    実物: ${appCoverage.total}件 / 配線済み: ${appCoverage.wired}件 / 被覆率: ${percent(appCoverage.ratio)}`)

  const unwired = [...new Set(appCoverage.unwired.map((element) => element.testId))]
  console.log(`    未配線: ${unwired.length}件`)
  for (const name of isFull ? unwired : unwired.slice(0, 15)) console.log(`      - ${name}`)
  if (!isFull && unwired.length > 15) console.log(`      …ほか ${unwired.length - 15}件（--full で全部）`)

  console.log('')
  console.log('  ■ data-testid（デザインシステム側・アイコン等の非操作要素を多く含む＝参考値）')
  console.log(
    `    実物: ${componentCoverage.total}件 / 配線済み: ${componentCoverage.wired}件 / 被覆率: ${percent(componentCoverage.ratio)}`,
  )

  const ghosts = appCoverage.notInCapture
  if (ghosts.length > 0) {
    console.log('')
    console.log(`  ⚠ 採取物に存在しないのに参照している（推測の疑い）: ${ghosts.length}件`)
    for (const name of ghosts) console.log(`    - ${name}`)
  }
}

main()
