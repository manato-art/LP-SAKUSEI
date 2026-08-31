/**
 * 採取したDOMが参照しているアセットを洗い出して、未取得分だけを取ってくる。
 *
 *   npm run fetch-assets -- --host https://<採取対象のホスト>
 *
 * 採取のたびに手で拾うのを避けるための道具（実際に2回取り漏らした）。
 * SPAは存在しないパスにも200でHTMLを返すので、**中身がHTMLなら失敗として扱う**。
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { localPathForAsset } from './paths.ts'
import { homedir } from 'node:os'

const QUARANTINE = join(homedir(), 'squadbeyond-capture-quarantine')
const ROUTES_DIR = join(QUARANTINE, 'routes')
const ASSETS_DIR = join(QUARANTINE, 'assets')
const ASSET_RE = /\/assets\/[A-Za-z0-9_-]+-[a-f0-9]{8}\.(?:svg|png|jpg|gif|woff2|woff|ttf)/g

function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

function referencedAssets(): string[] {
  const found = new Set<string>()
  for (const file of walk(ROUTES_DIR)) {
    if (!/\.(html|json|css)$/.test(file)) continue
    for (const match of readFileSync(file, 'utf8').match(ASSET_RE) ?? []) found.add(match)
  }
  return [...found].sort()
}

/** SPAのフォールバック（中身がHTML）を掴まされていないか検査する */
function looksLikeHtml(buffer: Buffer): boolean {
  const head = buffer.subarray(0, 200).toString('utf8').toLowerCase()
  return head.includes('<!doctype html') || head.includes('<html')
}

async function main(): Promise<void> {
  const hostIndex = process.argv.indexOf('--host')
  const host = hostIndex === -1 ? undefined : process.argv[hostIndex + 1]
  if (host === undefined) {
    console.error('使い方: npm run fetch-assets -- --host https://<採取対象のホスト>')
    console.error('（本番ドメインをソースに書かないため、実行時に渡す・企画書 §3-2）')
    process.exitCode = 1
    return
  }
  mkdirSync(ASSETS_DIR, { recursive: true })

  const assets = referencedAssets()
  const missing = assets.filter((a) => !existsSync(join(ASSETS_DIR, localPathForAsset(a))))
  console.log(`[assets] 参照 ${assets.length}件 / 未取得 ${missing.length}件`)

  let ok = 0
  const failed: string[] = []
  for (const asset of missing) {
    const res = await fetch(`${host}${asset}`)
    if (!res.ok) {
      failed.push(`${asset} (${res.status})`)
      continue
    }
    const buffer = Buffer.from(await res.arrayBuffer())
    if (looksLikeHtml(buffer)) {
      failed.push(`${asset} (中身がHTML＝SPAフォールバック)`)
      continue
    }
    // 実物のURLの形をそのまま写す。basename だけにすると、
    // 採取したCSSが参照する /assets/x.svg と噛み合わなくなる。
    const target = join(ASSETS_DIR, localPathForAsset(asset))
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, buffer)
    ok += 1
  }
  console.log(`[assets] 取得 ${ok}件 / 失敗 ${failed.length}件`)
  for (const f of failed) console.log(`  - ${f}`)
  console.log('[assets] 次に: npx tsx tools/scrub/index.ts --in ~/squadbeyond-capture-quarantine/assets --out capture/assets')
}

void main()
