/**
 * 採取シンク（企画書 §5-1[1]・§5-4）。
 *
 * ブラウザで採取したDOM/CSS/HAR/fixtureを、**隔離ディレクトリへ直接書き出す**ための受け口。
 * 採取物は数百KBになるため、人やAIの文脈を経由せずディスクへ落とす必要がある。
 *
 * 安全のための制約:
 *  - 書き込み先は隔離ディレクトリ配下に**強制**（パストラバーサル不可）
 *  - 開発時のみ。`CAPTURE_SINK=off` で無効化できる
 *  - 隔離ディレクトリはリポジトリ外なので、ここに書いたものはコミットされない（§3-3）
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, normalize, resolve } from 'node:path'
import { homedir } from 'node:os'
import { Router, type Request, type Response, type NextFunction } from 'express'
import { errorEnvelope } from './lib/envelope.ts'

export const QUARANTINE_DIR = resolve(homedir(), 'squadbeyond-capture-quarantine')

const SAFE_SEGMENT = /^[A-Za-z0-9_.-]+$/
const ALLOWED_EXTENSIONS = ['.html', '.json', '.css', '.txt', '.har', '.md']

export const captureSinkRouter: Router = Router()

/**
 * 採取元は https のページなので、localhost への fetch には
 * CORS と Private Network Access の許可が要る。
 */
function allowCapture(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Private-Network', 'true')
  res.setHeader('Access-Control-Max-Age', '600')
  next()
}

captureSinkRouter.use('/__capture', allowCapture)

captureSinkRouter.options('/__capture/upload', (_req, res) => {
  res.status(204).end()
})

interface UploadBody {
  slug?: unknown
  state?: unknown
  filename?: unknown
  content?: unknown
}

/** パスを隔離ディレクトリ配下へ強制する（外に出る指定は拒否） */
function resolveTarget(slug: string, state: string, filename: string): string | null {
  for (const segment of [slug, state, filename]) {
    if (!SAFE_SEGMENT.test(segment)) return null
  }
  if (!ALLOWED_EXTENSIONS.some((ext) => filename.endsWith(ext))) return null
  const target = normalize(join(QUARANTINE_DIR, 'routes', slug, state, filename))
  return target.startsWith(QUARANTINE_DIR) ? target : null
}

captureSinkRouter.post('/__capture/upload', (req, res) => {
  if (process.env['CAPTURE_SINK'] === 'off') {
    res.status(403).json(errorEnvelope('capture_sink_disabled', '採取シンクは無効です。'))
    return
  }
  const body = req.body as UploadBody
  const slug = typeof body.slug === 'string' ? body.slug : ''
  const state = typeof body.state === 'string' ? body.state : ''
  const filename = typeof body.filename === 'string' ? body.filename : ''
  const content = typeof body.content === 'string' ? body.content : null

  if (content === null) {
    res.status(422).json(errorEnvelope('validation_failed', 'content は文字列で指定してください。'))
    return
  }
  const target = resolveTarget(slug, state, filename)
  if (target === null) {
    res.status(422).json(errorEnvelope('validation_failed', 'slug/state/filename が不正です。'))
    return
  }

  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content)
  console.log(`[capture] ${slug}/${state}/${filename} (${content.length} bytes)`)
  res.json({ ok: true, bytes: content.length, path: `routes/${slug}/${state}/${filename}` })
})
