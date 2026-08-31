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

function readCapturedByState(): Record<string, string[]> {
  const byState: Record<string, string[]> = {}
  for (const file of listFiles(FRAGMENT_DIR, '.html')) {
    const state = file.slice(FRAGMENT_DIR.length + 1).replace(/\.html$/, '')
    const testIds = extractInteractive(readFileSync(file, 'utf8')).testIds
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
  const capturedByState = readCapturedByState()
  const wiredTestIds = readWiredSelectors()
  const coverage = buildCoverage(capturedByState, wiredTestIds)

  console.log('[被覆率] 採取した実物の操作可能要素と、クローンの配線の差分')
  console.log(`  採取した状態数: ${Object.keys(capturedByState).length}`)
  console.log(`  実物の要素（重複なし）: ${coverage.total}`)
  console.log(`  うち配線済み: ${coverage.wired}`)
  console.log(
    `  被覆率: ${coverage.ratio === null ? '判定不能（採取物が空）' : `${Math.round(coverage.ratio * 100)}%`}`,
  )

  const unwiredNames = [...new Set(coverage.unwired.map((element) => element.testId))]
  console.log(`  未配線（重複なし）: ${unwiredNames.length}件`)
  for (const name of isFull ? unwiredNames : unwiredNames.slice(0, 15)) console.log(`    - ${name}`)
  if (!isFull && unwiredNames.length > 15) console.log(`    …ほか ${unwiredNames.length - 15}件（--full で全部）`)

  if (coverage.notInCapture.length > 0) {
    console.log(`  ⚠ 採取物に存在しないのに参照している（推測の疑い）: ${coverage.notInCapture.length}件`)
    for (const name of coverage.notInCapture) console.log(`    - ${name}`)
  }
}

main()
